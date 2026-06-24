import type {
  CompanyAnalytics,
  ScoreAxis,
  ScoreCheck,
  ScoreAxisKey,
} from "@/data/demo";
import { yahooQuoteSummary, resolveYahooSymbol } from "@/lib/yahooCrumb";

// Builds a Quantifi Score from Yahoo Finance fundamentals (keyless, personal
// non-commercial use). The cookie/crumb handshake and retries live in
// yahooCrumb.ts so every Yahoo lib shares one cached, resilient crumb. Returns
// null on any failure — or for funds/indexes — so callers fall back gracefully.

export interface LiveScore {
  analytics: CompanyAnalytics;
  price?: number;
  name?: string;
  target?: number;
  recommendation?: string;
  numAnalysts?: number;
  marketCap?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  priceToSales?: number;
  trailingPE?: number;
}

// Yahoo wraps numbers as { raw: number, fmt: string }; read the raw value.
const num = (x: unknown): number | undefined => {
  if (typeof x === "number" && isFinite(x)) return x;
  if (x && typeof x === "object" && "raw" in x) {
    const raw = (x as { raw: unknown }).raw;
    if (typeof raw === "number" && isFinite(raw)) return raw;
  }
  return undefined;
};

const str = (x: unknown): string | undefined =>
  typeof x === "string" && x.length ? x : undefined;

function axis(checks: ScoreCheck[]): ScoreAxis {
  const passed = checks.filter((c) => c.pass).length;
  const score = checks.length ? Math.round((passed / checks.length) * 6) : 0;
  return { score, checks };
}

const c = (label: string, pass: boolean): ScoreCheck => ({ label, pass });
const fpct = (x: number | undefined): string =>
  x == null ? "—" : `${(x * 100).toFixed(0)}%`;

// A deliberately simple 2-stage discounted free-cash-flow model: grow this
// year's FCF for 10 years, add a Gordon-growth terminal value, discount it all
// back at a flat cost of equity, then divide by shares. Returns undefined when
// the inputs don't support a meaningful estimate (e.g. negative FCF).
function dcfPerShare(
  fcf: number | undefined,
  shares: number | undefined,
  growth: number | undefined,
  discount = 0.09,
  termGrowth = 0.025,
  years = 10
): number | undefined {
  if (fcf == null || fcf <= 0 || shares == null || shares <= 0) return undefined;
  const g = Math.min(0.2, Math.max(0.02, growth ?? 0.05)); // clamp 2%–20%
  let cf = fcf;
  let pv = 0;
  for (let t = 1; t <= years; t++) {
    cf *= 1 + g;
    pv += cf / Math.pow(1 + discount, t);
  }
  const terminal = (cf * (1 + termGrowth)) / (discount - termGrowth);
  pv += terminal / Math.pow(1 + discount, years);
  const perShare = pv / shares;
  return isFinite(perShare) && perShare > 0 ? perShare : undefined;
}

export async function getYahooScore(symbol: string): Promise<LiveScore | null> {
  const modules =
    "quoteType,summaryDetail,defaultKeyStatistics,financialData,price,topHoldings";
  let result = await yahooQuoteSummary(symbol, modules);
  // Some inputs need normalising (a company name, or a missing exchange suffix);
  // resolve and retry once so valid names don't read as "not available".
  if (!result) {
    const resolved = await resolveYahooSymbol(symbol);
    if (resolved && resolved.symbol.toUpperCase() !== symbol.toUpperCase())
      result = await yahooQuoteSummary(resolved.symbol, modules);
  }
  if (!result) return null;

  const qt = (result.quoteType ?? {}) as Record<string, unknown>;
  const sd = (result.summaryDetail ?? {}) as Record<string, unknown>;
  const ks = (result.defaultKeyStatistics ?? {}) as Record<string, unknown>;
  const fd = (result.financialData ?? {}) as Record<string, unknown>;
  const pr = (result.price ?? {}) as Record<string, unknown>;
  const th = (result.topHoldings ?? {}) as Record<string, unknown>;

  // Funds aren't companies — they have no margins, ROE or growth, so a company
  // score would read ~0/30. Detect them and bail so the caller falls back to the
  // ETF X-ray (yahooEtf.ts). We look at three things:
  //   1. Yahoo's quoteType (ETF / mutual fund / index / currency);
  //   2. a holdings basket — a holdings list, an asset-class split (stock/bond/
  //      cash position) or a sector mix. This catches closed-end and holding
  //      vehicles (e.g. DXYZ) that Yahoo still tags as EQUITY; and
  //   3. a reported NAV or fund inception date — operating companies have
  //      neither, only pooled funds do.
  const quoteType = str(qt.quoteType) ?? str(pr.quoteType);
  if (
    quoteType === "ETF" ||
    quoteType === "MUTUALFUND" ||
    quoteType === "INDEX" ||
    quoteType === "CURRENCY"
  )
    return null;
  const looksLikeFund =
    (Array.isArray(th.holdings) && th.holdings.length > 0) ||
    (Array.isArray(th.sectorWeightings) && th.sectorWeightings.length > 0) ||
    num(th.stockPosition) != null ||
    num(th.bondPosition) != null ||
    num(th.cashPosition) != null ||
    num(sd.navPrice) != null ||
    num(ks.navPrice) != null ||
    num(ks.fundInceptionDate) != null;
  if (looksLikeFund) return null;

  const pe = num(sd.trailingPE) ?? num(ks.trailingPE);
  const peg = num(ks.pegRatio);
  const profitMargins = num(fd.profitMargins) ?? num(ks.profitMargins);
  const roe = num(fd.returnOnEquity);
  const revGrowth = num(fd.revenueGrowth);
  const earnGrowth = num(fd.earningsGrowth) ?? num(ks.earningsQuarterlyGrowth);
  const currentRatio = num(fd.currentRatio);
  const debtToEquity = num(fd.debtToEquity); // percent: 152 => 1.52x
  const totalCash = num(fd.totalCash);
  const totalDebt = num(fd.totalDebt);
  const divYield = num(sd.dividendYield); // fraction
  const payout = num(sd.payoutRatio); // fraction
  const price = num(fd.currentPrice) ?? num(pr.regularMarketPrice);
  const target = num(fd.targetMeanPrice);
  const recommendation = str(fd.recommendationKey);
  const numAnalysts = num(fd.numberOfAnalystOpinions);
  const marketCap = num(sd.marketCap) ?? num(pr.marketCap);
  const priceToSales =
    num(sd.priceToSalesTrailing12Months) ?? num(ks.priceToSalesTrailing12Months);
  const freeCashflow = num(fd.freeCashflow) ?? num(fd.operatingCashflow);
  const sharesOutstanding = num(ks.sharesOutstanding) ?? num(pr.sharesOutstanding);
  const name = str(pr.longName) ?? str(pr.shortName) ?? symbol.toUpperCase();

  // No company fundamentals (e.g. ETF/index) → score doesn't apply. A fund can
  // still report a (basket) P/E, so a lone P/E isn't enough — require at least
  // one genuinely company-level metric.
  if (profitMargins == null && roe == null && revGrowth == null && earnGrowth == null)
    return null;
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

  const rewards: string[] = [];
  const riskFlags: string[] = [];
  if (roe != null && roe > 0.15) rewards.push(`Strong return on equity (${fpct(roe)}).`);
  if (revGrowth != null && revGrowth > 0.1) rewards.push(`Revenue growing double digits (${fpct(revGrowth)}).`);
  if (profitMargins != null && profitMargins > 0.15) rewards.push(`Healthy profit margin (${fpct(profitMargins)}).`);
  if (totalCash != null && totalDebt != null && totalCash > totalDebt) rewards.push("More cash on hand than total debt.");
  if (target != null && price < target) rewards.push("Trades below analysts' average price target.");
  if (divYield != null && divYield > 0.02) rewards.push(`Pays a dividend (${fpct(divYield)} yield).`);

  if (profitMargins != null && profitMargins <= 0) riskFlags.push("Currently unprofitable.");
  if (debtToEquity != null && debtToEquity >= 100) riskFlags.push(`Elevated debt (debt/equity ${(debtToEquity / 100).toFixed(1)}x).`);
  if (pe != null && pe > 40) riskFlags.push(`Rich valuation (P/E ${pe.toFixed(0)}).`);
  if (target != null && price > target) riskFlags.push("Trades above analysts' average price target.");
  if (currentRatio != null && currentRatio < 1) riskFlags.push("Short-term liabilities exceed short-term assets.");
  if (divYield == null || divYield === 0) riskFlags.push("Pays no dividend.");

  if (rewards.length === 0) rewards.push("No standout strengths in the available fundamentals.");
  if (riskFlags.length === 0) riskFlags.push("No major red flags in the available fundamentals.");

  // Independent of analysts: a simple 2-stage discounted free-cash-flow estimate
  // of intrinsic value per share, so users can sanity-check the analyst target.
  const cfPerShare = dcfPerShare(freeCashflow, sharesOutstanding, earnGrowth ?? revGrowth);

  const analytics: CompanyAnalytics = {
    ticker: symbol.toUpperCase(),
    scores,
    fairValue: {
      estimate: target ?? price,
      method: "Analyst mean target",
      note: "Analysts' average price target vs the current price — a research input, not advice.",
    },
    cashflowValue:
      cfPerShare != null
        ? {
            estimate: cfPerShare,
            note: "A 2-stage discounted free-cash-flow estimate of intrinsic value — independent of analyst targets. Model-based, not advice.",
          }
        : undefined,
    rewards: rewards.slice(0, 4),
    riskFlags: riskFlags.slice(0, 4),
  };

  return {
    analytics,
    price,
    name,
    target,
    recommendation,
    numAnalysts,
    marketCap,
    revenueGrowth: revGrowth,
    earningsGrowth: earnGrowth,
    priceToSales,
    trailingPE: pe,
  };
}
