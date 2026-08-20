// What "balance sheet strength" means, per kind of company.
//
// No imports, so scripts/test-balance-sheet.mjs can compile and drive it.
//
// The bug this exists to fix: HDFC Bank scored 0/10 on Balance Sheet Strength
// and was labelled "Fragile". The three checks it was given were
//
//     current ratio above 1
//     debt to equity below 1x
//     more cash than total debt
//
// and a bank fails all three by construction. A bank has no current ratio worth
// the name because its liabilities are deposits repayable on demand and its
// assets are loans repayable over years; it is levered eight to ten times over
// because that is what a bank is; and it holds less cash than borrowings
// because cash earns nothing. Those are descriptions of a functioning bank, not
// weaknesses, and the score was measuring the distance between a bank and a
// manufacturer.
//
// Two separate faults produced the 0, and fixing either alone would have left a
// wrong number on screen:
//
//   1. The wrong checklist. Fixed by choosing the checklist from the industry —
//      and by splitting it finely enough that a bank, a non-bank lender and an
//      insurer are not handed each other's metrics either.
//   2. Missing data counted as failure. The old ScoreCheck carried a boolean
//      `pass`, so "we could not source this" and "this failed" were the same
//      value, and an absent metric became a red cross. A metric we do not have
//      is not evidence of anything. Hence CheckStatus, and hence a score
//      computed only over the checks that were actually evaluated.
//
// The second fault is why the safe outcome here is "Insufficient bank data"
// rather than a low score. Publishing 0/10 for a bank whose bad loans are near
// one per cent is worse than publishing nothing: nothing is honest.

// ── Provenance ──────────────────────────────────────────────────────────────

/** Standalone and consolidated accounts are different books, not variants. */
export type ReportingScope = "standalone" | "consolidated";

/**
 * One sourced number, with everything needed to know what it is.
 *
 * All of it travels with the value on purpose. A capital adequacy ratio without
 * a date is not comparable with a requirement that changed last year; a loan
 * book from the standalone accounts divided by deposits from the consolidated
 * ones is not a loans-to-deposits ratio; and a provision coverage of 80% means
 * two different things under the two definitions in common use. The ratio
 * helper below REFUSES those combinations rather than trusting the caller to
 * remember.
 */
export interface Metric {
  value?: number;
  /** The reporting date this figure is as of, YYYY-MM-DD. */
  asOf?: string;
  scope?: ReportingScope;
  /** Human label for where it came from, e.g. "FY25 annual report". */
  source?: string;
  sourceUrl?: string;
  /** Exactly which definition this number uses. Never assume there is only one. */
  definition?: string;
  /** True when we computed it, false/absent when the filer reported it. */
  derived?: boolean;
  /** Why there is no value, when there is no value. */
  unavailableReason?: string;
}

export const NO_METRIC: Metric = { unavailableReason: "Not sourced." };

const has = (m?: Metric): m is Metric & { value: number } =>
  m != null && typeof m.value === "number" && isFinite(m.value);

const DAY = 86400000;

/**
 * Divide one sourced figure by another, or refuse.
 *
 * Refuses when the two come from different reporting scopes, or from dates more
 * than a quarter apart. Both refusals are load-bearing: a loans-to-deposits
 * ratio built from a September loan book and a March deposit base is not a
 * loosely-dated ratio, it is a different number, and a bank that grew its book
 * 15% in between will read as far more loaned-up than it is.
 */
export function ratio(
  numerator: Metric | undefined,
  denominator: Metric | undefined,
  meta: { definition: string; toleranceDays?: number } 
): Metric {
  if (!has(numerator) || !has(denominator)) {
    return { unavailableReason: "One of the two figures was not sourced.", definition: meta.definition };
  }
  if (denominator.value === 0) {
    return { unavailableReason: "The denominator is zero.", definition: meta.definition };
  }
  if (numerator.scope && denominator.scope && numerator.scope !== denominator.scope) {
    return {
      unavailableReason: `Mismatched scope: ${numerator.scope} over ${denominator.scope}.`,
      definition: meta.definition,
    };
  }
  if (numerator.asOf && denominator.asOf) {
    const a = Date.parse(numerator.asOf);
    const b = Date.parse(denominator.asOf);
    const tolerance = (meta.toleranceDays ?? 95) * DAY;
    if (isFinite(a) && isFinite(b) && Math.abs(a - b) > tolerance) {
      return {
        unavailableReason: `Reporting dates too far apart: ${numerator.asOf} and ${denominator.asOf}.`,
        definition: meta.definition,
      };
    }
  }
  return {
    value: numerator.value / denominator.value,
    asOf: numerator.asOf ?? denominator.asOf,
    scope: numerator.scope ?? denominator.scope,
    source: numerator.source ?? denominator.source,
    sourceUrl: numerator.sourceUrl ?? denominator.sourceUrl,
    definition: meta.definition,
    derived: true,
  };
}

// ── Checks ──────────────────────────────────────────────────────────────────

/**
 * Three states, not two.
 *
 * "unavailable" is the whole point. It is not a soft fail and it must never be
 * rendered as one: it means we could not source the figure, which is a fact
 * about our data and not about the company.
 */
export type CheckStatus = "pass" | "fail" | "unavailable";

export interface ScoreCheck {
  label: string;
  status: CheckStatus;
  /** The figure the check read, so the reader can see what it judged. */
  value?: number;
  /** How the value should be rendered: a ratio, a percentage, a multiple. */
  unit?: "ratio" | "percent" | "times";
  /** The bar this check applies, in words. */
  threshold?: string;
  asOf?: string;
  scope?: ReportingScope;
  source?: string;
  sourceUrl?: string;
  definition?: string;
  derived?: boolean;
  /** Present only when the status is "unavailable". */
  unavailableReason?: string;
}

export interface CheckSpec {
  label: string;
  threshold: string;
  unit?: ScoreCheck["unit"];
  test: (value: number) => boolean;
}

/** Build one check from a sourced metric, or mark it unavailable. */
export function evaluate(spec: CheckSpec, metric?: Metric): ScoreCheck {
  const base = {
    label: spec.label,
    threshold: spec.threshold,
    unit: spec.unit,
    asOf: metric?.asOf,
    scope: metric?.scope,
    source: metric?.source,
    sourceUrl: metric?.sourceUrl,
    definition: metric?.definition,
    derived: metric?.derived,
  };
  if (!has(metric)) {
    return {
      ...base,
      status: "unavailable",
      unavailableReason: metric?.unavailableReason ?? "Not published by the current data source.",
    };
  }
  return { ...base, status: spec.test(metric.value) ? "pass" : "fail", value: metric.value };
}

// ── Scoring ─────────────────────────────────────────────────────────────────

export interface ScoreAxis {
  /** 0–6. Meaningless, and must not be shown, when `sufficient` is false. */
  score: number;
  checks: ScoreCheck[];
  /**
   * Whether enough metrics were evaluated to say anything at all.
   *
   * False is the honest answer for most banks today: the ratios that describe a
   * bank's balance sheet are published in its own filings and in Basel/Pillar-3
   * disclosures, and are simply not in the generic quote feed the rest of this
   * app reads. Rendering a score anyway would be inventing one.
   */
  sufficient: boolean;
  /** What to show instead of a score when `sufficient` is false. */
  unavailableNote?: string;
}

/**
 * Score over the checks that were EVALUATED, never over the checks that exist.
 *
 * Dividing by the full count is the bug that produced 0/10: eight bank checks
 * of which none could be sourced scored zero out of eight, which reads as eight
 * failures. Here, zero evaluated checks is not a score at all.
 */
export function scoreFromChecks(
  checks: ScoreCheck[],
  opts: { minimumEvaluated: number; subject: string }
): ScoreAxis {
  const evaluated = checks.filter((c) => c.status !== "unavailable");
  const passed = evaluated.filter((c) => c.status === "pass").length;
  if (evaluated.length < opts.minimumEvaluated) {
    return {
      score: 0,
      checks,
      sufficient: false,
      unavailableNote: `Insufficient ${opts.subject} data (${evaluated.length} of ${checks.length} measures sourced; ${opts.minimumEvaluated} needed).`,
    };
  }
  return {
    score: Math.round((passed / evaluated.length) * 6),
    checks,
    sufficient: true,
  };
}

// ── The checklists ──────────────────────────────────────────────────────────

export interface IndustrialMetrics {
  currentRatio?: Metric;
  debtToEquity?: Metric;
  cashToDebt?: Metric;
}

/** Unchanged for the companies it actually suits. */
export function industrialChecks(m: IndustrialMetrics): ScoreCheck[] {
  return [
    evaluate(
      {
        label: "Short-term assets cover liabilities (current ratio >1)",
        threshold: "> 1.0x",
        unit: "times",
        test: (v) => v > 1,
      },
      m.currentRatio
    ),
    evaluate(
      {
        label: "Conservative debt (debt/equity below 1x)",
        threshold: "< 1.0x",
        unit: "times",
        test: (v) => v < 1,
      },
      m.debtToEquity
    ),
    evaluate(
      { label: "More cash than total debt", threshold: "> 1.0x", unit: "times", test: (v) => v > 1 },
      m.cashToDebt
    ),
  ];
}

export interface BankMetrics {
  /** Gross non-performing assets as a share of gross advances. */
  grossNpaRatio?: Metric;
  /** Net NPAs, after provisions, as a share of net advances. */
  netNpaRatio?: Metric;
  /**
   * Provisions held against bad loans.
   *
   * Two definitions are in common use and they are not interchangeable: the
   * specific provision coverage a regulator asks for, which is strong around
   * 70%, and total provisions over gross NPAs, which many Indian banks report
   * and where the same strength reads as 100% or more. The definition travels
   * on the metric and picks the threshold; a missing definition is treated as
   * the stricter total-provisions reading rather than flattering the bank.
   */
  provisionCoverage?: Metric;
  /** Customer deposits as a share of total liabilities. */
  depositFunding?: Metric;
  loansToDeposits?: Metric;
  loansToAssets?: Metric;
  assetsToEquity?: Metric;
  /**
   * Capital held above the regulatory requirement, in percentage POINTS.
   *
   * Deliberately a buffer rather than a level: 11.5% is comfortable in one
   * jurisdiction and a breach in another, so an absolute CET1 threshold would
   * be a guess about which regulator applies. The buffer is the same question
   * everywhere — is there room above the minimum.
   */
  capitalBufferPoints?: Metric;
}

export const PCR_SPECIFIC = "specific provisions / gross NPAs";
export const PCR_TOTAL = "total provisions / gross NPAs";

export function bankChecks(m: BankMetrics): ScoreCheck[] {
  const pcrIsSpecific = m.provisionCoverage?.definition === PCR_SPECIFIC;
  return [
    evaluate(
      { label: "Low bad loans (gross NPA at or below 2%)", threshold: "≤ 2%", unit: "percent", test: (v) => v <= 0.02 },
      m.grossNpaRatio
    ),
    evaluate(
      { label: "Bad loans largely provided for (net NPA at or below 1%)", threshold: "≤ 1%", unit: "percent", test: (v) => v <= 0.01 },
      m.netNpaRatio
    ),
    evaluate(
      {
        label: pcrIsSpecific
          ? "Strong provision coverage (specific provisions ≥70% of gross NPAs)"
          : "Strong provision coverage (total provisions ≥100% of gross NPAs)",
        threshold: pcrIsSpecific ? "≥ 70%" : "≥ 100%",
        unit: "percent",
        test: (v) => v >= (pcrIsSpecific ? 0.7 : 1),
      },
      m.provisionCoverage
    ),
    evaluate(
      {
        label: "Funded by customer deposits (≥65% of liabilities)",
        threshold: "≥ 65%",
        unit: "percent",
        test: (v) => v >= 0.65,
      },
      m.depositFunding
    ),
    evaluate(
      {
        label: "Loan book within its deposit base (70–105%)",
        threshold: "70–105%",
        unit: "percent",
        test: (v) => v >= 0.7 && v <= 1.05,
      },
      m.loansToDeposits
    ),
    evaluate(
      {
        label: "Balanced asset mix (loans 50–75% of assets)",
        threshold: "50–75%",
        unit: "percent",
        test: (v) => v >= 0.5 && v <= 0.75,
      },
      m.loansToAssets
    ),
    evaluate(
      {
        label: "Conservative leverage for a bank (assets under 10x equity)",
        threshold: "< 10x",
        unit: "times",
        test: (v) => v < 10,
      },
      m.assetsToEquity
    ),
    evaluate(
      {
        label: "Capital comfortably above the regulatory minimum",
        threshold: "≥ 2 points of headroom",
        unit: "percent",
        test: (v) => v >= 0.02,
      },
      m.capitalBufferPoints
    ),
  ];
}

export interface NbfcMetrics {
  /** Capital to risk-weighted assets, above the regulatory floor, in points. */
  crarBufferPoints?: Metric;
  tier1BufferPoints?: Metric;
  /** Stage-3 or NPA assets as a share of the book. */
  stage3Ratio?: Metric;
  provisionCoverage?: Metric;
  /** Borrowings to net worth. Judged against the NBFC's own category. */
  gearing?: Metric;
  /** Cumulative one-year asset-liability gap as a share of outflows. */
  assetLiabilityGap?: Metric;
  liquidityCoverage?: Metric;
  /** Share of funding from the single largest source. Lower is safer. */
  largestFundingShare?: Metric;
  /** Share of the book that is secured. */
  securedShare?: Metric;
  /** Share of the book in the single largest sector or borrower group. */
  largestExposureShare?: Metric;
  /**
   * The regulatory gearing ceiling for this NBFC's category, when known.
   *
   * A housing finance company and an infrastructure lender are held to
   * different limits, so a single gearing threshold would flag one of them
   * wrongly whichever number were picked.
   */
  gearingCeiling?: number;
}

/**
 * A non-bank lender is not a small bank.
 *
 * Deposit funding is the difference. Most NBFCs are not deposit-taking, so
 * "funded by customer deposits" is not a bar they fail — it is a bar that does
 * not apply, and putting it on their checklist would recreate the original bug
 * one rung down. What replaces it is the thing that actually breaks non-bank
 * lenders: wholesale funding that has to be rolled, against a loan book that
 * cannot be.
 */
export function nbfcChecks(m: NbfcMetrics): ScoreCheck[] {
  const ceiling = m.gearingCeiling;
  return [
    evaluate(
      {
        label: "Capital above the regulatory minimum (CRAR headroom)",
        threshold: "≥ 2 points of headroom",
        unit: "percent",
        test: (v) => v >= 0.02,
      },
      m.crarBufferPoints
    ),
    evaluate(
      {
        label: "Tier-1 capital above its own minimum",
        threshold: "≥ 1 point of headroom",
        unit: "percent",
        test: (v) => v >= 0.01,
      },
      m.tier1BufferPoints
    ),
    evaluate(
      {
        label: "Impaired book contained (Stage 3 / NPA at or below 3%)",
        threshold: "≤ 3%",
        unit: "percent",
        test: (v) => v <= 0.03,
      },
      m.stage3Ratio
    ),
    evaluate(
      {
        label: "Impaired book provided for (coverage ≥50%)",
        threshold: "≥ 50%",
        unit: "percent",
        test: (v) => v >= 0.5,
      },
      m.provisionCoverage
    ),
    evaluate(
      {
        label: ceiling
          ? `Gearing within the category limit (under ${ceiling}x)`
          : "Gearing within the range typical for its category",
        threshold: ceiling ? `< ${ceiling}x` : "category-dependent",
        unit: "times",
        test: (v) => (ceiling ? v < ceiling : v < 8),
      },
      m.gearing
    ),
    evaluate(
      {
        label: "No negative one-year asset-liability gap",
        threshold: "≥ 0% of outflows",
        unit: "percent",
        test: (v) => v >= 0,
      },
      m.assetLiabilityGap
    ),
    evaluate(
      {
        label: "Liquidity coverage above requirement",
        threshold: "≥ 100%",
        unit: "percent",
        test: (v) => v >= 1,
      },
      m.liquidityCoverage
    ),
    evaluate(
      {
        label: "Funding not concentrated in one source (largest under 40%)",
        threshold: "< 40%",
        unit: "percent",
        test: (v) => v < 0.4,
      },
      m.largestFundingShare
    ),
    evaluate(
      {
        label: "Lending largely secured (≥60% of the book)",
        threshold: "≥ 60%",
        unit: "percent",
        test: (v) => v >= 0.6,
      },
      m.securedShare
    ),
    evaluate(
      {
        label: "Exposure not concentrated in one sector (largest under 35%)",
        threshold: "< 35%",
        unit: "percent",
        test: (v) => v < 0.35,
      },
      m.largestExposureShare
    ),
  ];
}

export interface LifeInsurerMetrics {
  /** Solvency above the regulatory minimum, as a multiple of it. */
  solvencyRatio?: Metric;
  /** Reserves held against the actuarial liability. */
  reserveAdequacy?: Metric;
  claimSettlementRatio?: Metric;
  /** 13th-month persistency: how much of last year's book renewed. */
  persistency13m?: Metric;
  persistency61m?: Metric;
  /** Duration gap between assets and liabilities, in years. Nearer zero is better. */
  durationGapYears?: Metric;
  /** Share of the investment book in sovereign or AAA paper. */
  investmentQuality?: Metric;
  /** Share of premium ceded to reinsurers. High means dependence. */
  reinsuranceCeded?: Metric;
}

export function lifeInsurerChecks(m: LifeInsurerMetrics): ScoreCheck[] {
  return [
    evaluate(
      { label: "Solvency comfortably above the regulatory minimum", threshold: "≥ 1.5x minimum", unit: "times", test: (v) => v >= 1.5 },
      m.solvencyRatio
    ),
    evaluate(
      { label: "Reserves cover the actuarial liability", threshold: "≥ 100%", unit: "percent", test: (v) => v >= 1 },
      m.reserveAdequacy
    ),
    evaluate(
      { label: "Claims settled reliably (≥98%)", threshold: "≥ 98%", unit: "percent", test: (v) => v >= 0.98 },
      m.claimSettlementRatio
    ),
    evaluate(
      { label: "Policies persist past the first year (13-month ≥80%)", threshold: "≥ 80%", unit: "percent", test: (v) => v >= 0.8 },
      m.persistency13m
    ),
    evaluate(
      { label: "Policies persist to maturity (61-month ≥55%)", threshold: "≥ 55%", unit: "percent", test: (v) => v >= 0.55 },
      m.persistency61m
    ),
    evaluate(
      { label: "Assets matched to liabilities (duration gap under 1 year)", threshold: "< 1 year", unit: "ratio", test: (v) => Math.abs(v) < 1 },
      m.durationGapYears
    ),
    evaluate(
      { label: "Investments largely sovereign or AAA (≥70%)", threshold: "≥ 70%", unit: "percent", test: (v) => v >= 0.7 },
      m.investmentQuality
    ),
    evaluate(
      { label: "Not dependent on reinsurance (under 25% ceded)", threshold: "< 25%", unit: "percent", test: (v) => v < 0.25 },
      m.reinsuranceCeded
    ),
  ];
}

export interface GeneralInsurerMetrics {
  solvencyRatio?: Metric;
  /** Claims plus expenses over premium. Below 1 means underwriting profit. */
  combinedRatio?: Metric;
  claimsRatio?: Metric;
  reserveAdequacy?: Metric;
  reinsuranceCeded?: Metric;
  /** Liquid assets over one year of expected claims. */
  liquidityCover?: Metric;
  investmentQuality?: Metric;
}

export function generalInsurerChecks(m: GeneralInsurerMetrics): ScoreCheck[] {
  return [
    evaluate(
      { label: "Solvency comfortably above the regulatory minimum", threshold: "≥ 1.5x minimum", unit: "times", test: (v) => v >= 1.5 },
      m.solvencyRatio
    ),
    evaluate(
      { label: "Underwrites at a profit (combined ratio under 100%)", threshold: "< 100%", unit: "percent", test: (v) => v < 1 },
      m.combinedRatio
    ),
    evaluate(
      { label: "Claims contained (loss ratio under 75%)", threshold: "< 75%", unit: "percent", test: (v) => v < 0.75 },
      m.claimsRatio
    ),
    evaluate(
      { label: "Reserves cover expected claims", threshold: "≥ 100%", unit: "percent", test: (v) => v >= 1 },
      m.reserveAdequacy
    ),
    evaluate(
      { label: "Not dependent on reinsurance (under 40% ceded)", threshold: "< 40%", unit: "percent", test: (v) => v < 0.4 },
      m.reinsuranceCeded
    ),
    evaluate(
      { label: "Liquid assets cover a year of claims", threshold: "≥ 100%", unit: "percent", test: (v) => v >= 1 },
      m.liquidityCover
    ),
    evaluate(
      { label: "Investments largely sovereign or AAA (≥70%)", threshold: "≥ 70%", unit: "percent", test: (v) => v >= 0.7 },
      m.investmentQuality
    ),
  ];
}

// ── Choosing between them ───────────────────────────────────────────────────

/**
 * The union is declared here AND in financialHealth.ts, on purpose.
 *
 * Both files are importless so their test scripts can compile and drive them
 * standalone, which rules out sharing the type through an import. TypeScript's
 * structural typing makes the two interchangeable, and yahooFundamentals.ts —
 * which imports both — carries a compile-time assertion that they still match,
 * so they cannot drift apart silently.
 */
export type BalanceSheetModel =
  | "industrial"
  | "bank"
  | "nbfc"
  | "life-insurer"
  | "general-insurer";

export interface BalanceSheetMetrics {
  industrial?: IndustrialMetrics;
  bank?: BankMetrics;
  nbfc?: NbfcMetrics;
  life?: LifeInsurerMetrics;
  general?: GeneralInsurerMetrics;
}

/** How many measures must be sourced before a score means anything. */
const MINIMUM_EVALUATED: Record<BalanceSheetModel, number> = {
  // Three checks, and all three come from one quote payload: two is a real bar.
  industrial: 2,
  // Half the checklist. Fewer than four and the picture is too partial to score
  // a bank on — asset quality, funding and capital each have to be represented,
  // and four is the fewest that can cover them.
  bank: 4,
  nbfc: 4,
  "life-insurer": 3,
  "general-insurer": 3,
};

const SUBJECT: Record<BalanceSheetModel, string> = {
  industrial: "balance sheet",
  bank: "bank",
  nbfc: "lender",
  "life-insurer": "insurer",
  "general-insurer": "insurer",
};

/**
 * The Balance Sheet Strength axis for a company, under the right model.
 *
 * The industrial checks are never reached for a bank, a non-bank lender or an
 * insurer. Not weighted down, not softened: not reached. A current ratio is not
 * a weak signal for a bank, it is a meaningless one, and a meaningless signal
 * with a small weight still moves the score.
 */
export function balanceSheetAxis(
  model: BalanceSheetModel,
  metrics: BalanceSheetMetrics
): ScoreAxis {
  const checks =
    model === "bank"
      ? bankChecks(metrics.bank ?? {})
      : model === "nbfc"
        ? nbfcChecks(metrics.nbfc ?? {})
        : model === "life-insurer"
          ? lifeInsurerChecks(metrics.life ?? {})
          : model === "general-insurer"
            ? generalInsurerChecks(metrics.general ?? {})
            : industrialChecks(metrics.industrial ?? {});
  return scoreFromChecks(checks, {
    minimumEvaluated: MINIMUM_EVALUATED[model],
    subject: SUBJECT[model],
  });
}

/** Checks that must never appear on a financial institution's card. */
export const INDUSTRIAL_ONLY_LABELS = [
  "current ratio",
  "debt/equity",
  "more cash than total debt",
];
