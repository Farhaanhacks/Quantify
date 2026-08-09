// A small, fixed example book used ONLY to preview the portfolio modules for a
// visitor who hasn't added any holdings yet. Every surface that renders these
// figures must label them as a sample (see `SamplePreview` in Cards) — they are
// illustrative, not live quotes, and must never be mixed into a real portfolio's
// totals.
//
// The numbers are deliberately round and static so nobody mistakes them for a
// live feed, while still being plausible enough that the layout reads normally.

export interface SampleHolding {
  ticker: string;
  name: string;
  sector: string;
  region: string;
  shares: number;
  avgCost: number;
  price: number;
  currency: string;
  dayPct: number;
  spark: number[];
}

// A gentle synthetic series for the preview sparkline — a drift with a little
// noise, ending at `end`. Deterministic (no Math.random) so server and client
// render byte-identical markup.
function series(start: number, end: number, points = 32): number[] {
  const out: number[] = [];
  for (let i = 0; i < points; i++) {
    const t = i / (points - 1);
    const wobble = Math.sin(i * 0.9) * (Math.abs(end - start) * 0.06);
    out.push(Number((start + (end - start) * t + wobble).toFixed(2)));
  }
  return out;
}

export const SAMPLE_HOLDINGS: SampleHolding[] = [
  {
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    sector: "Technology",
    region: "United States",
    shares: 40,
    avgCost: 98.4,
    price: 126.5,
    currency: "USD",
    dayPct: 1.84,
    spark: series(104, 126.5),
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corporation",
    sector: "Technology",
    region: "United States",
    shares: 18,
    avgCost: 372.1,
    price: 421.8,
    currency: "USD",
    dayPct: 0.42,
    spark: series(398, 421.8),
  },
  {
    ticker: "JPM",
    name: "JPMorgan Chase & Co.",
    sector: "Financials",
    region: "United States",
    shares: 26,
    avgCost: 188.5,
    price: 202.3,
    currency: "USD",
    dayPct: -0.61,
    spark: series(207, 202.3),
  },
  {
    ticker: "XOM",
    name: "Exxon Mobil Corporation",
    sector: "Energy",
    region: "United States",
    shares: 55,
    avgCost: 108.2,
    price: 114.9,
    currency: "USD",
    dayPct: -1.12,
    spark: series(118, 114.9),
  },
  {
    ticker: "RELIANCE.NS",
    name: "Reliance Industries",
    sector: "Energy",
    region: "India",
    shares: 120,
    avgCost: 2650,
    price: 2894,
    currency: "INR",
    dayPct: 0.95,
    spark: series(2740, 2894),
  },
];

// Sample USD/INR used to normalise the mixed-currency preview totals. Static on
// purpose — the preview never calls the FX endpoint.
export const SAMPLE_USDINR = 83.5;
