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

import { kvConfigured, kvRPush, kvLRange, kvLTrim, kvClaim } from "@/lib/kv";

// Whether there is anywhere to record history at all. Without the KV
// environment variables every write below is a silent no-op, and the series
// stays empty forever — which is indistinguishable, from the outside, from a
// company whose history simply started today. The UI needs to tell those two
// apart so it stops promising a chart that can never arrive.
export const fairValueHistoryConfigured = kvConfigured;

export interface FairValuePoint {
  /** ISO date, YYYY-MM-DD. */
  d: string;
  /** Intrinsic value per share on that date. */
  v: number;
  /** Share price on that date, so the two can be charted together. */
  p: number;
  /**
   * Which model produced it — "dcf", "excess-returns" or "pb".
   *
   * Stored per point because the model is no longer the same for every company.
   * A series that silently mixes a bank's old discounted-cash-flow numbers with
   * its new excess-return ones is a chart of our own bugs, not of the company:
   * HDFC Bank's stored ₹3,171.55 came from a cash-flow model that should never
   * have run on it. Absent on points written before methods were recorded.
   */
  m?: string;
  /** Model revision, so an old point can be identified and dropped. */
  mv?: string;
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
  price: number,
  method?: string,
  modelVersion?: string
): Promise<void> {
  if (!kvConfigured() || !isTicker(ticker)) return;
  if (!(value > 0) || !(price > 0)) return;
  const today = new Date().toISOString().slice(0, 10);
  try {
    // Claim the day first. Only the caller that wins the claim writes, so the
    // common path (every other request today) is a single round trip and we
    // never pull the whole series back just to check the last date.
    // Two days of TTL so a late-UTC write can't be re-run by an early one.
    const first = await kvClaim(`${key(ticker)}:${today}`, 2 * 24 * 60 * 60);
    if (!first) return; // already recorded today
    // Once a day, and only for a company whose model has changed, drop what a
    // superseded model wrote before adding to it.
    if (method) await purgeSupersededFairValue(ticker, method);
    await kvRPush(
      key(ticker),
      JSON.stringify({ d: today, v: value, p: price, m: method, mv: modelVersion })
    );
    // Keeps the newest MAX_POINTS; a no-op while the list is shorter than that,
    // so it needs no separate length check.
    await kvLTrim(key(ticker), -MAX_POINTS, -1);
  } catch {
    /* history is best-effort */
  }
}

/**
 * Throw away a stored series that a superseded model wrote.
 *
 * Needed because the fix to the bank valuation does not fix what is already in
 * the database. HDFC Bank has ₹3,171.55 recorded against real dates: leave those
 * in and the chart still draws the wrong answer for as long as the points live,
 * with today's correct value dropping onto the end of a line built from the bug.
 *
 * Deliberately narrow. It only fires when the CURRENT method for a company is
 * not the one its stored points were written by, so a company whose model hasn't
 * changed keeps every point it has accumulated — that history is real and cannot
 * be rebuilt, and wiping every series to fix banks would be a far bigger loss
 * than the bug. An unstamped point predates the stamping, when the only model
 * that ran was the cash-flow one, so it counts as "dcf": a company still valued
 * that way keeps its history, and a bank — now valued on excess returns — does
 * not.
 *
 * Returns true if anything was cleared.
 */
export async function purgeSupersededFairValue(
  ticker: string,
  currentMethod: string
): Promise<boolean> {
  if (!kvConfigured() || !isTicker(ticker)) return false;
  try {
    const rows = parse(await kvLRange(key(ticker), 0, -1));
    if (!rows.length) return false;
    if (rows.every((p) => (p.m ?? "dcf") === currentMethod)) return false;
    // LTRIM with start > stop empties the list — the only delete this KV
    // wrapper exposes, and the right one here: a series written by a model we
    // have withdrawn has no salvageable part.
    await kvLTrim(key(ticker), 1, 0);
    return true;
  } catch {
    return false;
  }
}
