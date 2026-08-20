import type {
  CompanyAnalytics,
  ScoreAxis,
  ScoreCheck,
  ScoreAxisKey,
} from "@/data/demo";
import { yahooQuoteSummary, resolveYahooSymbol, yahooQuotes } from "@/lib/yahooCrumb";
import { getYahooStatements } from "@/lib/yahooCompany";
import { knownFund } from "@/data/knownFunds";
import { financialHealthModel, type HealthModel } from "@/lib/financialHealth";
import {
  balanceSheetAxis,
  ratio,
  PCR_TOTAL,
  type BalanceSheetModel,
  type BankMetrics,
  type Metric,
  type NbfcMetrics,
} from "@/lib/balanceSheet";

// The two model unions are declared separately so each file stays importless
// and independently testable. This is what stops them drifting: if either gains
// or loses a member, one of these two lines fails to compile.
const _modelsAgree: BalanceSheetModel = "industrial" as HealthModel;
const _modelsAgreeBack: HealthModel = "industrial" as BalanceSheetModel;
void _modelsAgree;
void _modelsAgreeBack;
import {
  intrinsicValuePerShare,
  isFinancialInstitution,
  costOfEquity,
} from "@/lib/valuationModel";

// The models themselves live in valuationModel.ts — pure, importless, and
// therefore testable. Re-exported here so the existing call sites keep working.
export {
  cashflowValuePerShare,
  excessReturnValuePerShare,
  financialValuePerShare,
  intrinsicValuePerShare,
  isFinancialInstitution,
  costOfEquity,
  terminalGrowthFor,
  VALUATION_MODEL_VERSION,
} from "@/lib/valuationModel";
export type { IntrinsicValue, ValuationMethod } from "@/lib/valuationModel";

// Builds a Quantifi Score from Yahoo Finance fundamentals (keyless, personal
// non-commercial use). The cookie/crumb handshake and retries live in
// yahooCrumb.ts so every Yahoo lib shares one cached, resilient crumb. Returns
// null on any failure — or for funds/indexes — so callers fall back gracefully.

/**
 * The Balance Sheet Strength axis, sourced under the model the company needs.
 *
 * What this can and cannot get, stated plainly, because the honest answer for a
 * bank today is mostly "cannot":
 *
 *   • Industrial companies: all three measures come from the quote payload that
 *     is already in hand. Unchanged, and unchanged deliberately — the old
 *     checks were never wrong for the companies they were written for.
 *
 *   • Banks and non-bank lenders: the STRUCTURAL ratios are derivable from the
 *     balance sheet — how the book is funded, how much of the assets it is, how
 *     levered the whole thing is. Asset quality and regulatory capital are not.
 *     Gross and net NPAs, provision coverage, CET1 and CRAR are published in the
 *     company's own filings, its investor presentations and its Basel/Pillar-3
 *     disclosures, and none of them appear in a generic quote feed under any
 *     spelling. A dedicated filings adapter is the only way to get them, and
 *     until one exists those checks stay "unavailable" and the card says
 *     "Insufficient bank data" rather than scoring a bank on a third of its
 *     picture.
 *
 *   • Insurers: solvency, combined ratio, persistency and reserve adequacy are
 *     regulatory filings end to end. Nothing here sources them, and the card
 *     says so.
 *
 * That is a smaller claim than the old 0/10 made, and it is the true one.
 * Publishing "Fragile" for a bank whose bad loans are near one per cent was
 * worse than publishing nothing.
 */
async function balanceSheetStrength(
  symbol: string,
  model: HealthModel,
  quote: {
    currentRatio?: number;
    debtToEquity?: number;
    totalCash?: number;
    totalDebt?: number;
  }
): Promise<ScoreAxis> {
  if (model === "industrial") {
    return balanceSheetAxis("industrial", {
      industrial: {
        currentRatio: { value: quote.currentRatio, source: "Yahoo Finance financialData", derived: false },
        // Yahoo reports this as a percentage — 152 means 1.52x — and reading it
        // as a multiple would call a normally-financed company reckless.
        debtToEquity: {
          value: quote.debtToEquity != null ? quote.debtToEquity / 100 : undefined,
          definition: "total debt / total shareholder equity",
          source: "Yahoo Finance financialData",
          derived: true,
        },
        cashToDebt: {
          value:
            quote.totalCash != null && quote.totalDebt != null && quote.totalDebt > 0
              ? quote.totalCash / quote.totalDebt
              : undefined,
          definition: "cash and equivalents / total debt",
          source: "Yahoo Finance financialData",
          derived: true,
        },
      },
    });
  }

  if (model === "life-insurer" || model === "general-insurer") {
    // Every measure an insurer is judged on — solvency against the regulatory
    // minimum, combined and loss ratios, reserve adequacy, persistency — is a
    // regulatory filing. None of it is reachable from here, so the axis reports
    // that rather than substituting the measures it CAN reach, which would be
    // the original bug wearing a different label.
    return balanceSheetAxis(model, {});
  }

  // Banks and non-bank lenders. One balance-sheet date, so every ratio below is
  // built from figures of the same vintage and the same scope; ratio() refuses
  // the combination otherwise.
  let latest: { date?: string; values: Record<string, number | undefined> } | undefined;
  try {
    const ts = await getYahooStatements(symbol);
    latest = ts.balance[0];
  } catch {
    /* no statements → every structural check is unavailable, which is correct */
  }

  const m = (key: string, definition?: string): Metric =>
    latest?.values[key] != null
      ? {
          value: latest.values[key],
          asOf: latest.date,
          scope: "consolidated",
          source: "Yahoo Finance fundamentals timeseries",
          definition,
          derived: false,
        }
      : { unavailableReason: "Not published in the balance sheet feed for this company." };

  const NOT_IN_FEED: Metric = {
    unavailableReason:
      "Published in the company's own filings and Basel/Pillar-3 disclosures, not in the current data source.",
  };

  const assets = m("totalAssets");
  const equity = m("totalEquity");
  const liabilities = m("totalLiabilities");
  const deposits = m("deposits", "customer deposits");
  const netLoans = m("netLoans", "net advances");

  const structural = {
    depositFunding: ratio(deposits, liabilities, { definition: "customer deposits / total liabilities" }),
    loansToDeposits: ratio(netLoans, deposits, { definition: "net advances / customer deposits" }),
    loansToAssets: ratio(netLoans, assets, { definition: "net advances / total assets" }),
    assetsToEquity: ratio(assets, equity, { definition: "total assets / shareholder equity" }),
  };

  if (model === "bank") {
    const bank: BankMetrics = {
      grossNpaRatio: NOT_IN_FEED,
      netNpaRatio: NOT_IN_FEED,
      provisionCoverage: { ...NOT_IN_FEED, definition: PCR_TOTAL },
      capitalBufferPoints: NOT_IN_FEED,
      ...structural,
    };
    return balanceSheetAxis("bank", { bank });
  }

  // A non-bank lender gets no deposit-funding check at all. Most are not
  // licensed to take deposits, so the measure does not apply to them — and
  // scoring a company against a bar it is legally barred from clearing is
  // exactly the mistake this whole change exists to undo.
  const nbfc: NbfcMetrics = {
    crarBufferPoints: NOT_IN_FEED,
    tier1BufferPoints: NOT_IN_FEED,
    stage3Ratio: NOT_IN_FEED,
    provisionCoverage: NOT_IN_FEED,
    assetLiabilityGap: NOT_IN_FEED,
    liquidityCoverage: NOT_IN_FEED,
    largestFundingShare: NOT_IN_FEED,
    securedShare: NOT_IN_FEED,
    largestExposureShare: NOT_IN_FEED,
    gearing: ratio(m("totalDebt"), equity, { definition: "total borrowings / shareholder equity" }),
  };
  return balanceSheetAxis("nbfc", { nbfc });
}

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

/**
 * An axis built from checks that were all evaluated.
 *
 * The other four axes read fields that either arrive or do not, and where they
 * do not the check genuinely fails — a company with no dividend yield does not
 * pay a dividend. Balance Sheet Strength is different, and does not come
 * through here: see balanceSheetAxis, which distinguishes a metric we could not
 * source from one the company failed.
 */
function axis(checks: ScoreCheck[]): ScoreAxis {
  const passed = checks.filter((c) => c.status === "pass").length;
  const score = checks.length ? Math.round((passed / checks.length) * 6) : 0;
  return { score, checks, sufficient: true };
}

const c = (label: string, pass: boolean): ScoreCheck => ({
  label,
  status: pass ? "pass" : "fail",
});
const fpct = (x: number | undefined): string =>
  x == null ? "n/a" : `${(x * 100).toFixed(0)}%`;

// The through-cycle cash-flow base, extracted so the live score and the
// historical reconstruction cannot drift apart. Raw free cash flow is the wrong
// input on its own: it is negative in the investment years of any capital-heavy
// business, and valuing only the positive years cherry-picks a small,
// unrepresentative base. So this blends the median with a recency-weighted mean
// (capped at 2x the median, so one exceptional year can't run away), and offers
// normalised owner earnings — through-cycle operating cash flow less
// through-cycle capex — as the fallback when free cash flow is negative through
// the cycle. That fallback still charges for capital spending.
export function throughCycleCashflow(
  fcfSeries: number[],
  ocfSeries: number[],
  capexSeries: number[]
): { medFcf: number | undefined; normalisedOwnerEarnings: number | undefined } {
  const blend = (series: number[]): number | undefined => {
    const m = median(series);
    const w = recencyWeightedMean(series);
    if (m == null || w == null) return m ?? w;
    return m > 0 ? Math.min(Math.max(m, w), m * 2) : w;
  };
  const medOcf = blend(ocfSeries);
  const medCapex = blend(capexSeries);
  return {
    medFcf: blend(fcfSeries),
    normalisedOwnerEarnings:
      medOcf != null && medCapex != null ? medOcf - medCapex : undefined,
  };
}

// Share of accounting profit the business actually keeps as cash. Clamped to
// 25–100%, with the floor lifted to 60% for a demonstrably expanding company:
// its shortfall is growth capex, which is discretionary and buys the growth the
// model then projects, so freezing today's ratio as a permanent haircut
// double-counts it.
export function clampConversion(raw: number, expanding: boolean): number {
  return Math.min(1, Math.max(expanding ? 0.6 : 0.25, raw));
}

// Value a year on its reported profit when cash flow can't carry the valuation.
//
// This is the historical twin of the live model's forward-earnings path. Banks
// are the case that forces it: lending growth is an operating outflow, so a
// growing bank reports negative operating cash flow year after year and a
// cash-flow base never exists — Kotak Mahindra reconstructs to nothing on cash
// alone, in every year on record. Profit is the number that actually describes
// such a business, and unlike consensus forward earnings it IS reported for
// past years. Converted at the company's own rate so a capital-hungry business
// is still charged for its reinvestment rather than credited with profit it
// never keeps.
export function earningsCashBase(
  netIncome: number | undefined,
  medFcf: number | undefined,
  referenceNetIncome: number | undefined,
  expanding: boolean
): number | undefined {
  if (netIncome == null || !(netIncome > 0)) return undefined;
  const raw =
    medFcf != null && referenceNetIncome != null && referenceNetIncome > 0
      ? medFcf / referenceNetIncome
      : 0.6; // no clean read → a conservative default conversion
  return netIncome * clampConversion(raw, expanding);
}

// Pick the base the DCF should run on, in the live model's order of preference.
export function pickBaseCashflow(
  fcfSeries: number[],
  ocfSeries: number[],
  capexSeries: number[]
): number | undefined {
  const { medFcf, normalisedOwnerEarnings } = throughCycleCashflow(
    fcfSeries,
    ocfSeries,
    capexSeries
  );
  if (medFcf != null && medFcf > 0) return medFcf;
  if (normalisedOwnerEarnings != null && normalisedOwnerEarnings > 0)
    return normalisedOwnerEarnings;
  return undefined;
}

// Growth to pair with that base. Operating cash flow first — it is steadier
// than free cash flow, which swings with the capex cycle.
export function cashflowGrowthFrom(
  ocfSeries: number[],
  fcfSeries: number[]
): number | undefined {
  return cagr(ocfSeries) ?? cagr(fcfSeries);
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

// Recency-weighted mean (oldest year weight 1 … newest weight n). A plain median
// treats a five-year-old figure exactly like last year's, which badly understates a
// business that has structurally re-rated (a memory super-cycle, a new product
// ramp) — and overstates one in structural decline. Weighting by recency keeps the
// whole cycle in view while letting the current regime dominate.
function recencyWeightedMean(series: number[]): number | undefined {
  if (!series.length) return undefined;
  let num = 0;
  let den = 0;
  series.forEach((v, i) => {
    const w = i + 1; // series is oldest → newest
    num += v * w;
    den += w;
  });
  return den > 0 ? num / den : undefined;
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
    return { clusterLabel: "Banks & Financial Institutions", method: "P / B (price to book)", metricShort: "P/B", kind: "pb", benchmark: 1.2, why: "For lenders debt is raw material, not a capital-structure choice, so EV/EBITDA is mis-specified; book value and P/B are the cleaner lens." };
  if (s.includes("real estate"))
    return { clusterLabel: "Real Estate", method: "Net asset value (book proxy)", metricShort: "P/B", kind: "pb", benchmark: 1.0, navFloor: true, why: "A property company's value is tied to the appraised value of its land and buildings." };
  if (s.includes("basic materials") || s.includes("energy"))
    return { clusterLabel: "Commodities & Resources", method: "Asset value (book proxy)", metricShort: "P/B", kind: "pb", benchmark: 1.2, navFloor: true, why: "Producers are valued off the worth of reserves and physical assets; an asset/NAV lens fits better than earnings multiples through the cycle." };
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
    return { clusterLabel: "Technology", method: "P / E", metricShort: "P/E", kind: "pe", benchmark: 24, why: "A profitable tech compounder; an earnings multiple with a growth premium is the cleanest read." };
  }
  // Any not-yet-profitable company (in any sector outside banks / real estate /
  // telecom / commodities, which have their own asset- or EBITDA-based lens):
  // earnings multiples don't apply, so fall back to a revenue multiple — the
  // same EV/Sales lens SaaS uses. This is what lets a loss-making growth name
  // still get an independent valuation instead of no card at all.
  if (profitMargins != null && profitMargins <= 0)
    return { clusterLabel: "High-Growth / Pre-Profit", method: "EV / Sales", metricShort: "EV/Sales", kind: "ev_sales", benchmark: 5, why: "Not yet profitable, so earnings multiples don't apply; a revenue multiple (EV/Sales) is the working lens until profits arrive." };
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
  const mult = (n: number | undefined) => (n != null && isFinite(n) ? `${n.toFixed(1)}×` : "n/a");

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
      note: `${cfg.clusterLabel}; ${cfg.why} Book value is only a CONSERVATIVE NAV floor: property and land are carried at historical cost, so the true appraised NAV is typically well above book; and isn't available from our data source. Treat it as a floor, not a price target; a name trading above book isn't necessarily overvalued.`,
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

  // Is a market-average multiple actually DESCRIPTIVE of this business?
  //
  // When a company trades nowhere near the benchmark — Avenue Supermarts at ~82x
  // earnings against an ~18x "broad market" yardstick — multiplying its EPS by 18
  // doesn't produce a fair value, it just restates "this has a high P/E" with false
  // precision, and then labels a quality compounder "78% overvalued". A durable
  // compounder can sustain a premium for years; a structurally challenged business
  // can sit at a discount just as long. So when the company's own multiple is far
  // outside the benchmark we still SHOW the comparison (it's useful context) but
  // stop asserting a target: no bar, and the tag states the multiples rather than
  // delivering an over/under verdict.
  if (
    current != null &&
    isFinite(current) &&
    current > 0 &&
    (current > cfg.benchmark * 2.5 || current < cfg.benchmark * 0.4)
  ) {
    return {
      sector: cfg.clusterLabel,
      method: cfg.method,
      metricLabel: `${cfg.metricShort} ${mult(current)} vs ~${cfg.benchmark}× typical`,
      estimate,
      valueLabel: `Value at ~${cfg.benchmark}× ${cfg.metricShort}`,
      tag: `${mult(current)} vs ~${cfg.benchmark}× typical`,
      tagUnder: current < cfg.benchmark,
      showBar: false,
      note: `${cfg.clusterLabel}; normally valued on ${cfg.method}. This company trades a long way from the ~${cfg.benchmark}× ${cfg.metricShort} market average, so that average doesn't describe it: a durable compounder can hold a premium for years, and a structurally challenged business a discount. The figure shown is simply what a ~${cfg.benchmark}× multiple would imply; read it as context, NOT a price target, and compare against direct competitors in Peers below.`,
    };
  }

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
    note: `${cfg.clusterLabel}; valued on ${cfg.method}. ${cfg.why} Fair value applies a ~${cfg.benchmark}× ${cfg.metricShort} sector benchmark to the company's own figures. A sector heuristic, not a precise target.`,
  };
}

export async function getYahooScore(symbol: string): Promise<LiveScore | null> {
  // Curated funds Yahoo misclassifies as equities (e.g. DXYZ) must never be
  // company-scored — route them straight to the ETF X-ray.
  if (knownFund(symbol)) return null;

  const modules =
    "quoteType,summaryDetail,defaultKeyStatistics,financialData,price,topHoldings,cashflowStatementHistory,assetProfile,earningsTrend";
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
  const capexSeries: number[] = []; // magnitude of capital spending (positive)
  for (let i = statements.length - 1; i >= 0; i--) {
    const st = statements[i];
    const ocf = num(st.totalCashFromOperatingActivities);
    const capex = num(st.capitalExpenditures); // reported negative (an outflow)
    if (ocf != null) {
      ocfSeries.push(ocf);
      fcfSeries.push(capex != null ? ocf + capex : ocf);
      if (capex != null) capexSeries.push(Math.abs(capex));
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
          if (capex != null) capexSeries.push(Math.abs(capex));
        }
      }
    } catch {
      /* leave empty → DCF simply won't publish, which is the honest fallback */
    }
  }
  // ── Forward-looking inputs (analyst consensus) ────────────────────────────
  // A purely trailing DCF prices the LAST cycle, not the next one. For a cyclical
  // at a trough — Samsung mid memory-bust, with peak fab capex — the trailing
  // record says "shrinking, cash-negative" exactly when analysts are modelling the
  // recovery. That single difference is why a trailing model and a forward one can
  // disagree by multiples on the same company (and agree closely on a steady
  // compounder like Alphabet, where trailing ≈ forward).
  const trend = ((result.earningsTrend ?? {}) as Record<string, unknown>).trend;
  const trendRows = Array.isArray(trend) ? (trend as Record<string, unknown>[]) : [];
  const trendFor = (period: string) => trendRows.find((t) => str(t.period) === period);
  const growthOf = (period: string): number | undefined => {
    const g = num(trendFor(period)?.growth);
    return g != null && isFinite(g) ? g : undefined;
  };
  // Long-term (5-year) consensus growth first, then next-year, then this-year.
  const analystGrowth = growthOf("+5y") ?? growthOf("+1y") ?? growthOf("0y");
  // Consensus EPS for the next full year → forward earnings power.
  //
  // Yahoo's earningsTrend module is sparse outside the US — for Indian mid-caps it
  // frequently comes back empty, which silently dropped the whole forward-looking
  // path and left those names valued off the trailing trough alone (exactly the
  // case that made a compounder like Trent read far too cheap). forwardPE is
  // populated far more widely, so derive forward EPS from it as a last resort.
  const fwdPe = num(sd.forwardPE) ?? num(ks.forwardPE);
  const fwdEpsEstimate =
    num(
      ((trendFor("+1y")?.earningsEstimate ?? {}) as Record<string, unknown>).avg
    ) ??
    num(ks.forwardEps) ??
    (fwdPe != null && fwdPe > 0 && price != null && price > 0 ? price / fwdPe : undefined);

  // Growth signal, most forward-looking first: analyst consensus growth, then the
  // company's own operating-cash-flow CAGR (steadier than FCF), then FCF CAGR,
  // then income-statement growth. cagr() returns undefined unless both endpoints
  // are positive, so a loss-making history can't produce a nonsense rate.
  // Yahoo's long-term consensus is frequently a rounded placeholder — Trent comes
  // back as exactly 0.20 while the company's own earnings are compounding at 25.8%.
  // Where the company's OWN recent growth corroborates a higher rate than the
  // consensus, take the higher of the two; the 25% cap, the two-stage fade and the
  // terminal rate all still bound the result.
  const corroboratedGrowth =
    analystGrowth != null && earnGrowth != null && earnGrowth > analystGrowth
      ? earnGrowth
      : analystGrowth;
  const cashflowGrowth =
    corroboratedGrowth ??
    cagr(ocfSeries) ??
    cagr(fcfSeries) ??
    forwardGrowth(revGrowth, earnGrowth);

  // TTM free cash flow (Yahoo reports it directly; else the latest statement).
  const fcfTTM =
    num(fd.freeCashflow) ??
    (fcfSeries.length ? fcfSeries[fcfSeries.length - 1] : undefined);

  // Through-cycle base = the median of EVERY reported free-cash-flow year.
  //
  // It deliberately does NOT filter to positive years. Doing so silently discarded
  // the heavy-investment years of capital-intensive cyclicals (Samsung's fab
  // build-outs, a miner's expansion phase) and took the median of whatever was
  // left — i.e. only the low-capex years. That cherry-picked a small,
  // unrepresentative base and valued the whole company off it, which is how a
  // ₩209,500 share ended up "worth" ₩64,550. The median across all years is the
  // honest through-cycle figure: robust to a single trough or peak, without
  // pretending the investment years didn't happen.
  //
  // The median alone still has a blind spot: it weights a five-year-old year the
  // same as last year, so a company mid-inflection (Samsung's HBM/AI-memory ramp)
  // gets valued off a stale average. So we take the recency-weighted mean too and
  // use the higher of the two — capped at 2x the median so one exceptional year
  // can't run away with the valuation.
  const { medFcf, normalisedOwnerEarnings: noeShared } = throughCycleCashflow(
    fcfSeries,
    ocfSeries,
    capexSeries
  );

  // If free cash flow is negative through the cycle, the company is reinvesting
  // more than it generates. Normalised owner earnings (through-cycle operating
  // cash flow LESS through-cycle capex) is the fallback — note it still charges
  // for capital spending. We no longer fall back to raw operating cash flow: that
  // ignores capex entirely, and for a business spending tens of trillions on
  // capacity it overstates distributable cash just as badly in the other
  // direction.
  // Same recency-weighted treatment, so the fallback tracks the current regime too.
  const normalisedOwnerEarnings = noeShared;

  let baseCashflow: number | undefined;
  let baseIsOcf = false; // true → base is normalised owner earnings, not plain FCF
  if (medFcf != null && medFcf > 0) baseCashflow = medFcf;
  else if (normalisedOwnerEarnings != null && normalisedOwnerEarnings > 0) {
    baseCashflow = normalisedOwnerEarnings;
    baseIsOcf = true;
  } else if (fcfTTM != null && fcfTTM > 0) baseCashflow = fcfTTM;
  else baseCashflow = undefined; // no free cash through the cycle → no DCF

  // Was the cash-flow record volatile enough that a trailing DCF is fragile? Any
  // loss-making-on-a-cash-basis year in the window means the base is an average of
  // very different regimes, so we surface that caveat with the estimate instead of
  // presenting it as a precise figure.
  const negativeFcfYears = fcfSeries.filter((v) => v <= 0).length;
  const cashflowVolatile = fcfSeries.length >= 2 && negativeFcfYears > 0;
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
        console.warn(`[score] price mismatch for ${symbol}: fundamentals ${price} vs quote ${qp}, suppressing`);
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

  // ── Balance Sheet Strength, under the right model ─────────────────────────
  //
  // HDFC Bank used to score 0/10 here and be labelled "Fragile", because every
  // company on earth was measured against a manufacturer's balance sheet:
  // current ratio above 1, debt/equity below 1x, more cash than debt. A bank
  // fails all three by construction — its liabilities are demand deposits, it
  // is levered eight to ten times because that is what a bank IS, and cash
  // earns nothing so it holds as little as it can. The score was measuring the
  // distance between a bank and a factory.
  //
  // So the industry picks the checklist, and a financial institution never
  // reaches the industrial one. Not down-weighted: not reached.
  const healthModel = financialHealthModel(str(ap.industry), str(ap.sector));
  const health = await balanceSheetStrength(symbol, healthModel, {
    currentRatio,
    debtToEquity,
    totalCash,
    totalDebt,
  });

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
    health,
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
  if (healthModel === "industrial" && totalCash != null && totalDebt != null && totalCash > totalDebt)
    rewards.push("More cash on hand than total debt.");
  if (target != null && price < target) rewards.push("Trades below analysts' average price target.");
  if (divYield != null && divYield > 0.02) rewards.push(`Pays a dividend (${fpct(divYield)} yield).`);

  if (profitMargins != null && profitMargins <= 0) riskFlags.push("Currently unprofitable.");
  // The same yardstick problem, in prose. "Elevated debt (debt/equity 7.6x)" is
  // a true sentence about a lender and a meaningless warning: a lender with no
  // leverage has no business. Both of these are industrial readings and stay
  // with industrial companies.
  if (healthModel === "industrial" && debtToEquity != null && debtToEquity >= 100)
    riskFlags.push(`Elevated debt (debt/equity ${(debtToEquity / 100).toFixed(1)}x).`);
  if (pe != null && pe > 40) riskFlags.push(`Rich valuation (P/E ${pe.toFixed(0)}).`);
  if (target != null && price > target) riskFlags.push("Trades above analysts' average price target.");
  if (healthModel === "industrial" && currentRatio != null && currentRatio < 1)
    riskFlags.push("Short-term liabilities exceed short-term assets.");
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
  // ── Forward earnings power as an alternative base ─────────────────────────
  // Trailing cash flow describes the cycle that just happened. When consensus
  // forward earnings are materially HIGHER than the trailing base — the signature
  // of a cyclical coming out of a trough — valuing off the trough alone understates
  // the business. We convert forward earnings to a cash-flow equivalent using the
  // company's OWN historical cash conversion (free cash flow ÷ net income), so a
  // capital-hungry business is still charged for its reinvestment rather than
  // being credited with accounting profit it never keeps. Clamped to 25–100% so a
  // freak conversion ratio can't distort it, and we only ever take the HIGHER of
  // trailing and forward, never a lower one — the estimate stays conservative.
  let forwardBase: number | undefined;
  let usedForwardBase = false;
  if (fwdEpsEstimate != null && sharesOutstanding != null && sharesOutstanding > 0) {
    const forwardNetIncome = fwdEpsEstimate * sharesOutstanding;
    const trailingNetIncome = num(ks.netIncomeToCommon);
    const rawConversion =
      medFcf != null && trailingNetIncome != null && trailingNetIncome > 0
        ? medFcf / trailingNetIncome
        : 0.6; // no clean read → a conservative default conversion
    // A company in a heavy expansion phase converts little of its profit into free
    // cash — but that shortfall is GROWTH capex, which is discretionary and buys
    // the very growth this model then projects. Freezing the expansion-phase ratio
    // as a permanent haircut double-counts it. Trent converts ~36% of profit today
    // because it is building out Zudio, not because its economics are poor; only
    // MAINTENANCE capex (roughly depreciation) is a true ongoing charge. So when
    // the business is demonstrably expanding, floor the conversion nearer a
    // steady-state level instead of assuming it reinvests at this rate forever.
    const expanding = revGrowth != null && revGrowth > 0.15;
    const conversion = clampConversion(rawConversion, expanding);
    const candidate = forwardNetIncome * conversion;
    if (candidate > 0 && (baseCashflow == null || candidate > baseCashflow)) {
      forwardBase = candidate;
    }
  }
  if (forwardBase != null) {
    baseCashflow = forwardBase;
    usedForwardBase = true;
  }

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
  const rateCurrency = financialCurrency ?? priceCurrency;
  const betaRaw = num(sd.beta) ?? num(ks.beta);
  const discountRate = costOfEquity(rateCurrency, betaRaw);

  // ── Which valuation does this company get? ────────────────────────────────
  //
  // Banks, insurers and other lenders are routed AWAY from the cash-flow model
  // before a cash-flow figure is consulted. A bank's free cash flow is an
  // accounting artefact — lending growth is an operating outflow — and running a
  // DCF on it is what produced HDFC Bank's ₹3,171.55 next to a P/B read of
  // ₹472.58. They get an excess-return (residual-income) valuation instead, with
  // P/B as the fallback; never bank operating cash flow.
  //
  // The rule lives in intrinsicValuePerShare, which is the ONLY place this file
  // reaches a valuation model. Calling dcfPerShare from here would be a second
  // door into the model with no lock on it.
  const isFinancial = isFinancialInstitution(str(ap.sector), str(ap.industry));
  const bookValuePerShare = num(ks.bookValue);
  const roeRaw = num(fd.returnOnEquity);
  const intrinsic = currencyOk
    ? intrinsicValuePerShare({
        sector: str(ap.sector),
        industry: str(ap.industry),
        price,
        currency: rateCurrency,
        beta: betaRaw,
        baseCashflow,
        shares: sharesOutstanding,
        growth: cashflowGrowth,
        cyclical: isCyclicalCommodity,
        bookValuePerShare,
        roe: roeRaw,
        payoutRatio: num(sd.payoutRatio),
      })
    : undefined;
  // The DCF number, and only the DCF number. Watchlist, Rare Finds and the
  // screeners rank on this field, so it has to stay strictly "the cash-flow
  // model said so" — a bank appearing here is a bank being ranked on a valuation
  // that doesn't apply to it.
  const cfPerShare = intrinsic?.method === "dcf" ? intrinsic.estimate : undefined;

  // Is the market paying a multiple a 10-year DCF simply cannot reach?
  //
  // Trent trades near 93x earnings. Even at a 25% growth rate with 100% of profit
  // converting to cash, this model tops out around 32x — so the gap isn't a
  // mispricing the model has detected, it's the model's own horizon running out.
  // The market is capitalising a decade-plus of expansion that a 10-year window
  // can't hold. Publishing "85% overvalued" there states a verdict the method
  // can't support, so above this threshold we keep the number as CONTEXT and drop
  // the over/under claim (same treatment as an off-scale sector benchmark).
  const cfOutOfRange =
    cfPerShare != null && pe != null && isFinite(pe) && pe > 45 && cfPerShare < price * 0.5;

  // One short line per method, describing what the number actually is.
  const intrinsicNote =
    intrinsic == null
      ? ""
      : intrinsic.method === "excess-returns"
      ? "A lender is worth its book value plus the returns it earns above its cost of equity, a bank's cash flow measures nothing here, so it isn't used. Model-based, not advice."
      : intrinsic.method === "pb"
      ? "Valued on book value at a typical sector multiple: the excess-return inputs (return on equity, book value) aren't complete enough to model the spread. Model-based, not advice."
      : (cfOutOfRange
          ? "Context, not a verdict: priced beyond what a 10-year model can span, so the gap is what the market pays for the years after that. "
          : "") +
        (isCyclicalCommodity
          ? "Normalised mid-cycle cash flow, valued with no real growth and a cyclical cost of capital."
          : usedForwardBase
          ? "Built from consensus forward earnings, converted to cash at the company's own historical rate."
          : baseIsOcf
          ? "Built from operating cash flow less capex; reported free cash flow is negative through the cycle."
          : "Built from the company's own free cash flow, weighted toward recent years.") +
        (cashflowVolatile ? " Free cash flow has been negative in some years; read it as a range." : "") +
        " Model-based, not advice.";

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
      note: "Analysts' average price target vs the current price; a research input, not advice.",
    },
    // The method-aware valuation — what the page shows. `method` names the model
    // that produced it, so the card can never label an excess-return figure as a
    // cash-flow one, and `modelVersion` stamps which revision of the models it
    // came from (a stored point from an older version is identifiable, and
    // purgeable, rather than silently mixed in with current ones).
    intrinsicValue:
      intrinsic != null
        ? {
            estimate: intrinsic.estimate,
            method: intrinsic.method,
            methodLabel: intrinsic.methodLabel,
            modelVersion: intrinsic.modelVersion,
            outOfRange: cfOutOfRange,
            note: intrinsicNote,
            // The inputs that produced this number, so a surprising estimate can
            // be diagnosed from the actual figures instead of guesswork. Surfaced
            // by /api/score/<symbol>?debug=1.
            debug: isFinancial
              ? {
                  method: intrinsic.method,
                  bookValuePerShare,
                  roe: roeRaw,
                  payoutRatio: num(sd.payoutRatio),
                  costOfEquity: discountRate,
                  priceToBook: num(ks.priceToBook),
                }
              : {
                  base: baseCashflow,
                  baseKind: isCyclicalCommodity
                    ? "cyclical-normalised"
                    : usedForwardBase
                    ? "forward-earnings"
                    : baseIsOcf
                    ? "owner-earnings"
                    : "trailing-fcf",
                  growthUsed: isCyclicalCommodity ? 0.025 : cashflowGrowth,
                  analystGrowth,
                  forwardEps: fwdEpsEstimate,
                  forwardPE: fwdPe,
                  discountRate,
                  shares: sharesOutstanding,
                  medianFcf: medFcf,
                  trailingNetIncome: num(ks.netIncomeToCommon),
                  fcfYears: fcfSeries.length,
                },
          }
        : undefined,
    // Kept as the DCF-only field it has always been, so every consumer that
    // ranks or screens on "the cash-flow value" keeps meaning exactly that. It
    // is undefined for a financial institution — which is the mechanism that
    // stops Watchlist, Rare Finds and the screeners ranking a bank on a model
    // that was never valid for it.
    cashflowValue:
      cfPerShare != null && intrinsic != null
        ? {
            estimate: cfPerShare,
            outOfRange: cfOutOfRange,
            note: intrinsicNote,
            debug: {
              base: baseCashflow,
              baseKind: isCyclicalCommodity
                ? "cyclical-normalised"
                : usedForwardBase
                ? "forward-earnings"
                : baseIsOcf
                ? "owner-earnings"
                : "trailing-fcf",
              growthUsed: isCyclicalCommodity ? 0.025 : cashflowGrowth,
              analystGrowth,
              forwardEps: fwdEpsEstimate,
              forwardPE: fwdPe,
              discountRate,
              shares: sharesOutstanding,
              medianFcf: medFcf,
              trailingNetIncome: num(ks.netIncomeToCommon),
              fcfYears: fcfSeries.length,
            },
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
