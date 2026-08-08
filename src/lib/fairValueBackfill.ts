// Reconstructs the cash-flow value line for the years BEFORE the daily recorder
// started, so a company that has only just been opened does not sit on an empty
// chart until enough days have accrued.
//
// What is genuinely historical here, and what is not — this matters, because the
// section previously refused to draw anything at all rather than imply more than
// it knew:
//
//   Real, as reported for each year:  free cash flow, and the share price on the
//                                     day the year closed.
//   Held at today's value:            share count, beta, the local bond rate and
//                                     the equity risk premium.
//
// So each point answers "what does the model say that year's cash flow was
// worth", not "what would the model have printed that year". That is a fair
// back-test and a genuinely useful shape to look at, but it is not a recorded
// observation, and the API marks these points `modelled: true` so the chart can
// draw them differently and say so. Recorded points always win where both exist.

import type { CompanyData } from "@/lib/yahooCompany";
import { cashflowValuePerShare } from "@/lib/yahooFundamentals";
import type { FairValuePoint } from "@/lib/fairValueHistory";

export interface BackfillPoint extends FairValuePoint {
  modelled: true;
}

interface Close {
  d: string; // YYYY-MM-DD
  c: number;
}

// Monthly closes for the last 5 years. Monthly is the right granularity: the
// points we need are annual statement dates, and a monthly series is a fraction
// of the payload of a daily one.
export async function monthlyCloses(symbol: string): Promise<Close[]> {
  for (const host of ["query1", "query2"]) {
    try {
      const url = `https://${host}.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
        symbol
      )}?range=5y&interval=1mo`;
      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
          Accept: "application/json",
        },
        next: { revalidate: 86400 },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const json = (await res.json()) as {
        chart?: {
          result?: {
            timestamp?: number[];
            indicators?: { quote?: { close?: (number | null)[] }[] };
          }[];
        };
      };
      const r = json?.chart?.result?.[0];
      const ts = r?.timestamp ?? [];
      const closes = r?.indicators?.quote?.[0]?.close ?? [];
      const out: Close[] = [];
      for (let i = 0; i < ts.length; i++) {
        const c = closes[i];
        if (typeof c === "number" && isFinite(c) && c > 0) {
          out.push({ d: new Date(ts[i] * 1000).toISOString().slice(0, 10), c });
        }
      }
      if (out.length) return out;
    } catch {
      /* try the other host */
    }
  }
  return [];
}

// Closing price on or just before a date. Statement dates are fiscal year ends,
// which are frequently weekends or holidays, so an exact match is the exception.
function priceOn(closes: Close[], date: string): number | undefined {
  let best: Close | undefined;
  for (const c of closes) {
    if (c.d <= date && (!best || c.d > best.d)) best = c;
  }
  // Nothing before it means the price series starts after this statement —
  // don't reach forward for a later price and call it that year's.
  return best?.c;
}

function fcfOf(v: Record<string, number | undefined>): number | undefined {
  if (v.freeCashFlow != null) return v.freeCashFlow;
  // capex is reported negative, so this is a sum rather than a difference.
  if (v.operatingCashFlow != null && v.capex != null) return v.operatingCashFlow + v.capex;
  return undefined;
}

// Compound annual growth between the first and last of a run of yearly figures.
// Undefined unless both ends are positive — one loss-making year would otherwise
// produce a nonsense rate.
function cagrOf(vals: number[]): number | undefined {
  if (vals.length < 2) return undefined;
  const a = vals[0];
  const b = vals[vals.length - 1];
  const years = vals.length - 1;
  if (!(a > 0) || !(b > 0) || years < 1) return undefined;
  const g = Math.pow(b / a, 1 / years) - 1;
  return isFinite(g) ? g : undefined;
}

export function backfillFairValue(data: CompanyData, closes: Close[]): BackfillPoint[] {
  const rows = (data.cashflowStatements ?? [])
    .filter((r) => r.date)
    .slice()
    .sort((a, b) => (a.date! < b.date! ? -1 : 1)); // oldest → newest
  if (rows.length < 2) return [];

  const shares = data.sharesOutstanding;
  const currency = data.financialCurrency ?? data.currency;
  const sector = (data.sector ?? "").toLowerCase();
  // Same carve-out the live model makes: commodity producers don't compound, so
  // valuing them off a peak year's growth is what invents a fantasy number.
  const cyclical = sector.includes("basic materials") || sector.includes("energy");

  const out: BackfillPoint[] = [];
  const fcfSoFar: number[] = [];

  for (const row of rows) {
    const fcf = fcfOf(row.values);
    if (fcf != null) fcfSoFar.push(fcf);
    const date = row.date!.slice(0, 10);
    const price = priceOn(closes, date);
    // Growth is measured only from years up to and including this one, so an
    // early point is never valued using cash flows that had not happened yet.
    const growth = cagrOf(fcfSoFar);
    // The earliest year has nothing behind it to measure growth against, and
    // letting the model fall back to its default 5% put a point on the chart
    // that said more about the fallback than the company — a 25%-growth name
    // opened at a third of its next year's value and the line jumped. If the
    // growth can't be measured for a year, that year doesn't get a point.
    // Cyclicals are exempt: they're valued at the terminal rate, not on growth.
    if (growth == null && !cyclical) continue;
    const v = cashflowValuePerShare({ fcf, shares, growth, currency, beta: data.beta, cyclical });
    if (v == null || price == null) continue;
    // The same sanity band the live score applies — reject a unit mismatch
    // rather than plotting a value 100x the share price.
    if (!(v >= price * 0.02 && v <= price * 25)) continue;
    out.push({ d: date, v, p: price, modelled: true });
  }

  return out;
}
