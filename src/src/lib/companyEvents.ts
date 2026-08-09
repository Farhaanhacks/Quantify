// Dated corporate events for the price chart, from public-domain sources only:
//
//   1. SEC Form 8-K item codes. Every 8-K names the material event it reports
//      using the SEC's own numbering (2.02 = results, 5.02 = officer change,
//      2.03 = new debt obligation, …). That numbering IS a maintained event
//      taxonomy, so we classify by looking up the code — we never guess a
//      category from headline text.
//   2. Yahoo's chart endpoint for dividends and splits, which it returns as
//      structured events alongside the price series.
//
// Scope: 8-K is filed by US domestic issuers. Foreign private issuers file 6-K,
// which carries no item codes, and non-US listings (.NS/.BO/…) aren't in EDGAR
// at all — those symbols get dividends/splits only. Anything we can't classify
// is dropped rather than bucketed into a guess.

import { politeFetch } from "@/lib/ingest/politeFetch";
import { loadCikMap } from "@/lib/insider";

const UA =
  process.env.EDGAR_USER_AGENT ||
  "Quantifi/1.0 (personal research app; quantifi-app@users.noreply.github.com)";

// The five lanes shown in the chart legend.
export type EventCategory = "Dividend" | "Financial" | "Management" | "Strategy" | "Other";

export interface CompanyEvent {
  /** ISO date (YYYY-MM-DD) the event was filed or paid. */
  date: string;
  category: EventCategory;
  /** Short lane label, e.g. "Earnings", "Debt Offering". */
  label: string;
  /** Longer description for the tooltip. */
  detail: string;
  /** The SEC item code this was classified from, e.g. "2.02". */
  item?: string;
  /** Link to the source filing, when there is one. */
  url?: string;
}

// SEC Form 8-K item codes → the category and label we show. Sourced from the
// Form 8-K instructions; codes absent from this table are genuinely unclassified
// and get dropped (9.01 "Exhibits", for instance, is bookkeeping, not an event).
const ITEM_MAP: Record<string, { category: EventCategory; label: string; detail: string }> = {
  // Section 1 — Business and operations
  "1.01": { category: "Strategy", label: "Material Agreement", detail: "Entered a material definitive agreement" },
  "1.02": { category: "Strategy", label: "Agreement Ended", detail: "Terminated a material definitive agreement" },
  "1.03": { category: "Financial", label: "Bankruptcy", detail: "Bankruptcy or receivership" },
  "1.05": { category: "Other", label: "Cybersecurity", detail: "Material cybersecurity incident" },
  // Section 2 — Financial information
  "2.01": { category: "Strategy", label: "Acquisition", detail: "Completed an acquisition or disposition of assets" },
  "2.02": { category: "Financial", label: "Earnings", detail: "Results of operations and financial condition" },
  "2.03": { category: "Financial", label: "Debt Offering", detail: "Created a direct financial obligation" },
  "2.04": { category: "Financial", label: "Obligation Triggered", detail: "Triggering event accelerating a financial obligation" },
  "2.05": { category: "Strategy", label: "Restructuring", detail: "Costs associated with exit or disposal activities" },
  "2.06": { category: "Financial", label: "Impairment", detail: "Material impairment" },
  // Section 3 — Securities and trading markets
  "3.01": { category: "Financial", label: "Listing Notice", detail: "Delisting notice or failure to satisfy a listing rule" },
  "3.02": { category: "Financial", label: "Equity Sale", detail: "Unregistered sale of equity securities" },
  "3.03": { category: "Financial", label: "Security Terms", detail: "Material modification to the rights of security holders" },
  // Section 4 — Accountants and financial statements
  "4.01": { category: "Financial", label: "Auditor Change", detail: "Change in the registrant's certifying accountant" },
  "4.02": { category: "Financial", label: "Restatement", detail: "Non-reliance on previously issued financial statements" },
  // Section 5 — Corporate governance and management
  "5.01": { category: "Management", label: "Control Change", detail: "Change in control of the registrant" },
  "5.02": { category: "Management", label: "Management Change", detail: "Director or principal officer appointment or departure" },
  "5.03": { category: "Management", label: "Bylaw Change", detail: "Amendment to articles of incorporation or bylaws" },
  "5.07": { category: "Management", label: "Shareholder Vote", detail: "Submission of matters to a vote of security holders" },
  // Section 7 / 8 — Disclosure
  "7.01": { category: "Other", label: "Guidance", detail: "Regulation FD disclosure" },
  "8.01": { category: "Other", label: "Company Update", detail: "Other events the registrant deems material" },
};

export const CATEGORY_COLOR: Record<EventCategory, string> = {
  Dividend: "#34D399",
  Financial: "#A78BFA",
  Management: "#4FD1C5",
  Strategy: "#F59E0B",
  Other: "#4F93F7",
};

interface Submissions {
  name?: string;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      form?: string[];
      /** Comma-separated 8-K item codes, e.g. "2.02,9.01". */
      items?: string[];
      primaryDocument?: string[];
    };
  };
}

// One filing can report several items (an earnings 8-K is usually "2.02,9.01").
// We keep the first code we can classify, so the marker names the substantive
// event rather than the exhibit list that accompanies it.
function classify(
  itemsField: string
): { category: EventCategory; label: string; detail: string; item: string } | null {
  const codes = itemsField
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);
  for (const code of codes) {
    const hit = ITEM_MAP[code];
    if (hit) return { ...hit, item: code };
  }
  return null;
}

async function get8kEvents(ticker: string, sinceMs: number): Promise<CompanyEvent[]> {
  // Any exchange-suffixed symbol is a non-US listing and cannot be in EDGAR.
  if (/\.[A-Z]{1,4}$/i.test(ticker)) return [];
  const map = await loadCikMap();
  const entry = map[ticker];
  if (!entry) return [];
  const cikInt = String(parseInt(entry.cik, 10));

  const res = await politeFetch(`https://data.sec.gov/submissions/CIK${entry.cik}.json`, {
    userAgent: UA,
    revalidateSeconds: 3600,
  });
  if (!res.ok) return [];
  const sub = (await res.json()) as Submissions;
  const rec = sub?.filings?.recent;
  if (!rec?.form || !rec.filingDate) return [];

  const out: CompanyEvent[] = [];
  for (let i = 0; i < rec.form.length; i++) {
    if (rec.form[i] !== "8-K") continue;
    const date = rec.filingDate[i];
    if (!date || Date.parse(date) < sinceMs) continue;
    const hit = classify(rec.items?.[i] ?? "");
    if (!hit) continue; // unclassified codes are dropped, never bucketed as a guess
    const accNo = rec.accessionNumber?.[i];
    const doc = rec.primaryDocument?.[i];
    out.push({
      date,
      category: hit.category,
      label: hit.label,
      detail: hit.detail,
      item: hit.item,
      url:
        accNo && doc
          ? `https://www.sec.gov/Archives/edgar/data/${cikInt}/${accNo.replace(/-/g, "")}/${doc}`
          : undefined,
    });
  }
  return out;
}

interface YahooEvents {
  chart?: {
    result?: {
      events?: {
        dividends?: Record<string, { amount?: number; date?: number }>;
        splits?: Record<string, { date?: number; numerator?: number; denominator?: number; splitRatio?: string }>;
      };
    }[];
  };
}

const iso = (epochSeconds: number) => new Date(epochSeconds * 1000).toISOString().slice(0, 10);

// Dividends and splits come back as structured events on the chart endpoint —
// real amounts and real dates, not parsed out of prose.
async function getCorporateActions(symbol: string, range: string): Promise<CompanyEvent[]> {
  try {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?range=${encodeURIComponent(range)}&interval=1d&events=div%7Csplit`;
    const r = await politeFetch(url, {
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      revalidateSeconds: 21600,
      timeoutMs: 8000,
    });
    if (!r.ok) return [];
    const j = (await r.json()) as YahooEvents;
    const ev = j?.chart?.result?.[0]?.events;
    const out: CompanyEvent[] = [];

    for (const d of Object.values(ev?.dividends ?? {})) {
      if (typeof d?.date !== "number") continue;
      out.push({
        date: iso(d.date),
        category: "Dividend",
        label: "Dividend",
        detail: typeof d.amount === "number" ? `Dividend of ${d.amount} per share` : "Dividend",
      });
    }
    for (const s of Object.values(ev?.splits ?? {})) {
      if (typeof s?.date !== "number") continue;
      const ratio = s.splitRatio || (s.numerator && s.denominator ? `${s.numerator}:${s.denominator}` : "");
      out.push({
        date: iso(s.date),
        category: "Financial",
        label: "Stock Split",
        detail: ratio ? `Stock split ${ratio}` : "Stock split",
      });
    }
    return out;
  } catch {
    return [];
  }
}

// How far back each chart range needs events for.
const RANGE_DAYS: Record<string, number> = {
  "1mo": 31,
  "3mo": 93,
  "6mo": 186,
  "1y": 366,
  "3y": 1096,
  "5y": 1827,
  max: 3650,
};

export async function getCompanyEvents(symbol: string, range = "1y"): Promise<CompanyEvent[]> {
  const t = symbol.toUpperCase();
  const days = RANGE_DAYS[range] ?? 366;
  const sinceMs = Date.now() - days * 86_400_000;

  // Either source failing just means fewer markers — never a broken chart.
  const [filings, actions] = await Promise.all([
    get8kEvents(t, sinceMs).catch(() => [] as CompanyEvent[]),
    getCorporateActions(t, range).catch(() => [] as CompanyEvent[]),
  ]);

  return [...filings, ...actions]
    .filter((e) => Date.parse(e.date) >= sinceMs)
    .sort((a, b) => a.date.localeCompare(b.date));
}
