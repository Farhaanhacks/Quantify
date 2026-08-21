import {
  ratio,
  PCR_TOTAL,
  type BankMetrics,
  type Metric,
  type NbfcMetrics,
} from "@/lib/balanceSheet";
import type { FilingFact } from "@/lib/filings/types";

// Where the filings pipeline meets the balance-sheet card.
//
// This is the point of the whole exercise. HDFC Bank's Balance Sheet Strength
// said "Insufficient bank data" because gross NPAs, provision coverage and
// capital adequacy are published in the bank's own filings and in its Basel
// disclosures, and are not in any generic quote feed. Everything upstream of
// here exists to get those four numbers out of a document with their reporting
// date, their scope and their source attached. This file hands them to the
// checklist.
//
// It hands over Metrics, not numbers. A metric that arrives without its date and
// scope cannot be combined with another one safely, and ratio() below refuses
// exactly that: a consolidated loan book over a standalone deposit base is not a
// loans-to-deposits ratio, however normal the answer looks.

/**
 * The regulatory floor a lender's capital is measured against.
 *
 * A capital adequacy ratio is meaningless without one. 11.5% is comfortable for
 * an Indian bank and a breach for an Indian NBFC, so a single absolute threshold
 * would mark one of them wrongly whichever number were chosen. What the checks
 * actually read is the HEADROOM above the floor, which is the same question in
 * every jurisdiction.
 *
 * India: the RBI requires 9% CRAR for banks, plus a 2.5% capital conservation
 * buffer, so 11.5% is the working minimum; NBFCs are held to 15%. These are the
 * figures in force as this was written, and they move. They are declared here,
 * once, rather than buried in a comparison.
 */
export const REGULATORY_MINIMUM: Record<string, { bank: number; nbfc: number }> = {
  IN: { bank: 0.115, nbfc: 0.15 },
};

const DEFAULT_MINIMUM = { bank: 0.08, nbfc: 0.12 };

/** Find one concept's fact, preferring the one whose period matches. */
function pick(facts: FilingFact[], concept: string, periodEnd?: string): FilingFact | undefined {
  const candidates = facts.filter(
    (f) => f.concept === concept && !f.rejectedReason && f.numericValue != null
  );
  if (!candidates.length) return undefined;
  if (periodEnd) {
    const exact = candidates.find((f) => f.periodEnd === periodEnd);
    if (exact) return exact;
  }
  // Newest otherwise. A filing carries several periods and the most recent is
  // the one the page is about.
  return candidates.sort((a, b) => (b.periodEnd ?? "").localeCompare(a.periodEnd ?? ""))[0];
}

function toMetric(
  f: FilingFact | undefined,
  opts: { definition?: string; asFraction?: boolean; sourceUrl?: string; source?: string } = {}
): Metric {
  if (!f || f.numericValue == null) {
    return {
      unavailableReason: "Not tagged in the filings held for this company.",
      definition: opts.definition,
    };
  }
  // Filings state ratios in percent. The checklist reads fractions. Getting this
  // backwards would report a bank's 1.33% gross NPA as 133% of its book, which
  // passes every arithmetic check and reads as a collapse.
  const value = opts.asFraction ? f.numericValue / 100 : f.numericValue;
  return {
    value,
    asOf: f.periodEnd,
    scope: f.scope,
    source: opts.source ?? `Filing ${f.filingId}`,
    sourceUrl: opts.sourceUrl,
    definition: opts.definition ?? f.sourceConcept,
    derived: false,
  };
}

/** Capital held ABOVE the floor, in percentage points, as the checks expect. */
function capitalHeadroom(reported: Metric, minimum: number): Metric {
  if (reported.value == null) {
    return {
      unavailableReason: reported.unavailableReason ?? "Capital adequacy not tagged.",
      definition: "reported capital ratio less the regulatory minimum",
    };
  }
  return {
    ...reported,
    value: reported.value - minimum,
    definition: `reported capital ratio less the ${(minimum * 100).toFixed(1)}% regulatory minimum`,
    derived: true,
  };
}

export interface MetricSourcing {
  /** Filled from the filings. */
  metrics: BankMetrics | NbfcMetrics;
  /** How many of the checklist's measures the filings actually supplied. */
  sourced: number;
}

/**
 * A bank's checklist inputs, from its filings.
 *
 * Ratios are used as filed where the bank filed them, and derived from the
 * absolutes where it did not. Deriving is the fallback rather than the default
 * on purpose: gross NPA over gross advances is the definition, but a bank that
 * publishes the ratio itself has published the one its regulator agreed to, and
 * ours can differ in the denominator.
 */
export function bankMetricsFromFilings(
  facts: FilingFact[],
  opts: { periodEnd?: string; homeCountry?: string; sourceUrl?: string } = {}
): MetricSourcing {
  const at = (concept: string) => pick(facts, concept, opts.periodEnd);
  const src = { sourceUrl: opts.sourceUrl };

  const grossNpa = toMetric(at("grossNpa"), { definition: "gross non-performing assets", ...src });
  const netNpa = toMetric(at("netNpa"), { definition: "net non-performing assets", ...src });
  const grossAdvances = toMetric(at("grossAdvances") ?? at("advances"), { definition: "gross advances", ...src });
  const advances = toMetric(at("advances"), { definition: "net advances", ...src });
  const deposits = toMetric(at("deposits"), { definition: "customer deposits", ...src });
  const assets = toMetric(at("totalAssets"), { definition: "total assets", ...src });
  const liabilities = toMetric(at("totalLiabilities"), { definition: "total liabilities", ...src });
  const equity = toMetric(at("shareholderEquity"), { definition: "shareholder equity", ...src });

  const reportedGrossNpaRatio = toMetric(at("grossNpaRatio"), {
    definition: "gross NPAs / gross advances, as filed",
    asFraction: true,
    ...src,
  });
  const reportedNetNpaRatio = toMetric(at("netNpaRatio"), {
    definition: "net NPAs / net advances, as filed",
    asFraction: true,
    ...src,
  });
  const reportedPcr = toMetric(at("provisionCoverageRatio"), {
    definition: PCR_TOTAL,
    asFraction: true,
    ...src,
  });
  const reportedCar = toMetric(at("capitalAdequacyRatio") ?? at("cet1Ratio") ?? at("tier1Ratio"), {
    definition: "capital to risk-weighted assets, as filed",
    asFraction: true,
    ...src,
  });

  const minimum = (REGULATORY_MINIMUM[opts.homeCountry ?? "IN"] ?? DEFAULT_MINIMUM).bank;

  const metrics: BankMetrics = {
    grossNpaRatio:
      reportedGrossNpaRatio.value != null
        ? reportedGrossNpaRatio
        : ratio(grossNpa, grossAdvances, { definition: "gross NPAs / gross advances" }),
    netNpaRatio:
      reportedNetNpaRatio.value != null
        ? reportedNetNpaRatio
        : ratio(netNpa, advances, { definition: "net NPAs / net advances" }),
    provisionCoverage:
      reportedPcr.value != null
        ? reportedPcr
        : ratio(
            toMetric(at("provisionsAndContingencies"), { definition: "provisions held", ...src }),
            grossNpa,
            { definition: PCR_TOTAL }
          ),
    depositFunding: ratio(deposits, liabilities, {
      definition: "customer deposits / total liabilities",
    }),
    loansToDeposits: ratio(advances, deposits, { definition: "net advances / customer deposits" }),
    loansToAssets: ratio(advances, assets, { definition: "net advances / total assets" }),
    assetsToEquity: ratio(assets, equity, { definition: "total assets / shareholder equity" }),
    capitalBufferPoints: capitalHeadroom(reportedCar, minimum),
  };

  const sourced = Object.values(metrics).filter(
    (m) => m && typeof (m as Metric).value === "number"
  ).length;
  return { metrics, sourced };
}

/**
 * A non-bank lender's checklist inputs.
 *
 * No deposit funding, because most NBFCs are not licensed to take deposits and
 * scoring one against a bar it cannot legally clear is the error this whole
 * change set exists to undo.
 */
export function nbfcMetricsFromFilings(
  facts: FilingFact[],
  opts: { periodEnd?: string; homeCountry?: string; sourceUrl?: string; gearingCeiling?: number } = {}
): MetricSourcing {
  const at = (concept: string) => pick(facts, concept, opts.periodEnd);
  const src = { sourceUrl: opts.sourceUrl };
  const minimum = (REGULATORY_MINIMUM[opts.homeCountry ?? "IN"] ?? DEFAULT_MINIMUM).nbfc;

  const crar = toMetric(at("crar"), {
    definition: "capital to risk-weighted assets, as filed",
    asFraction: true,
    ...src,
  });
  const tier1 = toMetric(at("tier1Ratio"), {
    definition: "tier-1 capital ratio, as filed",
    asFraction: true,
    ...src,
  });
  const stage3Reported = toMetric(at("stage3Ratio"), {
    definition: "gross Stage 3 / gross loan book, as filed",
    asFraction: true,
    ...src,
  });
  const loanBook = toMetric(at("loanBook"), { definition: "gross loan book", ...src });
  const stage3 = toMetric(at("stage3Assets"), { definition: "gross Stage 3 assets", ...src });
  const allowance = toMetric(at("impairmentAllowance"), { definition: "impairment allowance", ...src });
  const borrowings = toMetric(at("borrowingsNbfc"), { definition: "total borrowings", ...src });
  const netWorth = toMetric(at("netWorth") ?? at("shareholderEquity"), { definition: "net worth", ...src });
  const secured = toMetric(at("securedLoans"), { definition: "secured loans", ...src });

  const metrics: NbfcMetrics = {
    crarBufferPoints: capitalHeadroom(crar, minimum),
    // Tier-1's own floor is two thirds of the total requirement under the RBI's
    // scale-based regulation, which is where 10% comes from for a 15% CRAR.
    tier1BufferPoints: capitalHeadroom(tier1, minimum * (2 / 3)),
    stage3Ratio:
      stage3Reported.value != null
        ? stage3Reported
        : ratio(stage3, loanBook, { definition: "gross Stage 3 / gross loan book" }),
    provisionCoverage:
      toMetric(at("provisionCoverageRatio"), { definition: "impairment allowance / gross Stage 3", asFraction: true, ...src }).value != null
        ? toMetric(at("provisionCoverageRatio"), { definition: "impairment allowance / gross Stage 3", asFraction: true, ...src })
        : ratio(allowance, stage3, { definition: "impairment allowance / gross Stage 3" }),
    gearing: ratio(borrowings, netWorth, { definition: "total borrowings / net worth" }),
    liquidityCoverage: toMetric(at("liquidityCoverageRatio"), {
      definition: "liquidity coverage ratio, as filed",
      asFraction: true,
      ...src,
    }),
    securedShare: ratio(secured, loanBook, { definition: "secured loans / gross loan book" }),
    gearingCeiling: opts.gearingCeiling,
    // Maturity gaps, funding concentration and sector exposure are in the
    // asset-liability and concentration tables of the annual report, which are
    // narrative rather than tagged. They stay unavailable until the HTML and PDF
    // readers land, and the card says so rather than scoring around them.
  };

  const sourced = Object.values(metrics).filter(
    (m) => m && typeof (m as Metric).value === "number"
  ).length;
  return { metrics, sourced };
}
