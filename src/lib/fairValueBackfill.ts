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
import {
  cashflowValuePerShare,
  pickBaseCashflow,
  cashflowGrowthFrom,
} from "@/lib/yahooFundamentals";
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

// Why a reconstruction produced nothing, in terms the panel can show. Guessing
// at this from an empty chart is exactly the dead end this whole section kept
// putting people in.
export type BackfillReason =
  | "ok"
  | "no-statements"
  | "no-prices"
  | "cash-negative"
  | "too-few";

export function backfillWithReason(
  data: CompanyData,
  closes: Close[]
): { points: BackfillPoint[]; reason: BackfillReason } {
  if ((data.cashflowStatements ?? []).filter((r) => r.date).length < 2)
    return { points: [], reason: "no-statements" };
  if (!closes.length) return { points: [], reason: "no-prices" };
  const points = backfillFairValue(data, closes);
  if (points.length === 0) return { points, reason: "cash-negative" };
  if (points.length < 2) return { points, reason: "too-few" };
  return { points, reason: "ok" };
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
  // Expanding windows: each year is valued on the cash-flow record available up
  // to and including itself, never on years that had not happened yet.
  const fcfSoFar: number[] = [];
  const ocfSoFar: number[] = [];
  const capexSoFar: number[] = [];

  for (const row of rows) {
    const fcf = fcfOf(row.values);
    const ocf = row.values.operatingCashFlow;
    // The live model subtracts capex, and Yahoo reports it negative, so flip it
    // to a positive spend before handing it over.
    const capex = row.values.capex;
    if (fcf != null) fcfSoFar.push(fcf);
    if (ocf != null) ocfSoFar.push(ocf);
    if (capex != null) capexSoFar.push(Math.abs(capex));

    // Two years minimum before a point means anything: a single year is not a
    // cycle, and growth cannot be measured from it.
    if (fcfSoFar.length < 2 && ocfSoFar.length < 2) continue;

    const date = row.date!.slice(0, 10);
    const price = priceOn(closes, date);
    if (price == null) continue;

    // Exactly the base the live score would pick from this record: the
    // through-cycle blend, falling back to normalised owner earnings when free
    // cash flow is negative across the cycle. Using raw single-year free cash
    // flow here produced no points at all for any capital-heavy company — the
    // investment years are negative and the DCF rejects them.
    const base = pickBaseCashflow(fcfSoFar, ocfSoFar, capexSoFar);
    if (base == null) continue;
    const growth = cashflowGrowthFrom(ocfSoFar, fcfSoFar);
    // Years whose growth cannot be measured are skipped rather than valued on
    // the model's default: a 25%-growth name opened at a third of the next
    // year's value and the line jumped, describing the fallback and not the
    // company. Cyclicals are exempt — they're valued at the terminal rate.
    if (growth == null && !cyclical) continue;

    const v = cashflowValuePerShare({
      fcf: base,
      shares,
      growth,
      currency,
      beta: data.beta,
      cyclical,
    });
    if (v == null) continue;
    // The same sanity band the live score applies — reject a unit mismatch
    // rather than plotting a value 100x the share price.
    if (!(v >= price * 0.02 && v <= price * 25)) continue;
    out.push({ d: date, v, p: price, modelled: true });
  }

  return out;
}
