import type {
  CompanyAnalytics,
  ScoreAxis,
  ScoreCheck,
  ScoreAxisKey,
} from "@/data/demo";
import { yahooQuoteSummary, resolveYahooSymbol } from "@/lib/yahooCrumb";
import { knownFund } from "@/data/knownFunds";

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
//
// Crucially the high-growth phase FADES: a fast compounder doesn't grow at 40%
// forever, but holding it flat at the revenue-growth rate (the old behaviour)
// undervalued real compounders badly — a company whose cash flow has grown ~40%
// a year read as if it grew ~13%. We start from the company's observed cash-flow
// growth and decay it linearly toward the terminal rate, which is how a sane DCF
// treats hyper-growth: rich near-term, normalising over time.
function dcfPerShare(
  fcf: number | undefined,
  shares: number | undefined,
  growth: number | undefined,
  discount = 0.09,
  termGrowth = 0.025,
  years = 10
): number | undefined {
  if (fcf == null || fcf <= 0 || shares == null || shares <= 0) return undefined;
  // Initial growth: allow genuinely fast growers up to 30% (the fade keeps this
  // from exploding), floor at 3% so a sleepy name still gets a fair terminal.
  const g0 = Math.min(0.3, Math.max(0.03, growth ?? 0.05));
  let cf = fcf;
  let pv = 0;
  for (let t = 1; t <= years; t++) {
    // Linearly fade year-1 growth (g0) down to the terminal rate by the final
    // year, so the explicit window captures high-but-decaying growth.
    const g = g0 + ((termGrowth - g0) * (t - 1)) / (years - 1);
    cf *= 1 + g;
    pv += cf / Math.pow(1 + discount, t);
  }
  const terminal = (cf * (1 + termGrowth)) / (discount - termGrowth);
  pv += terminal / Math.pow(1 + discount, years);
  const perShare = pv / shares;
  return isFinite(perShare) && perShare > 0 ? perShare : undefined;
}

// Compound annual growth rate between the oldest and newest values in a series
// (ordered oldest → newest). Returns undefined unless both endpoints are
// positive and span at least one year, so a single loss-making year can't
// produce a nonsense rate.
function cagr(series: number[]): number | undefined {
  const vals = series.filter((v) => typeof v === "number" && isFinite(v));
  if (vals.length < 2) return undefined;
  const first = vals[0];
  const last = vals[vals.length - 1];
  if (first <= 0 || last <= 0) return undefined;
  const periods = vals.length - 1;
  const rate = Math.pow(last / first, 1 / periods) - 1;
  return isFinite(rate) ? rate : undefined;
}

// A steadier growth input for the DCF than any single Yahoo field. Revenue
// growth is the stable anchor; strong earnings growth lifts it (operating
// leverage), but a noisy low earnings print can no longer drag the estimate
// below revenue growth and collapse the model to the floor — which is what made
// fast compounders like AMZN read absurdly cheap (a 20% grower priced as a 2%
// one). Falls back to whichever single signal exists.
function forwardGrowth(
  rev: number | undefined,
  earn: number | undefined
): number | undefined {
  if (rev != null && rev > 0) {
    return earn != null && earn > rev ? (rev + earn) / 2 : rev;
  }
  if (earn != null && earn > 0) return earn;
  return rev ?? earn;
}

export async function getYahooScore(symbol: string): Promise<LiveScore | null> {
  // Curated funds Yahoo misclassifies as equities (e.g. DXYZ) must never be
  // company-scored — route them straight to the ETF X-ray.
  if (knownFund(symbol)) return null;

  const modules =
    "quoteType,summaryDetail,defaultKeyStatistics,financialData,price,topHoldings,cashflowStatementHistory";
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
  const cfh = (result.cashflowStatementHistory ?? {}) as Record<string, unknown>;

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
  // Multi-year cash-flow statements (Yahoo returns them newest → oldest). We use
  // them for two things the single TTM figure can't give us: the real free-cash-
  // flow trend (its growth rate) and a fallback base if the TTM value is missing.
  const statements = Array.isArray(cfh.cashflowStatements)
    ? (cfh.cashflowStatements as Record<string, unknown>[])
    : [];
  // Build oldest → newest series of operating cash flow, free cash flow, and a
  // per-year "normalised" cash flow (OCF minus only maintenance capex — see
  // below). The normalised series lets us value through-cycle earning power
  // rather than a single trough or peak year.
  const ocfSeries: number[] = [];
  const fcfSeries: number[] = [];
  const normSeries: number[] = [];
  for (let i = statements.length - 1; i >= 0; i--) {
    const st = statements[i];
    const ocf = num(st.totalCashFromOperatingActivities);
    const capex = num(st.capitalExpenditures); // reported negative (an outflow)
    if (ocf != null) {
      ocfSeries.push(ocf);
      fcfSeries.push(capex != null ? ocf + capex : ocf);
      if (ocf > 0) {
        const maint = Math.min(capex != null ? Math.abs(capex) : 0, 0.4 * ocf);
        normSeries.push(ocf - maint);
      }
    }
  }
  // Cash-flow growth is the truest growth signal for a DCF — far better than a
  // single year's revenue or earnings print. Prefer the operating-cash-flow CAGR
  // (steadier than FCF, which capex swings around), then FCF CAGR, then the
  // income-statement growth fields as a last resort.
  const cashflowGrowth =
    cagr(ocfSeries) ?? cagr(fcfSeries) ?? forwardGrowth(revGrowth, earnGrowth);

  // TTM operating & free cash flow (Yahoo reports both; capex ≈ their gap).
  const ocfTTM =
    num(fd.operatingCashflow) ??
    (ocfSeries.length ? ocfSeries[ocfSeries.length - 1] : undefined);
  const fcfTTM =
    num(fd.freeCashflow) ??
    (fcfSeries.length ? fcfSeries[fcfSeries.length - 1] : undefined);

  // Base cash flow for the DCF. Two adjustments make this reflect real earning
  // power rather than an accounting snapshot:
  //   • Maintenance capex only. We start from operating cash flow and subtract
  //     just maintenance capex (capped at 40% of OCF). A fast grower ploughs most
  //     of its capex into building future capacity, and the growth rate already
  //     credits the cash flows that capacity will produce; subtracting all of it
  //     (raw free cash flow) double-counts the cost and made capacity-builders
  //     read as deeply overvalued. Asset-light names have little capex, so this
  //     collapses back to ordinary free cash flow.
  //   • Through-cycle normalisation. We take the GREATER of the current run-rate
  //     and the multi-year average, so a single trough year (e.g. a game studio
  //     between major releases like TTWO pre-GTA VI) doesn't define intrinsic
  //     value — the company's better years count too.
  const avgNorm = normSeries.length
    ? normSeries.reduce((a, b) => a + b, 0) / normSeries.length
    : undefined;
  let baseCashflow: number | undefined;
  if (ocfTTM != null && ocfTTM > 0) {
    const capex = fcfTTM != null ? Math.max(0, ocfTTM - fcfTTM) : 0;
    const ttmNorm = ocfTTM - Math.min(capex, 0.4 * ocfTTM);
    baseCashflow = avgNorm != null ? Math.max(ttmNorm, avgNorm) : ttmNorm;
  } else {
    baseCashflow = avgNorm ?? fcfTTM ?? ocfTTM;
  }
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
  // We only surface it when its inputs are internally consistent — a wrong DCF
  // is worse than none, especially now we're live:
  //   1. Currency — free cash flow, share count and price must be the same
  //      currency. Otherwise the per-share value mixes units (e.g. an ADR's USD
  //      cash flow divided by a local share count), which is how a ₹1,050 stock
  //      ends up "valued" at ₹25.
  //   2. Plausibility — a per-share estimate below ~10% of, or above ~10x, the
  //      live price reflects sparse or stale fundamentals, not a real valuation.
  //      Real over/undervaluation never reaches those extremes, so we drop it
  //      rather than publish a nonsense figure.
  const financialCurrency = str(fd.financialCurrency);
  const priceCurrency = str(pr.currency);
  const currencyOk =
    financialCurrency == null ||
    priceCurrency == null ||
    financialCurrency === priceCurrency;
  const cfRaw = dcfPerShare(baseCashflow, sharesOutstanding, cashflowGrowth);
  const cfPerShare =
    cfRaw != null && currencyOk && cfRaw >= price * 0.1 && cfRaw <= price * 10
      ? cfRaw
      : undefined;

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
            note: "A discounted cash-flow estimate of intrinsic value: the company's own cash-flow growth trend, fading toward a sustainable rate, discounted back to today — independent of analyst targets. Model-based, not advice.",
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
