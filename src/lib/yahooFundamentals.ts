import yahooFinance from "yahoo-finance2";
import type {
  CompanyAnalytics,
  ScoreAxis,
  ScoreCheck,
  ScoreAxisKey,
} from "@/data/demo";

export interface LiveScore {
  analytics: CompanyAnalytics;
  price?: number;
  name?: string;
}

const num = (x: unknown): number | undefined =>
  typeof x === "number" && isFinite(x) ? x : undefined;

const pct = (x: number | undefined): string =>
  x == null ? "—" : `${(x * 100).toFixed(0)}%`;

function axis(checks: ScoreCheck[]): ScoreAxis {
  const passed = checks.filter((c) => c.pass).length;
  const score = checks.length ? Math.round((passed / checks.length) * 6) : 0;
  return { score, checks };
}

const c = (label: string, pass: boolean): ScoreCheck => ({ label, pass });

export async function getYahooScore(symbol: string): Promise<LiveScore | null> {
  let r: Record<string, unknown>;
  try {
    r = (await yahooFinance.quoteSummary(
      symbol,
      {
        modules: ["summaryDetail", "defaultKeyStatistics", "financialData", "price"],
      },
      { validateResult: false }
    )) as unknown as Record<string, unknown>;
  } catch {
    return null;
  }
  if (!r) return null;

  const sd = (r.summaryDetail ?? {}) as Record<string, unknown>;
  const ks = (r.defaultKeyStatistics ?? {}) as Record<string, unknown>;
  const fd = (r.financialData ?? {}) as Record<string, unknown>;
  const pr = (r.price ?? {}) as Record<string, unknown>;

  const pe = num(sd.trailingPE) ?? num(ks.trailingPE);
  const peg = num(ks.pegRatio);
  const profitMargins = num(fd.profitMargins) ?? num(ks.profitMargins);
  const roe = num(fd.returnOnEquity);
  const revGrowth = num(fd.revenueGrowth);
  const earnGrowth = num(fd.earningsGrowth) ?? num(ks.earningsQuarterlyGrowth);
  const currentRatio = num(fd.currentRatio);
  const debtToEquity = num(fd.debtToEquity); // Yahoo reports as a percent (e.g. 152 = 1.52x)
  const totalCash = num(fd.totalCash);
  const totalDebt = num(fd.totalDebt);
  const divYield = num(sd.dividendYield); // fraction
  const payout = num(sd.payoutRatio); // fraction
  const price = num(fd.currentPrice) ?? num(pr.regularMarketPrice);
  const target = num(fd.targetMeanPrice);
  const name =
    (typeof pr.longName === "string" && pr.longName) ||
    (typeof pr.shortName === "string" && pr.shortName) ||
    symbol;

  // If there are no real fundamentals (e.g. an ETF/index), the score doesn't apply.
  if (pe == null && profitMargins == null && roe == null) return null;
  if (price == null) return null;

  const scores: Record<ScoreAxisKey, ScoreAxis> = {
    value: axis([
      c("Trades below analysts' average target", target != null && price < target),
      c("Reasonable P/E (below 25)", pe != null && pe > 0 && pe < 25),
      c("Growth fairly priced (PEG below 2)", peg != null && peg > 0 && peg < 2),
    ]),
    growth: axis([
      c("Revenue growing (>5%)", revGrowth != null && revGrowth > 0.05),
      c("Earnings growing (>5%)", earnGrowth != null && earnGrowth > 0.05),
      c("Strong return on equity (>15%)", roe != null && roe > 0.15),
    ]),
    past: axis([
      c("Currently profitable", profitMargins != null && profitMargins > 0),
      c("Healthy profit margin (>10%)", profitMargins != null && profitMargins > 0.1),
      c("Good return on equity (>12%)", roe != null && roe > 0.12),
    ]),
    health: axis([
      c("Short-term assets cover liabilities (current ratio >1)", currentRatio != null && currentRatio > 1),
      c("Conservative debt (debt/equity below 1x)", debtToEquity != null && debtToEquity < 100),
      c("More cash than total debt", totalCash != null && totalDebt != null && totalCash > totalDebt),
    ]),
    dividends: axis([
      c("Pays a dividend", divYield != null && divYield > 0),
      c("Yield above ~2%", divYield != null && divYield > 0.02),
      c("Dividend covered by earnings (payout <80%)", payout != null && payout > 0 && payout < 0.8),
    ]),
  };

  // Rewards / risk flags from the same numbers.
  const rewards: string[] = [];
  const riskFlags: string[] = [];
  if (roe != null && roe > 0.15) rewards.push(`Strong return on equity (${pct(roe)}).`);
  if (revGrowth != null && revGrowth > 0.1) rewards.push(`Revenue growing double digits (${pct(revGrowth)}).`);
  if (profitMargins != null && profitMargins > 0.15) rewards.push(`Healthy profit margin (${pct(profitMargins)}).`);
  if (totalCash != null && totalDebt != null && totalCash > totalDebt) rewards.push("More cash on hand than total debt.");
  if (target != null && price < target) rewards.push("Trades below analysts' average price target.");
  if (divYield != null && divYield > 0.02) rewards.push(`Pays a dividend (${pct(divYield)} yield).`);

  if (profitMargins != null && profitMargins <= 0) riskFlags.push("Currently unprofitable.");
  if (debtToEquity != null && debtToEquity >= 100) riskFlags.push(`Elevated debt (debt/equity ${(debtToEquity / 100).toFixed(1)}x).`);
  if (pe != null && pe > 40) riskFlags.push(`Rich valuation (P/E ${pe.toFixed(0)}).`);
  if (target != null && price > target) riskFlags.push("Trades above analysts' average price target.");
  if (currentRatio != null && currentRatio < 1) riskFlags.push("Short-term liabilities exceed short-term assets.");
  if (divYield == null || divYield === 0) riskFlags.push("Pays no dividend.");

  if (rewards.length === 0) rewards.push("No standout strengths in the available fundamentals.");
  if (riskFlags.length === 0) riskFlags.push("No major red flags in the available fundamentals.");

  const analytics: CompanyAnalytics = {
    ticker: symbol.toUpperCase(),
    scores,
    fairValue: {
      estimate: target ?? price,
      method: "Analyst mean target (Yahoo)",
      note: "Analysts' average price target vs the current price — a research input, not advice.",
    },
    rewards: rewards.slice(0, 4),
    riskFlags: riskFlags.slice(0, 4),
  };

  return { analytics, price, name };
}
