import {
  kvConfigured,
  kvSetNx,
  kvGet,
  kvIncr,
  kvExpire,
  kvMGet,
  kvPfAdd,
  kvPfCount,
  kvSAdd,
  kvSMembers,
  kvZIncrBy,
  kvZTop,
} from "@/lib/kv";

// First-party usage analytics: how people move through the site, from a first
// anonymous visit to signing in to paying.
//
// Everything here is stored in the Redis this app already uses, keyed by day.
// No third-party analytics, no shared identifiers, nothing that follows anyone
// off this domain.
//
// WHAT IS AND IS NOT KEPT, because that decision should be readable rather than
// inferred from the code:
//
//   • Visitor counts use a HyperLogLog. It answers "how many distinct people"
//     to within about a percent while keeping no record of who they were. There
//     is no visitor table to leak, join or subpoena.
//   • Signed-in ACTIVITY is a set of emails per day, because "which accounts are
//     using the site regularly" is the question, and it cannot be answered by a
//     counter. These expire on their own (see RETENTION_DAYS) — this is an
//     operations view, not a permanent record of anyone's reading habits.
//   • Paths and tickers are counted in aggregate. Neither is tied to a person.
//
// The recorder never throws and never blocks a response: a page that fell over
// because a metric failed would be a poor trade for knowing about the page.

export const RETENTION_DAYS = 90;
const TTL = RETENTION_DAYS * 24 * 60 * 60;

export type EventKind =
  | "visit" // any page view
  | "signin" // completed sign-in
  | "signup" // first-ever sign-in for this email
  | "pro" // became Pro
  | "search" // used the command search
  | "stock" // opened a stock page
  | "portfolio"; // created or edited a portfolio

// The workflow, in the order someone actually moves through it. Each step is a
// set of DISTINCT visitors, so the drop between two steps is people, not page
// views: a hundred visits from one person is one person who did not sign up.
//
// The steps are counted independently rather than as a strict path. Someone who
// opens a stock page from a shared link without searching first has still
// reached that step, and forcing a literal sequence would report them as a drop
// off at a step they simply skipped.
export const FUNNEL: { kind: EventKind; label: string }[] = [
  { kind: "visit", label: "Landed" },
  { kind: "search", label: "Searched" },
  { kind: "stock", label: "Opened a company" },
  { kind: "portfolio", label: "Built a portfolio" },
  { kind: "pro", label: "Went Pro" },
];

const day = (d = new Date()) => d.toISOString().slice(0, 10);

/**
 * ISO week, as "2026-W33".
 *
 * Weeks rather than days for retention: a daily cohort of a small site is a
 * handful of people, and a 20% return rate that is one person coming back is
 * noise presented as a measurement.
 */
export function isoWeek(d = new Date()): string {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  // Thursday decides the year, per ISO 8601.
  const dayNum = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - dayNum + 3);
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const week =
    1 +
    Math.round(
      ((t.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7
    );
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Weeks between two ISO week labels, for the retention grid. */
export function weeksBetween(a: string, b: string): number {
  const parse = (w: string) => {
    const [y, n] = w.split("-W");
    const jan4 = new Date(Date.UTC(Number(y), 0, 4));
    const monday = new Date(jan4);
    monday.setUTCDate(jan4.getUTCDate() - ((jan4.getUTCDay() + 6) % 7) + (Number(n) - 1) * 7);
    return monday.getTime();
  };
  return Math.round((parse(b) - parse(a)) / (7 * 86400000));
}

const K = {
  count: (kind: string, d: string) => `stats:${d}:n:${kind}`,
  uniques: (kind: string, d: string) => `stats:${d}:u:${kind}`,
  accounts: (d: string) => `stats:${d}:accounts`,
  // Retention. The cohort key holds everyone first seen that week; the second
  // holds the members of that cohort seen again in a later week, so the ratio
  // of the two is the return rate.
  cohort: (w: string) => `stats:cohort:${w}`,
  cohortActive: (w: string, at: string) => `stats:cohort:${w}:in:${at}`,
  firstSeen: (vid: string) => `stats:vfirst:${vid}`,
  paths: (d: string) => `stats:${d}:paths`,
  tickers: (d: string) => `stats:${d}:tickers`,
  proTotal: "stats:total:pro",
  signupTotal: "stats:total:signup",
};

async function bump(key: string) {
  await kvIncr(key);
  await kvExpire(key, TTL);
}

export interface RecordInput {
  kind: EventKind;
  /** Opaque per-browser id from a first-party cookie. Never an email. */
  visitorId?: string;
  /** Present only when signed in. */
  email?: string;
  path?: string;
  ticker?: string;
}

/** Record one event. Safe to call from anywhere; failures are swallowed. */
export async function recordEvent(e: RecordInput): Promise<void> {
  if (!kvConfigured()) return;
  const d = day();
  try {
    await bump(K.count(e.kind, d));

    if (e.visitorId) {
      await kvPfAdd(K.uniques(e.kind, d), e.visitorId);
      await kvExpire(K.uniques(e.kind, d), TTL);
      // Signed-in or not, split at the top level: the gap between the two is
      // the whole funnel.
      const bucket = e.email ? "known" : "anon";
      await kvPfAdd(K.uniques(`visitor:${bucket}`, d), e.visitorId);
      await kvExpire(K.uniques(`visitor:${bucket}`, d), TTL);
    }

    // Cohort membership, for retention. The visitor's first week is written
    // once (SET NX) and read back on every later event, so someone who returns
    // in week three is credited to the week they arrived rather than to now.
    if (e.visitorId) {
      const w = isoWeek();
      const key = K.firstSeen(e.visitorId);
      const isNew = await kvSetNx(key, w, 180 * 24 * 60 * 60);
      const cohort = isNew ? w : (await kvGet(key)) ?? w;
      await kvPfAdd(K.cohort(cohort), e.visitorId);
      await kvPfAdd(K.cohortActive(cohort, w), e.visitorId);
      await kvExpire(K.cohortActive(cohort, w), TTL);
    }

    if (e.email) {
      await kvSAdd(K.accounts(d), e.email.toLowerCase());
      await kvExpire(K.accounts(d), TTL);
    }

    if (e.path) {
      // Only the path, never the query string — a search query is the user's,
      // not ours.
      await kvZIncrBy(K.paths(d), e.path.split("?")[0].slice(0, 120));
      await kvExpire(K.paths(d), TTL);
    }
    if (e.ticker) {
      await kvZIncrBy(K.tickers(d), e.ticker.toUpperCase().slice(0, 20));
      await kvExpire(K.tickers(d), TTL);
    }

    // Lifetime totals for the two events that are milestones rather than
    // traffic. These do not expire: "how many people have ever gone Pro" is not
    // a 90-day question.
    if (e.kind === "pro") await kvIncr(K.proTotal);
    if (e.kind === "signup") await kvIncr(K.signupTotal);
  } catch {
    /* analytics must never break the thing it is measuring */
  }
}

// ── Reading it back ─────────────────────────────────────────────────────────

const lastDays = (n: number): string[] => {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    out.push(day(d));
  }
  return out;
};

export interface DayPoint {
  date: string;
  visitors: number;
  known: number;
  anon: number;
  visits: number;
  signins: number;
  pro: number;
}

export interface FunnelStep {
  kind: EventKind;
  label: string;
  /** Distinct visitors who reached this step in the window. */
  users: number;
  /** Share of the first step, i.e. the conversion rate to here. */
  ofStart: number;
  /** Share of the step before it, i.e. where the drop-off happens. */
  ofPrevious: number;
}

export interface CohortRow {
  week: string;
  size: number;
  /** Return rate by week offset: [1.0, w+1, w+2, …]. */
  retention: number[];
}

export interface UsageReport {
  configured: boolean;
  days: DayPoint[];
  totals: {
    /** Distinct visitors across the whole window — not the sum of the days. */
    visitors7: number;
    visitors30: number;
    known30: number;
    signins30: number;
    pro30: number;
    proAllTime: number;
    signupAllTime: number;
  };
  /** Accounts seen today and over the week, newest window first. */
  activeToday: string[];
  activeWeek: string[];
  topPaths: { member: string; score: number }[];
  topTickers: { member: string; score: number }[];
  /** The workflow, over 30 days and over 7. */
  funnel30: FunnelStep[];
  funnel7: FunnelStep[];
  /** Weekly cohorts, newest first. */
  cohorts: CohortRow[];
}

const numOf = (v: string | null): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export async function getUsageReport(): Promise<UsageReport> {
  if (!kvConfigured()) {
    return {
      configured: false,
      days: [],
      totals: {
        visitors7: 0, visitors30: 0, known30: 0, signins30: 0,
        pro30: 0, proAllTime: 0, signupAllTime: 0,
      },
      activeToday: [],
      activeWeek: [],
      topPaths: [],
      topTickers: [],
      funnel30: [],
      funnel7: [],
      cohorts: [],
    };
  }

  const d30 = lastDays(30);
  const d7 = d30.slice(0, 7);
  const today = d30[0];

  // Counters in one round trip each, rather than 150 separate GETs.
  const [visitCounts, signinCounts, proCounts, totals] = await Promise.all([
    kvMGet(d30.map((d) => K.count("visit", d))),
    kvMGet(d30.map((d) => K.count("signin", d))),
    kvMGet(d30.map((d) => K.count("pro", d))),
    kvMGet([K.proTotal, K.signupTotal]),
  ]);

  // PFCOUNT over several keys unions them, so a 30-day figure counts a person
  // once however many days they came — which is what "visitors" should mean.
  const [visitors30, visitors7, known30, perDay] = await Promise.all([
    kvPfCount(d30.map((d) => K.uniques("visit", d))),
    kvPfCount(d7.map((d) => K.uniques("visit", d))),
    kvPfCount(d30.map((d) => K.uniques("visitor:known", d))),
    Promise.all(
      d30.map(async (d) => ({
        date: d,
        visitors: await kvPfCount([K.uniques("visit", d)]),
        known: await kvPfCount([K.uniques("visitor:known", d)]),
        anon: await kvPfCount([K.uniques("visitor:anon", d)]),
      }))
    ),
  ]);

  const [activeToday, activeWeekLists, topPaths, topTickers] = await Promise.all([
    kvSMembers(K.accounts(today)),
    Promise.all(d7.map((d) => kvSMembers(K.accounts(d)))),
    kvZTop(K.paths(today), 12),
    kvZTop(K.tickers(today), 12),
  ]);

  // The funnel over each window. Every step is a union of that step's daily
  // HyperLogLogs, so a visitor counts once however many days they came.
  const buildFunnel = async (window: string[]): Promise<FunnelStep[]> => {
    const counts = await Promise.all(
      FUNNEL.map((s) => kvPfCount(window.map((d) => K.uniques(s.kind, d))))
    );
    const start = counts[0] || 0;
    return FUNNEL.map((s, i) => ({
      kind: s.kind,
      label: s.label,
      users: counts[i],
      ofStart: start > 0 ? counts[i] / start : 0,
      ofPrevious: i === 0 ? 1 : counts[i - 1] > 0 ? counts[i] / counts[i - 1] : 0,
    }));
  };

  const weeks: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i * 7);
    weeks.push(isoWeek(d));
  }
  const thisWeek = weeks[0];

  const [funnel30, funnel7, cohorts] = await Promise.all([
    buildFunnel(d30),
    buildFunnel(d7),
    Promise.all(
      weeks.map(async (w) => {
        const size = await kvPfCount([K.cohort(w)]);
        const offsets = Math.max(0, weeksBetween(w, thisWeek)) + 1;
        const retention = await Promise.all(
          Array.from({ length: Math.min(offsets, 6) }, async (_, k) => {
            const at = weeks[weeks.indexOf(w) - k];
            if (!at) return 0;
            const active = await kvPfCount([K.cohortActive(w, at)]);
            return size > 0 ? active / size : 0;
          })
        );
        return { week: w, size, retention };
      })
    ),
  ]);

  const days: DayPoint[] = d30.map((date, i) => ({
    date,
    visitors: perDay[i].visitors,
    known: perDay[i].known,
    anon: perDay[i].anon,
    visits: numOf(visitCounts[i]),
    signins: numOf(signinCounts[i]),
    pro: numOf(proCounts[i]),
  }));

  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

  return {
    configured: true,
    days,
    totals: {
      visitors7,
      visitors30,
      known30,
      signins30: sum(days.map((x) => x.signins)),
      pro30: sum(days.map((x) => x.pro)),
      proAllTime: numOf(totals[0]),
      signupAllTime: numOf(totals[1]),
    },
    activeToday,
    activeWeek: [...new Set(activeWeekLists.flat())],
    topPaths,
    topTickers,
    funnel30,
    funnel7,
    cohorts,
  };
}
