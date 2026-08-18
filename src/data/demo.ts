// ─────────────────────────────────────────────────────────────────────────────
// Quantifi — shared types & formatters
// This file holds the core shared TYPES and formatting helpers used across the
// app (the Quantifi Score model, the CompanyAnalytics shape, number formatters).
// It no longer contains any demo/sample market data: all prices, charts, index
// values and quotes are fetched live, and where a live source has nothing we
// show "not available" rather than a placeholder. Nothing here is advice.
// ─────────────────────────────────────────────────────────────────────────────

export type MarketRegion = "Global" | "India" | "US";
export type Direction = "up" | "down" | "flat";

// The thematic research library lives in ./ideas (richer model). Re-export so
// existing `@/data/demo` imports keep working.
export type { TradingIdea } from "./ideas";
export { ideaCategories, tradingIdeas } from "./ideas";

// ── Quantifi Score + Fair Value (Simply Wall St-inspired, original model) ────
// Five fundamental axes, each scored 0–6 from a checklist. Educational only.

export type ScoreAxisKey = "value" | "growth" | "past" | "health" | "dividends";

export const SCORE_AXES: {
  key: ScoreAxisKey;
  label: string;
  short: string; // radar / compact label
  question: string; // the main thesis question for this axis
}[] = [
  { key: "value", label: "Valuation Comfort", short: "Valuation", question: "Can earnings grow fast enough to justify the multiple?" },
  { key: "growth", label: "Growth Durability", short: "Growth", question: "Is the growth durable, or is it already slowing?" },
  { key: "past", label: "Profitability Quality", short: "Quality", question: "Does the business earn high-quality, durable profits?" },
  { key: "health", label: "Balance Sheet Strength", short: "Balance", question: "Could the balance sheet absorb a downturn?" },
  { key: "dividends", label: "Capital Allocation", short: "Capital", question: "Is capital returned to shareholders, and is it sustainable?" },
];

// A qualitative read for an axis score (0–6) — so the scorecard reads like
// analysis ("Demanding", "Durable") rather than a binary tick.
export function axisLabel(key: ScoreAxisKey, score: number): string {
  const band = score >= 5 ? 3 : score >= 3 ? 2 : score >= 1 ? 1 : 0;
  const M: Record<ScoreAxisKey, [string, string, string, string]> = {
    value: ["Priced for perfection", "Demanding", "Fair", "Attractive"],
    growth: ["Unproven", "Soft", "Slowing", "Durable"],
    past: ["Unprofitable", "Weak", "Mixed", "Strong"],
    health: ["Fragile", "Stretched", "Manageable", "Strong"],
    dividends: ["No payout", "Light", "Mixed", "Shareholder-friendly"],
  };
  return M[key][band];
}

export interface ScoreCheck {
  label: string;
  pass: boolean;
}

export interface ScoreAxis {
  score: number; // 0–6
  checks: ScoreCheck[];
}

export interface CompanyAnalytics {
  ticker: string;
  scores: Record<ScoreAxisKey, ScoreAxis>;
  fairValue: { estimate: number; method: string; note: string };
  // The intrinsic value per share, and the model that produced it.
  //
  // Method-aware on purpose. A single "cashflowValue" field forced one model on
  // every company, which is how a bank ended up with a discounted-cash-flow
  // number: a lender's free cash flow is an accounting artefact (lending growth
  // is an operating outflow), so the DCF was valuing something that doesn't
  // exist. Financials are valued on excess returns over their cost of equity,
  // with price-to-book as the fallback, and `method` says which ran.
  //
  // `outOfRange` marks a company whose market multiple is far beyond anything a
  // 10-year model can span (a hyper-growth compounder). The estimate is still
  // shown, but as context rather than an over/under verdict — see CompanySnapshot.
  intrinsicValue?: {
    estimate: number;
    method: "dcf" | "excess-returns" | "pb";
    /** Display name of the model — shown on the card, stored with history. */
    methodLabel: string;
    /** Which revision of the models produced it, so stale points are findable. */
    modelVersion: string;
    note: string;
    outOfRange?: boolean;
    debug?: Record<string, unknown>;
  };
  // The DISCOUNTED-CASH-FLOW value specifically, and nothing else. Undefined for
  // any company the cash-flow model doesn't apply to (every financial
  // institution), which is what keeps screeners and rankings — all of which read
  // this field — from ordering banks by a model that was never valid for them.
  // Prefer `intrinsicValue` for display.
  cashflowValue?: {
    estimate: number;
    note: string;
    outOfRange?: boolean;
    /** The inputs behind the estimate — for diagnosing a surprising number. */
    debug?: Record<string, unknown>;
  };
  // Optional sector-appropriate valuation (SaaS→EV/Sales, banks→P/B,
  // telecom/infra→EV/EBITDA, real-estate/commodities→NAV, else→P/E).
  sectorValuation?: {
    sector: string;
    method: string;
    metricLabel: string;
    estimate: number;
    valueLabel: string;
    tag: string;
    tagUnder: boolean;
    showBar: boolean;
    note: string;
  };
  rewards: string[];
  riskFlags: string[];
}

export const overallScore = (a: CompanyAnalytics): number =>
  SCORE_AXES.reduce((sum, axis) => sum + a.scores[axis.key].score, 0); // 0–30

// ── Formatting helpers ───────────────────────────────────────────────────────

export const fmtPrice = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

export const fmtCompact = (n: number) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
};

// Whether a currency / ticker should use the Indian lakh–crore number system.
export const isIndianCurrency = (currency?: string, ticker?: string): boolean =>
  currency === "INR" || (!!ticker && /\.(NS|BO)$/i.test(ticker));

// Yahoo exchange suffix → trading currency, so a non-US listing shows the right
// symbol even when the live currency field is momentarily missing. Symbols only,
// no FX conversion — we just want, e.g., Samsung (005930.KS) to read in ₩ KRW.
const SUFFIX_CCY: Record<string, string> = {
  NS: "INR", BO: "INR", // India — NSE / BSE
  KS: "KRW", KQ: "KRW", // South Korea — KOSPI / KOSDAQ
  T: "JPY", // Japan — Tokyo
  HK: "HKD", // Hong Kong
  L: "GBP", // London (often quoted in pence — Yahoo returns "GBp")
  SS: "CNY", SZ: "CNY", // China — Shanghai / Shenzhen
  TW: "TWD", TWO: "TWD", // Taiwan
  AX: "AUD", // Australia
  NZ: "NZD", // New Zealand
  SI: "SGD", // Singapore
  KL: "MYR", // Malaysia
  BK: "THB", // Thailand
  JK: "IDR", // Indonesia
  TO: "CAD", V: "CAD", NE: "CAD", // Canada — Toronto / TSXV / NEO
  DE: "EUR", F: "EUR", PA: "EUR", AS: "EUR", MI: "EUR", MC: "EUR", BR: "EUR", LS: "EUR", VI: "EUR", HE: "EUR", IR: "EUR", // Euro exchanges
  ST: "SEK", // Sweden
  OL: "NOK", // Norway
  CO: "DKK", // Denmark
  SW: "CHF", // Switzerland
  SA: "BRL", // Brazil
  MX: "MXN", // Mexico
  JO: "ZAR", // South Africa
  TA: "ILS", // Israel
  SR: "SAR", // Saudi Arabia
  IS: "TRY", // Turkey
};

// Infer a currency code from a ticker's exchange suffix (e.g. ".KS" → "KRW").
export const currencyForTicker = (ticker?: string): string | undefined => {
  if (!ticker) return undefined;
  const m = /\.([A-Za-z]+)$/.exec(ticker.trim());
  return m ? SUFFIX_CCY[m[1].toUpperCase()] : undefined;
};

// Currency code → display symbol. Covers the majors plus every exchange in
// SUFFIX_CCY. GBp is London pence (a real Yahoo currency code).
const CCY_SYMBOL: Record<string, string> = {
  USD: "$", CAD: "C$", AUD: "A$", NZD: "NZ$", HKD: "HK$", SGD: "S$",
  INR: "₹", KRW: "₩", JPY: "¥", CNY: "¥", TWD: "NT$",
  GBP: "£", GBp: "p", EUR: "€", CHF: "CHF ", SEK: "kr ", NOK: "kr ", DKK: "kr ",
  BRL: "R$", MXN: "MX$", ZAR: "R", ILS: "₪", SAR: "﷼ ", TRY: "₺",
  THB: "฿", IDR: "Rp ", MYR: "RM ",
};

// The right currency symbol for a value: prefer the live currency code, fall
// back to the exchange suffix, then USD. Rendering stays light — symbols only.
export const currencySymbol = (currency?: string, ticker?: string): string => {
  if (currency && CCY_SYMBOL[currency]) return CCY_SYMBOL[currency];
  const code = currency || currencyForTicker(ticker) || "USD";
  return CCY_SYMBOL[code] ?? CCY_SYMBOL[code.toUpperCase()] ?? "$";
};

// Compact number formatting, currency-aware. For Indian (INR) contexts we use
// the lakh / crore system the way Indian investors actually read financials
// (L = lakh = 1e5, Cr = crore = 1e7, lakh Cr = 1e12) instead of M / B. Every
// other currency keeps the Western K / M / B / T. `na` is what to show for a
// missing value (callers differ: "—" vs "n/a").
export const fmtCompactCur = (
  n: number | undefined | null,
  indian = false,
  na = "n/a"
): string => {
  if (n == null || !isFinite(n)) return na;
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (indian) {
    if (a >= 1e12) return `${sign}${(a / 1e12).toFixed(2)} lakh Cr`;
    if (a >= 1e7) return `${sign}${(a / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 2 })}Cr`;
    if (a >= 1e5) return `${sign}${(a / 1e5).toFixed(2)}L`;
    if (a >= 1e3) return `${sign}${(a / 1e3).toFixed(1)}K`;
    return `${sign}${Math.round(a)}`;
  }
  if (a >= 1e12) return `${sign}${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sign}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sign}${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${sign}${(a / 1e3).toFixed(1)}K`;
  return `${sign}${Math.round(a)}`;
};

export const dirOf = (n: number): Direction => (n > 0 ? "up" : n < 0 ? "down" : "flat");
