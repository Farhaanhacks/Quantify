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
  // Optional 2-stage discounted-cash-flow intrinsic value per share.
  cashflowValue?: { estimate: number; note: string };
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

// Compact number formatting, currency-aware. For Indian (INR) contexts we use
// the lakh / crore system the way Indian investors actually read financials
// (L = lakh = 1e5, Cr = crore = 1e7, lakh Cr = 1e12) instead of M / B. Every
// other currency keeps the Western K / M / B / T. `na` is what to show for a
// missing value (callers differ: "—" vs "n/a").
export const fmtCompactCur = (
  n: number | undefined | null,
  indian = false,
  na = "—"
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
