// The arithmetic behind the market pages, kept apart from the fetching.
//
// No imports, on purpose: everything here is numbers in, numbers out, so
// scripts/test-market-math.mjs can compile and run it directly. The functions
// that used to live inside the aggregator and inside the React component could
// not be exercised at all — they sat behind a network call and a browser — and
// the two things most likely to be silently wrong (a percentage in the wrong
// unit, a window measured from the wrong day) are exactly the things that look
// completely plausible on screen.

export interface Point {
  /** YYYY-MM-DD. */
  time: string;
  value: number;
}

/**
 * Cap-weighted mean of a field, ignoring rows that don't report it.
 *
 * Returns the count as well as the value so a caller can refuse to publish an
 * average that only two of forty companies actually contributed to.
 */
export function weightedMean<T>(
  rows: T[],
  value: (r: T) => number | undefined,
  weight: (r: T) => number
): { value: number | undefined; n: number } {
  let num = 0;
  let den = 0;
  let n = 0;
  for (const r of rows) {
    const v = value(r);
    const w = weight(r);
    if (v == null || !isFinite(v) || !(w > 0)) continue;
    num += v * w;
    den += w;
    n++;
  }
  return den > 0 ? { value: num / den, n } : { value: undefined, n: 0 };
}

/**
 * Aggregate P/E, the way an index computes one: total market value over total
 * earnings.
 *
 * NOT the average of the companies' P/E ratios. That average is dominated by
 * whichever company is closest to breaking even — a name on 400x earnings adds
 * 400 to the mean and a rounding error to the market's actual earnings — and it
 * is how a market of ordinary businesses ends up reading as "60x". Loss-makers
 * are excluded rather than counted as zero earnings, which would divide by zero
 * and make the whole market's ratio infinite.
 */
export function aggregatePE(rows: { marketCap: number; pe?: number }[]): number | undefined {
  let cap = 0;
  let earnings = 0;
  for (const r of rows) {
    if (r.pe == null || !isFinite(r.pe) || r.pe <= 0 || !(r.marketCap > 0)) continue;
    cap += r.marketCap;
    earnings += r.marketCap / r.pe;
  }
  if (!(earnings > 0) || !(cap > 0)) return undefined;
  const pe = cap / earnings;
  return isFinite(pe) && pe > 0 && pe < 500 ? pe : undefined;
}

/**
 * A company's 52-week return, in percent, derived rather than trusted.
 *
 * Yahoo's quote feed carries both an absolute 52-week change and a percentage
 * one, and the percentage field's UNIT is not consistent across Yahoo's
 * endpoints — some return 0.234, others 23.4. Reading it wrong is not a subtle
 * error: it is a market shown as up 0.2% in a year it rose 23%, or up 2,340%.
 *
 * So the percentage is computed from the two absolute numbers, which cannot be
 * misread — price minus change is the price a year ago, by definition. The
 * reported percentage is only a fallback, and only when it is in a range a
 * percentage could plausibly be.
 */
export function yearChangePct(q: {
  price?: number;
  fiftyTwoWeekChange?: number;
  fiftyTwoWeekChangePercent?: number;
}): number | undefined {
  const { price, fiftyTwoWeekChange: abs, fiftyTwoWeekChangePercent: pctField } = q;
  if (price != null && abs != null && isFinite(price) && isFinite(abs)) {
    const before = price - abs;
    if (before > 0) {
      const v = (abs / before) * 100;
      if (isFinite(v) && Math.abs(v) < 1000) return v;
    }
  }
  if (pctField != null && isFinite(pctField)) {
    // A bare fraction (|x| ≤ 3) would be a market that moved at most 300%, which
    // is far likelier to be a fraction than a 3% year written as 3. Both
    // readings are guesses at this point, which is why this branch is last.
    const v = Math.abs(pctField) <= 3 ? pctField * 100 : pctField;
    if (Math.abs(v) < 1000) return v;
  }
  return undefined;
}

/**
 * Closing prices per symbol from Yahoo's batched "spark" response.
 *
 * Two shapes exist in the wild for the same data and Yahoo serves either
 * depending on the endpoint version: a flat map keyed by symbol, and a
 * chart-style envelope with the closes nested under indicators. Both are
 * accepted, because guessing wrong here does not fail loudly — it returns
 * nothing for every company and the page quietly reports a market with no
 * sectors in it.
 *
 * Anything unrecognised yields an empty map rather than a partial one, so a
 * caller can tell "the shape changed" from "these companies have no history".
 */
export function parseSparkPayload(json: unknown): Map<string, number[]> {
  const out = new Map<string, number[]>();
  if (!json || typeof json !== "object") return out;

  const closesOf = (v: unknown): number[] => {
    if (!v || typeof v !== "object") return [];
    const o = v as Record<string, unknown>;
    // Flat shape: { close: [...] }
    if (Array.isArray(o.close)) {
      return (o.close as unknown[]).filter((c): c is number => typeof c === "number" && isFinite(c));
    }
    // Envelope shape: { response: [ { indicators: { quote: [ { close: [...] } ] } } ] }
    const response = Array.isArray(o.response) ? (o.response[0] as Record<string, unknown>) : undefined;
    const indicators = response?.indicators as { quote?: { close?: unknown[] }[] } | undefined;
    const close = indicators?.quote?.[0]?.close;
    if (Array.isArray(close)) {
      return close.filter((c): c is number => typeof c === "number" && isFinite(c));
    }
    return [];
  };

  const root = json as Record<string, unknown>;
  const spark = root.spark as { result?: unknown[] } | undefined;
  const rows = Array.isArray(spark?.result) ? (spark!.result as Record<string, unknown>[]) : null;

  if (rows) {
    for (const r of rows) {
      const symbol = typeof r.symbol === "string" ? r.symbol.toUpperCase() : undefined;
      if (!symbol) continue;
      const closes = closesOf(r);
      if (closes.length >= 2) out.set(symbol, closes);
    }
    return out;
  }

  for (const [key, v] of Object.entries(root)) {
    if (!v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const symbol = (typeof o.symbol === "string" ? o.symbol : key).toUpperCase();
    const closes = closesOf(o);
    if (closes.length >= 2) out.set(symbol, closes);
  }
  return out;
}

/** Return across a whole close series, in percent. */
export function seriesReturnPct(closes: number[]): number | undefined {
  if (closes.length < 2) return undefined;
  const first = closes[0];
  const last = closes[closes.length - 1];
  if (!(first > 0) || !(last > 0)) return undefined;
  const v = ((last - first) / first) * 100;
  // A price series that implies a 100x move over the window is a split the feed
  // hasn't adjusted, not a return anyone should be shown.
  return isFinite(v) && Math.abs(v) < 10000 ? v : undefined;
}

/**
 * Symbols per batched price-series request.
 *
 * TEN, and the number matters: the upstream answers a small symbol list and
 * returns NOTHING for a large one — no error, no partial result, an empty body.
 * India's 56 companies went out as chunks of 50 and 6, the 6 came back, and the
 * page drew the two sectors that happened to fall in that tail as though they
 * were the market. A silent cap is the worst kind, so this stays well under
 * whatever it actually is.
 */
export const SPARK_SYMBOL_LIMIT = 10;

/**
 * Run async tasks with a bounded number in flight, returning results in the
 * order the tasks were given.
 *
 * Written out rather than reached for from a library because the failure it
 * guards against is the one this whole area keeps hitting: a batch that quietly
 * does not run costs a whole sector, not a row.
 */
export async function pooled<T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> {
  const out: T[] = new Array(tasks.length);
  let next = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= tasks.length) return;
      out[i] = await tasks[i]();
    }
  });
  await Promise.all(workers);
  return out;
}

/** Split a list into chunks of at most `size`, losing and duplicating nothing. */
export function chunk<T>(list: T[], size: number): T[][] {
  const n = Math.max(1, Math.floor(size));
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += n) out.push(list.slice(i, i + n));
  return out;
}

const DAY_MS = 86400000;

/**
 * Return over a trailing window, as a percentage, or undefined when the series
 * cannot honestly answer for that window.
 *
 * Two guards, and both have bitten:
 *
 *   • The start point is the first one ON OR AFTER the cutoff. Taking the last
 *     point before it instead would quietly lengthen the window, because
 *     markets are shut on plenty of the days you might ask about.
 *   • If the series does not reach back far enough, there is no answer. A "1
 *     year" figure computed from eight months of history is not a cautious
 *     estimate, it is a different number with the wrong label on it.
 *
 * The second guard carries slack, scaled to the window. A one-year series from
 * the upstream begins almost exactly 365 days ago, so demanding a point strictly
 * on or before the cutoff blanks the 1Y reading whenever that day was a weekend
 * — which is most weeks.
 */
export function returnOver(points: Point[], days: number): number | undefined {
  if (points.length < 2 || days <= 0) return undefined;
  const last = points[points.length - 1];
  const end = Date.parse(last.time);
  if (!isFinite(end)) return undefined;
  const cutoff = end - days * DAY_MS;
  const iso = new Date(cutoff).toISOString().slice(0, 10);

  const start = points.find((p) => p.time >= iso);
  if (!start || start === last || !(start.value > 0)) return undefined;

  const slack = Math.max(3, days * 0.04) * DAY_MS;
  if (Date.parse(points[0].time) > cutoff + slack) return undefined;

  return ((last.value - start.value) / start.value) * 100;
}

/** Return since the first trading day of the last point's calendar year. */
export function ytdReturn(points: Point[]): number | undefined {
  if (points.length < 2) return undefined;
  const last = points[points.length - 1];
  const jan = `${last.time.slice(0, 4)}-01-01`;
  // No slack here: the year's start is a fixed date, and a series that begins in
  // March cannot report a year-to-date figure.
  if (points[0].time > jan) return undefined;
  const start = points.find((p) => p.time >= jan);
  if (!start || start === last || !(start.value > 0)) return undefined;
  return ((last.value - start.value) / start.value) * 100;
}
