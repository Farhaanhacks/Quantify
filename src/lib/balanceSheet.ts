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
  /**
   * Which part of the picture this check describes.
   *
   * Counting checks was not enough. Four of a bank's eight measures could be
   * sourced and score 6/6 while every one of the four was a structural ratio
   * from a quote feed and not one said anything about asset quality or capital.
   * "Strong, 10/10" over a bank whose bad loans are unknown is a worse claim
   * than the 0/10 this all started with, because it is confident.
   */
  domain?: string;
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
  domain?: string;
  test: (value: number) => boolean;
}

/** The parts of a lender's picture, each of which has to be represented. */
export const DOMAIN = {
  /** Bad loans, provisions: whether the book is sound. */
  ASSET_QUALITY: "asset-quality",
  /** Capital against the regulatory floor: whether losses can be absorbed. */
  CAPITAL: "capital",
  /** Funding and leverage: the shape of the balance sheet. */
  STRUCTURAL: "structural",
  /** Everything an ordinary company is judged on. */
  GENERAL: "general",
} as const;

/** Build one check from a sourced metric, or mark it unavailable. */
export function evaluate(spec: CheckSpec, metric?: Metric): ScoreCheck {
  const base = {
    label: spec.label,
    threshold: spec.threshold,
    unit: spec.unit,
    domain: spec.domain,
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

/** At least `atLeast` checks from this domain must have been measured. */
export interface DomainRequirement {
  domain: string;
  atLeast: number;
  /** What to call it when it is missing, in a sentence. */
  label: string;
}

export interface SufficiencyRule {
  /** How many checks in total must be measured. */
  minimumEvaluated: number;
  /** Which PARTS of the picture must be represented among them. */
  domains: DomainRequirement[];
  subject: string;
}

/**
 * Score over the checks that were EVALUATED, and only when they cover the
 * ground a verdict needs.
 *
 * Two failures produced this function's shape, and they pull in opposite
 * directions.
 *
 * Dividing by the full count gave 0/10: eight bank checks of which none could
 * be sourced scored zero out of eight, which reads as eight failures. So the
 * score is over evaluated checks only.
 *
 * But counting evaluated checks alone gave something worse. Four of a bank's
 * eight measures could be sourced and score a confident 6/6, and all four were
 * structural ratios from a quote feed: how the book is funded, how levered it
 * is. Not one said anything about bad loans or capital. "Strong, 10/10" over a
 * bank whose asset quality is unknown is a more damaging claim than "Fragile,
 * 0/10", because it is assured, and a reader has no way to see that the four
 * measures behind it were the four that do not matter most.
 *
 * So a count is not enough: the checks that were measured have to COVER the
 * question. A bank needs asset quality, capital and the shape of its balance
 * sheet, and missing any one of those means the picture is partial however many
 * of the rest arrived.
 */
const sentenceCase = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function scoreFromChecks(checks: ScoreCheck[], rule: SufficiencyRule): ScoreAxis {
  const evaluated = checks.filter((c) => c.status !== "unavailable");
  const passed = evaluated.filter((c) => c.status === "pass").length;

  if (!evaluated.length) {
    return {
      score: 0,
      checks,
      sufficient: false,
      unavailableNote: `Insufficient ${rule.subject} data (0 of ${checks.length} measures sourced).`,
    };
  }

  const missing: string[] = [];
  for (const req of rule.domains) {
    const have = evaluated.filter((c) => c.domain === req.domain).length;
    if (have < req.atLeast) missing.push(req.label);
  }
  const tooFew = evaluated.length < rule.minimumEvaluated;

  if (tooFew || missing.length) {
    // "Partial" rather than "insufficient" when something WAS measured. The
    // difference is real and the reader can act on it: partial means the figures
    // shown are sound and the picture is incomplete, and it names which part is
    // missing rather than leaving the gap to be inferred.
    // Named in the reader's terms, not ours. "Pending official filing data"
    // says where the missing half comes from and that it is expected, which is
    // the difference between a gap in the pipeline and a gap in the company.
    const gap = missing.length
      ? ` ${sentenceCase(missing.join(" and "))} pending official filing data.`
      : "";
    return {
      score: 0,
      checks,
      sufficient: false,
      unavailableNote: `Partial ${rule.subject} data: ${evaluated.length} of ${checks.length} measures available.${gap}`,
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
        domain: DOMAIN.GENERAL,
        test: (v) => v > 1,
      },
      m.currentRatio
    ),
    evaluate(
      {
        label: "Conservative debt (debt/equity below 1x)",
        threshold: "< 1.0x",
        unit: "times",
        domain: DOMAIN.GENERAL,
        test: (v) => v < 1,
      },
      m.debtToEquity
    ),
    evaluate(
      { label: "More cash than total debt", threshold: "> 1.0x", unit: "times", domain: DOMAIN.GENERAL, test: (v) => v > 1 },
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
      { label: "Low bad loans (gross NPA at or below 2%)",
        domain: DOMAIN.ASSET_QUALITY, threshold: "≤ 2%", unit: "percent", test: (v) => v <= 0.02 },
      m.grossNpaRatio
    ),
    evaluate(
      { label: "Bad loans largely provided for (net NPA at or below 1%)",
        domain: DOMAIN.ASSET_QUALITY, threshold: "≤ 1%", unit: "percent", test: (v) => v <= 0.01 },
      m.netNpaRatio
    ),
    evaluate(
      {
        label: pcrIsSpecific
          ? "Strong provision coverage (specific provisions ≥70% of gross NPAs)"
          : "Strong provision coverage (total provisions ≥100% of gross NPAs)",
        threshold: pcrIsSpecific ? "≥ 70%" : "≥ 100%",
        unit: "percent",
        domain: DOMAIN.ASSET_QUALITY,
        test: (v) => v >= (pcrIsSpecific ? 0.7 : 1),
      },
      m.provisionCoverage
    ),
    evaluate(
      {
        label: "Funded by customer deposits (≥65% of liabilities)",
        domain: DOMAIN.STRUCTURAL,
        threshold: "≥ 65%",
        unit: "percent",
        test: (v) => v >= 0.65,
      },
      m.depositFunding
    ),
    evaluate(
      {
        label: "Loan book within its deposit base (70–105%)",
        domain: DOMAIN.STRUCTURAL,
        threshold: "70–105%",
        unit: "percent",
        test: (v) => v >= 0.7 && v <= 1.05,
      },
      m.loansToDeposits
    ),
    evaluate(
      {
        label: "Balanced asset mix (loans 50–75% of assets)",
        domain: DOMAIN.STRUCTURAL,
        threshold: "50–75%",
        unit: "percent",
        test: (v) => v >= 0.5 && v <= 0.75,
      },
      m.loansToAssets
    ),
    evaluate(
      {
        label: "Conservative leverage for a bank (assets under 10x equity)",
        domain: DOMAIN.STRUCTURAL,
        threshold: "< 10x",
        unit: "times",
        test: (v) => v < 10,
      },
      m.assetsToEquity
    ),
    evaluate(
      {
        label: "Capital comfortably above the regulatory minimum",
        domain: DOMAIN.CAPITAL,
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
        domain: DOMAIN.CAPITAL,
        threshold: "≥ 2 points of headroom",
        unit: "percent",
        test: (v) => v >= 0.02,
      },
      m.crarBufferPoints
    ),
    evaluate(
      {
        label: "Tier-1 capital above its own minimum",
        domain: DOMAIN.CAPITAL,
        threshold: "≥ 1 point of headroom",
        unit: "percent",
        test: (v) => v >= 0.01,
      },
      m.tier1BufferPoints
    ),
    evaluate(
      {
        label: "Impaired book contained (Stage 3 / NPA at or below 3%)",
        domain: DOMAIN.ASSET_QUALITY,
        threshold: "≤ 3%",
        unit: "percent",
        test: (v) => v <= 0.03,
      },
      m.stage3Ratio
    ),
    evaluate(
      {
        label: "Impaired book provided for (coverage ≥50%)",
        domain: DOMAIN.ASSET_QUALITY,
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
        domain: DOMAIN.STRUCTURAL,
        test: (v) => (ceiling ? v < ceiling : v < 8),
      },
      m.gearing
    ),
    evaluate(
      {
        label: "No negative one-year asset-liability gap",
        domain: DOMAIN.STRUCTURAL,
        threshold: "≥ 0% of outflows",
        unit: "percent",
        test: (v) => v >= 0,
      },
      m.assetLiabilityGap
    ),
    evaluate(
      {
        label: "Liquidity coverage above requirement",
        domain: DOMAIN.STRUCTURAL,
        threshold: "≥ 100%",
        unit: "percent",
        test: (v) => v >= 1,
      },
      m.liquidityCoverage
    ),
    evaluate(
      {
        label: "Funding not concentrated in one source (largest under 40%)",
        domain: DOMAIN.STRUCTURAL,
        threshold: "< 40%",
        unit: "percent",
        test: (v) => v < 0.4,
      },
      m.largestFundingShare
    ),
    evaluate(
      {
        label: "Lending largely secured (≥60% of the book)",
        domain: DOMAIN.STRUCTURAL,
        threshold: "≥ 60%",
        unit: "percent",
        test: (v) => v >= 0.6,
      },
      m.securedShare
    ),
    evaluate(
      {
        label: "Exposure not concentrated in one sector (largest under 35%)",
        domain: DOMAIN.STRUCTURAL,
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
      { label: "Solvency comfortably above the regulatory minimum", threshold: "≥ 1.5x minimum", unit: "times", domain: DOMAIN.CAPITAL, test: (v) => v >= 1.5 },
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
      { label: "Solvency comfortably above the regulatory minimum", threshold: "≥ 1.5x minimum", unit: "times", domain: DOMAIN.CAPITAL, test: (v) => v >= 1.5 },
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

/**
 * Take each measure from whichever source actually has it.
 *
 * Per metric, not per source, and the difference decides what a bank's card
 * says. The two sources are good at opposite halves: the quote feed carries the
 * structural ratios and nothing about asset quality, while a filing carries
 * bad loans and capital and may or may not carry a full balance sheet. Choosing
 * one source for the whole checklist throws away half the picture whichever way
 * it is chosen — and returning the filing's metrics wholesale, as this used to,
 * discarded four working structural ratios the moment a single filed fact
 * existed.
 *
 * A filed figure wins where both have one: it is the company's own statement,
 * with the definition its regulator agreed to, and the derived one is our
 * arithmetic over a feed's balance sheet.
 */
export function mergeMetrics<T extends object>(filed: Partial<T> | null, derived: T): T {
  if (!filed) return derived;
  const out = { ...derived } as Record<string, unknown>;
  for (const [key, value] of Object.entries(filed)) {
    const m = value as Metric | undefined;
    // Only a metric with an actual value displaces one. A filing that tagged a
    // concept and failed validation must not evict a sound figure from the feed.
    if (m && typeof m === "object" && typeof m.value === "number" && isFinite(m.value)) {
      out[key] = m;
    } else if (out[key] == null && m != null) {
      out[key] = m;
    }
  }
  return out as T;
}

// ── The other four axes ─────────────────────────────────────────────────────
//
// Three checks each was thin, and thin in a way that showed: a company could
// pass all three of "below target, P/E under 25, PEG under 2" and be a
// declining business on a low multiple for good reason, or fail all three and
// be a compounder. Three binary questions cannot separate those, and the score
// out of ten implied a precision the checklist did not have.
//
// So six each, and each one a different question rather than three phrasings of
// the same one. The valuation axis now asks about earnings, sales, cash and two
// independent estimates of worth; the growth axis asks whether growth is
// happening, whether it is profitable, and whether anyone expects it to
// continue.
//
// They use the same three-state check as the bank checklist, and for the same
// reason: a P/E that is absent because a company lost money is a different
// statement from a P/E that is absent because the feed did not carry one, and
// only one of them is a mark against the company.

export interface ValuationMetrics {
  belowTarget?: Metric;
  priceEarnings?: Metric;
  pegRatio?: Metric;
  /** Price against an independently modelled value, as a ratio. Below 1 is cheap. */
  priceToFairValue?: Metric;
  priceToSales?: Metric;
  /** Through-cycle free cash flow over market value. */
  freeCashFlowYield?: Metric;
}

export function valuationChecks(m: ValuationMetrics): ScoreCheck[] {
  return [
    evaluate(
      {
        label: "Trades below analysts' average target",
        threshold: "price < target",
        unit: "ratio",
        domain: DOMAIN.GENERAL,
        test: (v) => v > 0,
      },
      m.belowTarget
    ),
    evaluate(
      {
        label: "Earnings multiple is not demanding (P/E below 25)",
        threshold: "< 25x",
        unit: "times",
        domain: DOMAIN.GENERAL,
        test: (v) => v > 0 && v < 25,
      },
      m.priceEarnings
    ),
    evaluate(
      {
        label: "Growth is fairly priced (PEG below 2)",
        threshold: "< 2.0",
        unit: "ratio",
        domain: DOMAIN.GENERAL,
        test: (v) => v > 0 && v < 2,
      },
      m.pegRatio
    ),
    evaluate(
      {
        label: "Below an independent estimate of fair value",
        threshold: "< 1.0x fair value",
        unit: "times",
        domain: DOMAIN.GENERAL,
        test: (v) => v > 0 && v < 1,
      },
      m.priceToFairValue
    ),
    evaluate(
      {
        label: "Sales multiple is not stretched (P/S below 5)",
        threshold: "< 5.0x",
        unit: "times",
        domain: DOMAIN.GENERAL,
        test: (v) => v > 0 && v < 5,
      },
      m.priceToSales
    ),
    evaluate(
      {
        // The check that does not depend on an accounting profit at all, which
        // is why it earns its place beside three that do.
        label: "Free cash flow yield above 3%",
        threshold: "≥ 3%",
        unit: "percent",
        domain: DOMAIN.GENERAL,
        test: (v) => v >= 0.03,
      },
      m.freeCashFlowYield
    ),
  ];
}

export interface GrowthMetrics {
  revenueGrowth?: Metric;
  earningsGrowth?: Metric;
  /** Earnings growth less revenue growth. Positive means margins are widening. */
  marginExpansion?: Metric;
  /** What analysts expect next year. */
  forecastGrowth?: Metric;
  /** The longer consensus, where there is one. */
  longTermGrowth?: Metric;
  /** Compound growth in operating cash flow across the years we hold. */
  cashFlowGrowth?: Metric;
}

export function growthChecks(m: GrowthMetrics): ScoreCheck[] {
  return [
    evaluate(
      { label: "Revenue growing (above 5%)", threshold: "> 5%", unit: "percent", domain: DOMAIN.GENERAL, test: (v) => v > 0.05 },
      m.revenueGrowth
    ),
    evaluate(
      { label: "Earnings growing (above 5%)", threshold: "> 5%", unit: "percent", domain: DOMAIN.GENERAL, test: (v) => v > 0.05 },
      m.earningsGrowth
    ),
    evaluate(
      {
        // Revenue growth bought by discounting is not the same thing as growth,
        // and the two are indistinguishable until you compare them.
        label: "Earnings growing at least as fast as revenue",
        threshold: "≥ 0 points",
        unit: "percent",
        domain: DOMAIN.GENERAL,
        test: (v) => v >= 0,
      },
      m.marginExpansion
    ),
    evaluate(
      { label: "Analysts expect growth next year", threshold: "> 0%", unit: "percent", domain: DOMAIN.GENERAL, test: (v) => v > 0 },
      m.forecastGrowth
    ),
    evaluate(
      { label: "Longer-term consensus growth above 8%", threshold: "> 8%", unit: "percent", domain: DOMAIN.GENERAL, test: (v) => v > 0.08 },
      m.longTermGrowth
    ),
    evaluate(
      {
        // Reported growth that never reaches the cash flow statement is the
        // oldest warning sign there is.
        label: "Cash generation growing, not just reported profit",
        threshold: "> 0%",
        unit: "percent",
        domain: DOMAIN.GENERAL,
        test: (v) => v > 0,
      },
      m.cashFlowGrowth
    ),
  ];
}

export interface QualityMetrics {
  profitMargin?: Metric;
  returnOnEquity?: Metric;
  returnOnAssets?: Metric;
  /** Operating cash flow over reported net income. Around 1 or above is healthy. */
  earningsBackedByCash?: Metric;
  /** Through-cycle free cash flow. Positive means the business funds itself. */
  throughCycleFreeCashFlow?: Metric;
  /** How many of the years we hold were profitable, as a share. */
  profitableYears?: Metric;
}

export function qualityChecks(m: QualityMetrics): ScoreCheck[] {
  return [
    evaluate(
      { label: "Currently profitable", threshold: "> 0%", unit: "percent", domain: DOMAIN.GENERAL, test: (v) => v > 0 },
      m.profitMargin
    ),
    evaluate(
      { label: "Healthy profit margin (above 10%)", threshold: "> 10%", unit: "percent", domain: DOMAIN.GENERAL, test: (v) => v > 0.1 },
      m.profitMargin
    ),
    evaluate(
      { label: "Good return on equity (above 12%)", threshold: "> 12%", unit: "percent", domain: DOMAIN.GENERAL, test: (v) => v > 0.12 },
      m.returnOnEquity
    ),
    evaluate(
      {
        // Return on equity flatters a levered company; return on assets does
        // not, which is why both are here rather than either alone.
        label: "Earns a return on its assets, not just its equity (above 5%)",
        threshold: "> 5%",
        unit: "percent",
        domain: DOMAIN.GENERAL,
        test: (v) => v > 0.05,
      },
      m.returnOnAssets
    ),
    evaluate(
      {
        label: "Profits arrive as cash (operating cash flow at least matches earnings)",
        threshold: "≥ 0.9x",
        unit: "times",
        domain: DOMAIN.GENERAL,
        test: (v) => v >= 0.9,
      },
      m.earningsBackedByCash
    ),
    evaluate(
      {
        label: "Generates free cash flow through the cycle",
        threshold: "> 0",
        unit: "ratio",
        domain: DOMAIN.GENERAL,
        test: (v) => v > 0,
      },
      m.throughCycleFreeCashFlow
    ),
  ];
}

export interface CapitalAllocationMetrics {
  dividendYield?: Metric;
  payoutRatio?: Metric;
  /** The dividend bill against through-cycle free cash flow. */
  dividendCoveredByCash?: Metric;
  /** Net debt against operating cash flow, in years. */
  netDebtToCashFlow?: Metric;
  /** Return on equity, as the measure of what retained earnings are doing. */
  reinvestmentReturn?: Metric;
  /** Share count against a year ago. Below 1 means buybacks. */
  shareCountChange?: Metric;
}

/**
 * What the company does with the cash it makes.
 *
 * Not a dividend checklist, which is what three checks about yield and payout
 * amounted to. A company that pays nothing and compounds at 20% is allocating
 * capital well, and one that borrows to maintain a yield is not; neither shows
 * up in a payout ratio.
 */
export function capitalAllocationChecks(m: CapitalAllocationMetrics): ScoreCheck[] {
  return [
    evaluate(
      { label: "Pays a dividend", threshold: "> 0%", unit: "percent", domain: DOMAIN.GENERAL, test: (v) => v > 0 },
      m.dividendYield
    ),
    evaluate(
      { label: "Yield above 2%", threshold: "> 2%", unit: "percent", domain: DOMAIN.GENERAL, test: (v) => v > 0.02 },
      m.dividendYield
    ),
    evaluate(
      { label: "Dividend covered by earnings (payout below 80%)", threshold: "< 80%", unit: "percent", domain: DOMAIN.GENERAL, test: (v) => v > 0 && v < 0.8 },
      m.payoutRatio
    ),
    evaluate(
      {
        // Earnings cover is an accounting test; this is the one that decides
        // whether the cheque clears.
        label: "Dividend covered by free cash flow",
        threshold: "≥ 1.0x",
        unit: "times",
        domain: DOMAIN.GENERAL,
        test: (v) => v >= 1,
      },
      m.dividendCoveredByCash
    ),
    evaluate(
      {
        label: "Not borrowing to fund returns (net debt under 3 years of cash flow)",
        threshold: "< 3.0x",
        unit: "times",
        domain: DOMAIN.GENERAL,
        test: (v) => v < 3,
      },
      m.netDebtToCashFlow
    ),
    evaluate(
      {
        label: "Retained earnings are reinvested well (return on equity above 15%)",
        threshold: "> 15%",
        unit: "percent",
        domain: DOMAIN.GENERAL,
        test: (v) => v > 0.15,
      },
      m.reinvestmentReturn
    ),
  ];
}

/**
 * The rule for the four axes that are not a balance sheet.
 *
 * One domain, so coverage adds nothing, and the bar is four of six. Below that
 * the axis is measuring too little to put a number on, and the card says
 * "partial" instead of scoring a company on two lucky fields.
 */
export const GENERAL_SUFFICIENCY: SufficiencyRule = {
  minimumEvaluated: 4,
  domains: [],
  subject: "fundamentals",
};

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

/**
 * What each kind of company needs before it can be scored.
 *
 * The domain requirements are the part that matters. A previous version of this
 * asked only for four of eight bank measures, with a comment claiming that
 * "asset quality, funding and capital each have to be represented" — which the
 * code did not check. Four structural ratios from a quote feed satisfied it and
 * produced a confident 10/10 for a bank whose bad loans were unknown. A comment
 * asserting a guarantee the code does not provide is worse than no comment.
 */
const SUFFICIENCY: Record<BalanceSheetModel, SufficiencyRule> = {
  // Three checks, all from one quote payload: two is a real bar, and there is
  // only one domain, so there is nothing further to require.
  industrial: {
    minimumEvaluated: 2,
    domains: [],
    subject: "balance sheet",
  },
  bank: {
    // Six of eight, AND covering all three parts of the question. A bank with
    // its funding and leverage measured and its bad loans unknown is not
    // three-quarters scored; it is unscored on the thing that decides.
    minimumEvaluated: 6,
    domains: [
      { domain: DOMAIN.ASSET_QUALITY, atLeast: 1, label: "asset quality" },
      { domain: DOMAIN.CAPITAL, atLeast: 1, label: "regulatory capital" },
      { domain: DOMAIN.STRUCTURAL, atLeast: 2, label: "funding and leverage" },
    ],
    subject: "bank",
  },
  nbfc: {
    minimumEvaluated: 6,
    domains: [
      { domain: DOMAIN.ASSET_QUALITY, atLeast: 1, label: "asset quality" },
      { domain: DOMAIN.CAPITAL, atLeast: 1, label: "regulatory capital" },
      { domain: DOMAIN.STRUCTURAL, atLeast: 2, label: "funding and liquidity" },
    ],
    subject: "lender",
  },
  // An insurer's solvency is the equivalent of a lender's capital: without it
  // the rest describes a business that may or may not be able to pay claims.
  "life-insurer": {
    minimumEvaluated: 4,
    domains: [{ domain: DOMAIN.CAPITAL, atLeast: 1, label: "solvency" }],
    subject: "insurer",
  },
  "general-insurer": {
    minimumEvaluated: 4,
    domains: [{ domain: DOMAIN.CAPITAL, atLeast: 1, label: "solvency" }],
    subject: "insurer",
  },
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
  return scoreFromChecks(checks, SUFFICIENCY[model]);
}

/** Checks that must never appear on a financial institution's card. */
export const INDUSTRIAL_ONLY_LABELS = [
  "current ratio",
  "debt/equity",
  "more cash than total debt",
];
