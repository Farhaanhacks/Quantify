import type {
  CompanyAnalytics,
  ScoreAxis,
  ScoreCheck,
  ScoreAxisKey,
} from "@/data/demo";
import { yahooQuoteSummary, resolveYahooSymbol, yahooQuotes } from "@/lib/yahooCrumb";
import { getYahooStatements } from "@/lib/yahooCompany";
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
  targetHigh?: number;
  targetLow?: number;
  recommendation?: string;
  numAnalysts?: number;
  marketCap?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  priceToSales?: number;
  trailingPE?: number;
  currency?: string;
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
  // Cap the discount rate (cost of equity / WACC) to a sane 7–11% band. A raw
  // WACC can drift too low for a low-beta defensive name (inflating value) or
  // spike during a volatile quarter (crushing it); clamping keeps the estimate
  // stable and comparable across names.
  // Clamp to a sane 6–16% band: the low end for a defensive developed-market name,
  // the high end for a higher-risk emerging market (India, LatAm) whose local
  // risk-free rate alone can be ~7%. The old US-only 7–11% band understated the
  // discount for those markets and inflated their valuations (a too-small
  // rate − terminalGrowth spread blows up the terminal value).
  const rate = Math.min(0.16, Math.max(0.06, discount));
  // Initial growth: allow fast growers up to 20% (the fade keeps this from
  // exploding), floor at 3% so a sleepy name still gets a fair terminal. Capped
  // conservatively so an optimistic growth read can't inflate the estimate.
  const g0 = Math.min(0.2, Math.max(0.03, growth ?? 0.05));
  let cf = fcf;
  let pv = 0;
  for (let t = 1; t <= years; t++) {
    // Linearly fade year-1 growth (g0) down to the terminal rate by the final
    // year, so the explicit window captures high-but-decaying growth.
    const g = g0 + ((termGrowth - g0) * (t - 1)) / (years - 1);
    cf *= 1 + g;
    pv += cf / Math.pow(1 + rate, t);
  }
  const terminal = (cf * (1 + termGrowth)) / (rate - termGrowth);
  pv += terminal / Math.pow(1 + rate, years);
  const perShare = pv / shares;
  return isFinite(perShare) && perShare > 0 ? perShare : undefined;
}

// Cost of equity (the DCF discount rate) by the listing's home market. It's driven
// mostly by the local risk-free rate + an equity risk premium, so it varies a lot
// by country: a flat US 9% applied to Indian or Brazilian cash flows badly
// understates the discount and inflates the value. Keyed by the reporting/quote
// currency; unknown markets get a conservative emerging-market default.
function costOfEquity(currency: string | undefined): number {
  const c = (currency ?? "USD").toUpperCase();
  const map: Record<string, number> = {
    USD: 0.09, CAD: 0.09, GBP: 0.09, EUR: 0.085, CHF: 0.07, JPY: 0.07,
    AUD: 0.095, SGD: 0.085, HKD: 0.09, TWD: 0.095, KRW: 0.10, CNY: 0.10,
    INR: 0.125, IDR: 0.14, THB: 0.10, PHP: 0.12, MYR: 0.10,
    BRL: 0.15, MXN: 0.135, ZAR: 0.15, TRY: 0.22, AED: 0.10, SAR: 0.10,
  };
  return map[c] ?? 0.115; // unknown → conservative EM default
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

// Median of a numeric series — robust to a single outlier year (a peak or a
// trough) in a way the mean is not, which matters for cyclical businesses.
function median(series: number[]): number | undefined {
  const vals = series.filter((v) => typeof v === "number" && isFinite(v)).sort((a, b) => a - b);
  if (!vals.length) return undefined;
  const mid = Math.floor(vals.length / 2);
  return vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
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

// ── Sector-appropriate valuation ─────────────────────────────────────────────
// A single trailing DCF suits only mature, cash-generative businesses. For most
// companies the right lens depends on the sector: SaaS on revenue multiples,
// banks on book value, telecom/infra on EV/EBITDA, real-estate/commodities on
// asset value. We classify the company, apply the sector's preferred multiple to
// ITS OWN figures against a typical sector benchmark, and derive an implied fair
// value + over/under read. Benchmarks are documented sector heuristics, not
// precise targets — always shown alongside the analyst view.
type SectorMethod = {
  clusterLabel: string;
  method: string; // full display name
  metricShort: string; // "EV/EBITDA"
  kind: "pb" | "ev_ebitda" | "ev_sales" | "pe";
  benchmark: number;
  why: string;
  // Real estate / commodities: book value is only a conservative NAV FLOOR
  // (property & land carried at historical cost), not a fair-value target — so
  // we show the premium/discount to book rather than an over/under %.
  navFloor?: boolean;
};

function classifySector(
  sector: string | undefined,
  industry: string | undefined,
  profitMargins: number | undefined,
  revGrowth: number | undefined
): SectorMethod | undefined {
  const s = (sector ?? "").toLowerCase();
  const ind = (industry ?? "").toLowerCase();
  if (!s) return undefined;
  if (s.includes("financial"))
    return { clusterLabel: "Banks & Financial Institutions", method: "P / B (price to book)", metricShort: "P/B", kind: "pb", benchmark: 1.2, why: "For lenders debt is raw material, not a capital-structure choice, so EV/EBITDA is mis-specified — book value and P/B are the cleaner lens." };
  if (s.includes("real estate"))
    return { clusterLabel: "Real Estate", method: "Net asset value (book proxy)", metricShort: "P/B", kind: "pb", benchmark: 1.0, navFloor: true, why: "A property company's value is tied to the appraised value of its land and buildings." };
  if (s.includes("basic materials") || s.includes("energy"))
    return { clusterLabel: "Commodities & Resources", method: "Asset value (book proxy)", metricShort: "P/B", kind: "pb", benchmark: 1.2, navFloor: true, why: "Producers are valued off the worth of reserves and physical assets — an asset/NAV lens fits better than earnings multiples through the cycle." };
  if (
    s.includes("utilities") ||
    (s.includes("communication") && ind.includes("telecom")) ||
    (s.includes("industrials") && /infrastructure|railroad|engineering|freight|utilities|construction/.test(ind))
  )
    return { clusterLabel: "Telecom & Infrastructure", method: "EV / EBITDA", metricShort: "EV/EBITDA", kind: "ev_ebitda", benchmark: 8, why: "Capital-heavy, debt-financed businesses: EV/EBITDA normalises very different debt loads and heavy asset depreciation." };
  const isTech = s.includes("technology") || (s.includes("communication") && /internet|software|entertainment|media/.test(ind));
  if (isTech) {
    const hyper = (profitMargins != null && profitMargins <= 0.05) || (revGrowth != null && revGrowth > 0.2);
    if (hyper)
      return { clusterLabel: "High-Growth Tech / SaaS", method: "EV / Sales", metricShort: "EV/Sales", kind: "ev_sales", benchmark: 6, why: "Near-term earnings are thin or non-existent while the company scales, so revenue multiples (EV/Sales) are the working lens." };
    return { clusterLabel: "Technology", method: "P / E", metricShort: "P/E", kind: "pe", benchmark: 24, why: "A profitable tech compounder — an earnings multiple with a growth premium is the cleanest read." };
  }
  // Any not-yet-profitable company (in any sector outside banks / real estate /
  // telecom / commodities, which have their own asset- or EBITDA-based lens):
  // earnings multiples don't apply, so fall back to a revenue multiple — the
  // same EV/Sales lens SaaS uses. This is what lets a loss-making growth name
  // still get an independent valuation instead of no card at all.
  if (profitMargins != null && profitMargins <= 0)
    return { clusterLabel: "High-Growth / Pre-Profit", method: "EV / Sales", metricShort: "EV/Sales", kind: "ev_sales", benchmark: 5, why: "Not yet profitable, so earnings multiples don't apply — a revenue multiple (EV/Sales) is the working lens until profits arrive." };
  return { clusterLabel: "Broad Market", method: "P / E", metricShort: "P/E", kind: "pe", benchmark: 18, why: "A general earnings-multiple lens for a mature, profitable business." };
}

interface SectorValuationInput {
  sector?: string;
  industry?: string;
  price: number;
  shares?: number;
  profitMargins?: number;
  revGrowth?: number;
  eps?: number;
  bookValuePerShare?: number;
  ebitda?: number;
  revenue?: number;
  netDebt?: number;
  pe?: number;
  priceToBook?: number;
  evToEbitda?: number;
  evToRevenue?: number;
}

interface SectorValuationResult {
  sector: string;
  method: string;
  metricLabel: string;
  estimate: number;
  valueLabel: string; // what the estimate represents ("Sector fair value" / "Book value · NAV floor")
  tag: string; // pill text
  tagUnder: boolean; // tone (true = green/cheaper)
  showBar: boolean; // draw the price-vs-value bar
  note: string;
}

function computeSectorValuation(i: SectorValuationInput): SectorValuationResult | undefined {
  const cfg = classifySector(i.sector, i.industry, i.profitMargins, i.revGrowth);
  if (!cfg || !(i.price > 0)) return undefined;
  const mult = (n: number | undefined) => (n != null && isFinite(n) ? `${n.toFixed(1)}×` : "—");

  // Real estate / commodities: book value is a conservative NAV FLOOR (land and
  // property at historical cost), and true appraised NAV isn't in our data feed.
  // Show the premium/discount to book — never a misleading "% over/under".
  if (cfg.kind === "pb" && cfg.navFloor) {
    const bvps = i.bookValuePerShare;
    if (bvps == null || bvps <= 0 || bvps > i.price * 10) return undefined;
    const pb = i.priceToBook ?? i.price / bvps;
    return {
      sector: cfg.clusterLabel,
      method: cfg.method,
      metricLabel: `P/B ${mult(pb)}`,
      estimate: bvps,
      valueLabel: "Book value · NAV floor",
      tag: `${pb.toFixed(1)}× book value`,
      tagUnder: pb < 1,
      showBar: false,
      note: `${cfg.clusterLabel} — ${cfg.why} Book value is only a CONSERVATIVE NAV floor: property and land are carried at historical cost, so the true appraised NAV is typically well above book — and isn't available from our data source. Treat it as a floor, not a price target; a name trading above book isn't necessarily overvalued.`,
    };
  }

  // Standard multiple → implied fair value + over/under vs the live price.
  let estimate: number | undefined;
  let current: number | undefined;
  if (cfg.kind === "pb") {
    if (i.bookValuePerShare == null || i.bookValuePerShare <= 0) return undefined;
    estimate = cfg.benchmark * i.bookValuePerShare;
    current = i.priceToBook ?? i.price / i.bookValuePerShare;
  } else if (cfg.kind === "pe") {
    if (i.eps == null || i.eps <= 0) return undefined;
    estimate = cfg.benchmark * i.eps;
    current = i.pe ?? i.price / i.eps;
  } else if (cfg.kind === "ev_ebitda") {
    if (i.ebitda == null || i.ebitda <= 0 || i.shares == null || i.shares <= 0) return undefined;
    estimate = (cfg.benchmark * i.ebitda - (i.netDebt ?? 0)) / i.shares;
    current = i.evToEbitda;
  } else {
    if (i.revenue == null || i.revenue <= 0 || i.shares == null || i.shares <= 0) return undefined;
    estimate = (cfg.benchmark * i.revenue - (i.netDebt ?? 0)) / i.shares;
    current = i.evToRevenue;
  }
  if (estimate == null || !isFinite(estimate) || estimate <= 0) return undefined;
  // Plausibility band — only reject genuine data artefacts. A sector-multiple
  // value that lands well BELOW the price is a legitimate "expensive vs the
  // sector" read (exactly what a richly-valued name should surface), so we keep a
  // tiny near-zero floor rather than the old 0.25× floor that hid those cases and
  // left only the analyst target. The upper cap still guards against artefacts.
  if (estimate < i.price * 0.05 || estimate > i.price * 4) return undefined;
  const gap = ((estimate - i.price) / i.price) * 100;
  const under = gap >= 0;
  return {
    sector: cfg.clusterLabel,
    method: cfg.method,
    metricLabel: `${cfg.metricShort} ${mult(current)} vs ~${cfg.benchmark}× typical`,
    estimate,
    valueLabel: "Sector fair value",
    tag: `${under ? "Below" : "Above"} sector value · ${Math.abs(gap).toFixed(0)}%`,
    tagUnder: under,
    showBar: true,
    note: `${cfg.clusterLabel} — valued on ${cfg.method}. ${cfg.why} Fair value applies a ~${cfg.benchmark}× ${cfg.metricShort} sector benchmark to the company's own figures. A sector heuristic, not a precise target.`,
  };
}

export async function getYahooScore(symbol: string): Promise<LiveScore | null> {
  // Curated funds Yahoo misclassifies as equities (e.g. DXYZ) must never be
  // company-scored — route them straight to the ETF X-ray.
  if (knownFund(symbol)) return null;

  const modules =
    "quoteType,summaryDetail,defaultKeyStatistics,financialData,price,topHoldings,cashflowStatementHistory,assetProfile";
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
  const ap = (result.assetProfile ?? {}) as Record<string, unknown>;

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
  // Prefer the live quote (regularMarketPrice) over financialData.currentPrice —
  // the latter is a fundamentals-module snapshot that lags during market hours,
  // which made the "current price" on the valuation cards disagree with the live
  // chart. Fall back to currentPrice only when the quote field is missing.
  const price = num(pr.regularMarketPrice) ?? num(fd.currentPrice);
  const target = num(fd.targetMeanPrice);
  const targetHigh = num(fd.targetHighPrice);
  const targetLow = num(fd.targetLowPrice);
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
  // Build oldest → newest series of operating cash flow and REAL free cash flow
  // (operating cash flow minus ALL capex). We deliberately value off real FCF:
  // "owner-earnings" tricks (subtracting only maintenance capex) or margin-based
  // proxies (revenue × operating margin) both IGNORE real capital spending, and
  // for capital-heavy or cash-burning businesses — data-centre builders,
  // pre-profit growth names — they overstate cash generation and produce a
  // misleadingly high intrinsic value. Real FCF keeps the estimate honest.
  const ocfSeries: number[] = [];
  const fcfSeries: number[] = [];
  for (let i = statements.length - 1; i >= 0; i--) {
    const st = statements[i];
    const ocf = num(st.totalCashFromOperatingActivities);
    const capex = num(st.capitalExpenditures); // reported negative (an outflow)
    if (ocf != null) {
      ocfSeries.push(ocf);
      fcfSeries.push(capex != null ? ocf + capex : ocf);
    }
  }
  // Yahoo's cashflowStatementHistory MODULE is deprecated (dates, null values) for
  // many names — notably Indian listings like Reliance — so the loop above comes
  // back empty and the DCF has nothing to value. Fall back to the fundamentals-
  // TIMESERIES service (the one that actually serves statements now), oldest →
  // newest, so a large cash-generative company still gets a cash-flow value.
  if (ocfSeries.length === 0) {
    try {
      const ts = await getYahooStatements(symbol);
      for (let i = ts.cashflow.length - 1; i >= 0; i--) {
        const v = ts.cashflow[i]?.values ?? {};
        const ocf = v.operatingCashFlow;
        const capex = v.capex; // reported negative
        const fcf = v.freeCashFlow;
        if (ocf != null) {
          ocfSeries.push(ocf);
          fcfSeries.push(fcf != null ? fcf : capex != null ? ocf + capex : ocf);
        }
      }
    } catch {
      /* leave empty → DCF simply won't publish, which is the honest fallback */
    }
  }
  // Growth signal: operating-cash-flow CAGR (steadier than FCF), then FCF CAGR,
  // then income-statement growth. cagr() returns undefined unless both endpoints
  // are positive, so a loss-making history can't produce a nonsense rate.
  const cashflowGrowth =
    cagr(ocfSeries) ?? cagr(fcfSeries) ?? forwardGrowth(revGrowth, earnGrowth);

  // TTM free cash flow (Yahoo reports it directly; else the latest statement).
  const fcfTTM =
    num(fd.freeCashflow) ??
    (fcfSeries.length ? fcfSeries[fcfSeries.length - 1] : undefined);

  // Through-cycle base = the MEDIAN of positive real-FCF years. The median (not
  // the max, not a single year) is robust to BOTH a trough year (which would
  // otherwise read as structural decline and under-value) AND a one-off peak
  // (which would over-value). Fall back to the TTM figure when there's no
  // multi-year history. A base that isn't positive means a trailing DCF is not
  // meaningful for this company — handled by the eligibility gate below.
  const medFcf = median(fcfSeries.filter((v) => v > 0));
  // Operating-cash-flow base, used as a fallback when real free cash flow is
  // lumpy or negative. A capital-heavy business that reinvests aggressively (e.g.
  // Reliance) still throws off large OPERATING cash flow even when free cash flow
  // is temporarily negative, so valuing off OCF lets a genuinely cash-generative
  // company show a cash-flow value instead of a blank.
  const medOcf = median(ocfSeries.filter((v) => v > 0));
  const ocfTTM =
    num(fd.operatingCashflow) ??
    (ocfSeries.length ? ocfSeries[ocfSeries.length - 1] : undefined);
  let baseCashflow: number | undefined;
  let baseIsOcf = false;
  if (medFcf != null && medFcf > 0) baseCashflow = medFcf;
  else if (fcfTTM != null && fcfTTM > 0) baseCashflow = fcfTTM;
  else if (medOcf != null && medOcf > 0) {
    baseCashflow = medOcf;
    baseIsOcf = true;
  } else if (ocfTTM != null && ocfTTM > 0) {
    baseCashflow = ocfTTM;
    baseIsOcf = true;
  } else baseCashflow = undefined;
  // Share count: Yahoo omits sharesOutstanding for some listings (notably several
  // Indian names, which also blanks their Market Cap). Derive it from net income
  // ÷ EPS, or market cap ÷ price, so per-share maths (and the DCF) still work.
  const sharesOutstanding =
    num(ks.sharesOutstanding) ??
    num(pr.sharesOutstanding) ??
    (() => {
      const ni = num(ks.netIncomeToCommon);
      const te = num(ks.trailingEps);
      if (ni != null && te != null && te > 0) return ni / te;
      if (marketCap != null && price != null && price > 0) return marketCap / price;
      return undefined;
    })();
  const name = str(pr.longName) ?? str(pr.shortName) ?? symbol.toUpperCase();

  // No company fundamentals (e.g. ETF/index) → score doesn't apply. A fund can
  // still report a (basket) P/E, so a lone P/E isn't enough — require at least
  // one genuinely company-level metric.
  if (profitMargins == null && roe == null && revGrowth == null && earnGrowth == null)
    return null;
  if (price == null) return null;

  // Wrong-security guard. A newly-renamed or thinly-covered ticker can collide
  // with an unrelated security in the data source (e.g. "PSKY" returning a $1.20
  // small-cap instead of Paramount Skydance at ~$10). Cross-check the scorecard
  // price against an independent live quote for the SAME requested symbol; if
  // they disagree by more than ~2x, the fundamentals are for a different company
  // — refuse to publish rather than show a flatly wrong price.
  // We reuse the same live quote for the market cap (below), since the v7 quote's
  // marketCap tracks the current price intraday — fresher than the fundamentals
  // snapshot.
  let liveMarketCap: number | undefined;
  let liveShares: number | undefined;
  try {
    const q = (await yahooQuotes([symbol])).get(symbol.toUpperCase());
    const qp = q?.price;
    liveMarketCap = q?.marketCap;
    liveShares = q?.sharesOutstanding;
    if (qp != null && qp > 0) {
      const ratio = qp / price;
      if (ratio > 2 || ratio < 0.5) {
        console.warn(`[score] price mismatch for ${symbol}: fundamentals ${price} vs quote ${qp} — suppressing`);
        return null;
      }
    }
  } catch {
    /* only suppress on a confident contradiction; ignore quote errors */
  }

  // Live market cap, freshest first: the v7 quote's marketCap → live price ×
  // current shares outstanding → the (laggy) fundamentals snapshot. This keeps
  // the size shown on peer cards, the screener and snapshots current with the
  // market instead of frozen at an older fundamentals refresh.
  const liveMarketCapDerived =
    price != null && price > 0 && (liveShares ?? sharesOutstanding) != null && (liveShares ?? sharesOutstanding)! > 0
      ? price * (liveShares ?? sharesOutstanding)!
      : undefined;
  const marketCapLive = liveMarketCap ?? liveMarketCapDerived ?? marketCap;

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

  // Eligibility — a trailing DCF is only MEANINGFUL for a company that actually
  // converts to cash and earns a profit. We require:
  //   • positive real trailing free cash flow (TTM), and
  //   • positive through-cycle free cash flow (the median base), and
  //   • current GAAP profitability.
  // This deliberately suppresses the estimate for loss-making or cash-burning
  // names (e.g. heavy data-centre build-outs like NBIS), where a trailing DCF is
  // "the trailing-cash-flow trap": it prints a misleadingly high or negative
  // number. Showing nothing — and leaning on the analyst lens — is far safer
  // than publishing a wrong valuation.
  // Compute the cash-flow value whenever we can do it honestly: a positive
  // cash-flow base (real free cash flow, or operating cash flow for reinvestment-
  // heavy names) and a known share count, in a consistent currency. We no longer
  // gate on GAAP profitability or a positive FCF — a cash-generative company
  // should always surface a cash-flow value. A true cash-burner (no positive
  // operating cash flow at all) still can't produce one, and the honest fallback
  // note covers that rare case.
  const dcfComputable =
    baseCashflow != null && baseCashflow > 0 && sharesOutstanding != null && sharesOutstanding > 0;
  // Deep-cyclical commodity producers (metals, mining, oil & gas) do NOT compound
  // their cash flows — those swing with commodity prices. Extrapolating a
  // historical growth rate off a cyclical peak is exactly what inflates a name
  // like Vedanta to a fantasy "239% below fair value". For these we value the
  // through-cycle median cash flow with ~no real growth (terminal-rate only) and a
  // higher, cyclical cost of capital — a normalised mid-cycle read, not a peak
  // extrapolation.
  const sectorLc = (str(ap.sector) ?? "").toLowerCase();
  const isCyclicalCommodity =
    sectorLc.includes("basic materials") || sectorLc.includes("energy");
  // Discount at the listing's home-market cost of equity (Indian cash flows can't
  // be discounted at a US 9%). Cyclical commodity producers get a further risk
  // premium AND ~no real growth, so the estimate is a normalised mid-cycle read
  // rather than an extrapolation of a peak year.
  const discountRate = costOfEquity(financialCurrency ?? priceCurrency);
  const cfRaw = dcfComputable
    ? isCyclicalCommodity
      ? dcfPerShare(baseCashflow, sharesOutstanding, 0.025, discountRate + 0.02)
      : dcfPerShare(baseCashflow, sharesOutstanding, cashflowGrowth, discountRate)
    : undefined;
  // Sanity band only — reject clearly-broken data (e.g. a unit mismatch that
  // slips past the currency check), NOT to second-guess a legitimate low/high
  // estimate. Kept wide so a genuine value is essentially always shown.
  const cfPerShare =
    cfRaw != null &&
    currencyOk &&
    cfRaw > 0 &&
    cfRaw >= price * 0.02 &&
    cfRaw <= price * 25
      ? cfRaw
      : undefined;

  // Sector-appropriate valuation: pick the right multiple for the company's
  // sector, apply a typical benchmark to its own figures, and read over/under.
  const eps = num(ks.trailingEps) ?? num(fd.epsTrailingTwelveMonths) ?? (pe != null && pe > 0 ? price / pe : undefined);
  const sectorValuation = currencyOk
    ? computeSectorValuation({
        sector: str(ap.sector),
        industry: str(ap.industry),
        price,
        shares: sharesOutstanding,
        profitMargins,
        revGrowth,
        eps,
        bookValuePerShare: num(ks.bookValue),
        ebitda: num(fd.ebitda),
        revenue: num(fd.totalRevenue) ?? num(ks.totalRevenue),
        netDebt: (totalDebt ?? 0) - (totalCash ?? 0),
        pe,
        priceToBook: num(ks.priceToBook),
        evToEbitda: num(ks.enterpriseToEbitda),
        evToRevenue: num(ks.enterpriseToRevenue),
      })
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
            note: isCyclicalCommodity
              ? "A discounted-cash-flow estimate for a CYCLICAL commodity producer. Because these cash flows swing with commodity prices rather than compound, we value the through-cycle median cash flow with essentially no real growth and a higher, cyclical cost of capital — a normalised mid-cycle read, not an extrapolation of a peak year. Model-based, not advice."
              : baseIsOcf
              ? "A discounted-cash-flow estimate built from the company's trailing OPERATING cash flow (through-cycle median), grown at its own historical rate fading to a sustainable pace and discounted back. Operating cash flow is used here because this is a capital-heavy business whose free cash flow (after heavy reinvestment) is lumpy or negative — so it reads before that reinvestment. Model-based, not advice."
              : "A discounted-cash-flow estimate built from the company's REAL trailing free cash flow (through-cycle median), grown at its own historical rate fading to a sustainable pace and discounted back. Model-based, not advice.",
          }
        : undefined,
    sectorValuation,
    rewards: rewards.slice(0, 4),
    riskFlags: riskFlags.slice(0, 4),
  };

  return {
    analytics,
    price,
    name,
    target,
    targetHigh,
    targetLow,
    recommendation,
    numAnalysts,
    marketCap: marketCapLive,
    revenueGrowth: revGrowth,
    earningsGrowth: earnGrowth,
    priceToSales,
    trailingPE: pe,
    currency: priceCurrency,
  };
}
