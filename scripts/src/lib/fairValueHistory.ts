// A record of what the cash-flow (DCF) value has been over time, alongside the
// share price on the same day.
//
// This has to accumulate — it cannot be back-filled. The estimate depends on the
// fundamentals, beta and rates that were current on a given date, and we do not
// hold historical snapshots of those. Reconstructing a past "fair value" from
// today's inputs would produce a line that looks like history but is really just
// today's model drawn backwards, which is exactly the kind of fabricated series
// this codebase refuses to show. So: one point per ticker per day, written when
// a score is computed, and an honest "history starts here" state until there are
// enough points to draw.

import { kvConfigured, kvRPush, kvLRange, kvLTrim } from "@/lib/kv";

export interface FairValuePoint {
  /** ISO date, YYYY-MM-DD. */
  d: string;
  /** Cash-flow (DCF) value per share on that date. */
  v: number;
  /** Share price on that date, so the two can be charted together. */
  p: number;
}

// Roughly two years of daily points. Beyond that the early history says more
// about old model versions than about the company.
const MAX_POINTS = 750;

const key = (ticker: string) => `quantifi:fvhist:${ticker.toUpperCase()}`;

// Only a plausible ticker may become a key. The symbol reaches here from a URL
// path, and while the prefix means it can't escape its namespace, an unbounded
// set of arbitrary keys is still someone else's storage bill.
// Leading ^ is legitimate — Yahoo indices are ^GSPC, ^NSEI, ^BSESN.
const TICKER_RE = /^[A-Z0-9^][A-Z0-9.\-=^]{0,14}$/;
const isTicker = (t: string) => TICKER_RE.test(t.toUpperCase());

function parse(rows: string[]): FairValuePoint[] {
  const out: FairValuePoint[] = [];
  for (const r of rows) {
    try {
      const p = JSON.parse(r) as FairValuePoint;
      if (typeof p?.d === "string" && typeof p.v === "number" && typeof p.p === "number") {
        out.push(p);
      }
    } catch {
      /* skip a malformed row rather than failing the whole series */
    }
  }
  return out.sort((a, b) => a.d.localeCompare(b.d));
}

export async function getFairValueHistory(ticker: string): Promise<FairValuePoint[]> {
  if (!kvConfigured() || !isTicker(ticker)) return [];
  try {
    return parse(await kvLRange(key(ticker), 0, -1));
  } catch {
    return [];
  }
}

// Append today's estimate, at most once per ticker per day. Called from the
// score route after a valuation is computed; failure is silent because a missing
// history point must never break the page that produced it.
export async function recordFairValue(
  ticker: string,
  value: number,
  price: number
): Promise<void> {
  if (!kvConfigured() || !isTicker(ticker)) return;
  if (!(value > 0) || !(price > 0)) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    const existing = await getFairValueHistory(ticker);
    if (existing.some((p) => p.d === today)) return; // already recorded today
    await kvRPush(key(ticker), JSON.stringify({ d: today, v: value, p: price }));
    if (existing.length + 1 > MAX_POINTS) {
      await kvLTrim(key(ticker), -MAX_POINTS, -1);
    }
  } catch {
    /* history is best-effort */
  }
}
