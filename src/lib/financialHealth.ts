// Which balance-sheet model a company should be read under.
//
// No imports, so scripts/test-financial-health.mjs can compile and drive it.
//
// The bug this exists to fix: every company was judged against an industrial
// company's debt thresholds, so Power Finance Corporation, whose entire business
// is borrowing money and lending it onward, was labelled "Stretched" at 7.56x
// gearing. That is not a finding about PFC. A lender with no leverage has no
// business, and the figure only means something next to capital adequacy, asset
// quality and liquidity, none of which a debt-to-equity ratio contains.
//
// The same reasoning that put banks and insurers on their own income models
// applies here, and for the same reason: the ratio is not wrong, the yardstick
// is. Raising the threshold would have hidden that rather than fixed it.

/**
 * The five books a balance sheet can be read under.
 *
 * It started as three, and three was still too coarse. A bank funds itself with
 * customer deposits and is judged on capital adequacy and asset quality; a
 * non-bank lender mostly cannot take deposits at all and lives or dies on
 * whether its wholesale funding rolls; a life insurer's liabilities are
 * decades-long actuarial reserves and a general insurer's are claims it expects
 * to pay this year. Handing any of them another's checklist repeats the
 * original mistake one rung down, which is why "lender" split into bank and
 * nbfc and "insurer" split by line of business.
 *
 * This union is duplicated as BalanceSheetModel in balanceSheet.ts; see the
 * comment there for why, and for what stops the two drifting.
 */
export type HealthModel =
  | "industrial"
  | "bank"
  | "nbfc"
  | "life-insurer"
  | "general-insurer";

/** Anything whose leverage is raw material rather than a capital-structure choice. */
export function isFinancialInstitutionModel(model: HealthModel): boolean {
  return model !== "industrial";
}

/** Lenders, of either kind. */
export function isLenderModel(model: HealthModel): boolean {
  return model === "bank" || model === "nbfc";
}

/** Insurers, of either kind. */
export function isInsurerModel(model: HealthModel): boolean {
  return model === "life-insurer" || model === "general-insurer";
}

/**
 * Industries whose leverage is raw material rather than a capital-structure
 * choice.
 *
 * Substring matching, unlike the income-flow registry's exact sets, because
 * this list has to catch "Credit Services", "Banks—Regional" and an Indian
 * "Infrastructure Finance" alike, and a missed match here is a company judged
 * by the wrong yardstick rather than a diagram that fails to draw.
 */
const BANK_TERMS = [
  "bank",
  "thrifts",
  "savings & cooperative",
  "savings and cooperative",
];

/**
 * Non-bank lenders.
 *
 * Kept apart from banks because the single most important line on a bank's
 * funding side — customer deposits — is one most of these companies are not
 * licensed to have. Power Finance Corporation borrows from the wholesale market
 * and lends to power projects; scoring it on deposit funding would mark it down
 * for not being a bank, which is the same error as marking a bank down for not
 * being a manufacturer.
 */
const NBFC_TERMS = [
  "credit services",
  "consumer finance",
  "mortgage finance",
  "specialty finance",
  "infrastructure finance",
  "development finance",
  "housing finance",
  "non banking financial",
  "nbfc",
  "leasing",
];

/**
 * Insurers, which are levered in a third way again: their liabilities are
 * policy reserves, not borrowings, and a debt-to-equity ratio built from
 * borrowings describes almost none of the balance sheet.
 *
 * Insurance BROKERS are excluded. A broker carries no policy reserves and no
 * loan book; it is an ordinary company that happens to sell insurance, and it
 * should be judged like one.
 */
/**
 * Life assurance, whose liabilities run for decades and are actuarial estimates
 * rather than amounts owed.
 */
const LIFE_INSURER_TERMS = ["insurance—life", "insurance - life", "insurance life", "life insurance", "life assurance"];

/** Everything else that underwrites: property, casualty, health, reinsurance. */
const GENERAL_INSURER_TERMS = ["insurance", "insurers", "reinsurance", "assurance"];

const NOT_INSURER_TERMS = ["insurance brokers", "insurance broker"];

const norm = (s?: string) => (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

export function financialHealthModel(industry?: string, sector?: string): HealthModel {
  const i = norm(industry);
  if (!i) {
    // The sector alone is too coarse to promote a company OUT of the industrial
    // model: "Financial Services" holds brokers, exchanges and asset managers,
    // whose balance sheets are ordinary. Without an industry we judge normally.
    return "industrial";
  }
  // Order matters. "Insurance Brokers" contains "insurance", and a broker is an
  // ordinary company that sells other people's policies: it carries no reserves
  // and no loan book, so it must be excluded before anything else is tested.
  if (NOT_INSURER_TERMS.some((t) => i.includes(t))) return "industrial";
  if (BANK_TERMS.some((t) => i.includes(t))) return "bank";
  if (NBFC_TERMS.some((t) => i.includes(t))) return "nbfc";
  // Life before general: "Insurance—Life" contains "insurance", so testing the
  // general list first would swallow every life insurer.
  if (LIFE_INSURER_TERMS.some((t) => i.includes(t))) return "life-insurer";
  if (GENERAL_INSURER_TERMS.some((t) => i.includes(t))) return "general-insurer";
  void sector;
  return "industrial";
}

export type LeverageTone = "good" | "warn" | "bad" | "neutral";

export interface LeverageVerdict {
  /** The word shown under the balance, or null where no verdict is warranted. */
  verdict: string | null;
  tone: LeverageTone;
  /** The sentence that explains what the reader is looking at. */
  note: string;
}

/**
 * What to say about a debt-to-equity ratio, given the model.
 *
 * For a lender there is no verdict at all, only the number and what it should
 * be read against. That is deliberate: a green or red word here would be a
 * judgement the data cannot support, and "neutral" is not a hedge but the
 * accurate answer.
 */
export function leverageVerdict(
  ratio: number | null | undefined,
  model: HealthModel
): LeverageVerdict {
  if (ratio == null || !isFinite(ratio)) {
    return {
      verdict: null,
      tone: "neutral",
      note: "There isn't a debt and equity pair from the same reporting date to compare.",
    };
  }

  if (isLenderModel(model)) {
    return {
      verdict: `${ratio.toFixed(2)}x gearing`,
      tone: "neutral",
      note:
        "A lender funds its loan book with borrowings, so gearing is the shape of the business rather than a warning sign. It should be read alongside capital adequacy, asset quality and liquidity, which are published in the company's own filings and not in this data source.",
    };
  }

  if (isInsurerModel(model)) {
    return {
      verdict: `${ratio.toFixed(2)}x`,
      tone: "neutral",
      note:
        "An insurer's largest liabilities are policy reserves rather than borrowings, so a debt-to-equity ratio describes only a small part of this balance sheet. Solvency ratios are the measure that matters, and they are published in the company's own filings.",
    };
  }

  return {
    verdict: ratio <= 0.5 ? "Healthy" : ratio <= 1 ? "Manageable" : "Stretched",
    tone: ratio <= 0.5 ? "good" : ratio <= 1 ? "warn" : "bad",
    note: "Debt is interest-bearing borrowings; equity is total shareholder equity.",
  };
}

/**
 * Whether operating cash flow against debt is worth showing at all.
 *
 * For a lender it is not. Drawing down a facility to fund new loans is a cash
 * OUTFLOW from operations and an expansion of the book at the same time, so the
 * ratio reads worst exactly when the business is growing fastest: PFC's 1.5%
 * "coverage" was an artefact of that, not a liquidity warning.
 */
export function showsCashFlowCoverage(model: HealthModel): boolean {
  return model === "industrial";
}

/**
 * Whether "more debt than cash" is worth saying.
 *
 * Never for a lender or an insurer. A bank holding less cash than borrowings is
 * a bank; the sentence is true of essentially every one of them and tells the
 * reader nothing.
 */
export function showsCashVersusDebt(model: HealthModel): boolean {
  return model === "industrial";
}

export const MODEL_HEADINGS: Record<HealthModel, { title: string; subtitle: string }> = {
  industrial: {
    title: "Debt to equity history and analysis",
    subtitle:
      "How the company's borrowings compare with shareholder equity over time, and whether that debt is comfortably covered.",
  },
  bank: {
    title: "Borrowings and equity history",
    subtitle:
      "How the balance sheet is funded. A bank's largest funding source is customer deposits, which are not borrowings and are not shown here, so this is a partial view of the liability side rather than a verdict on it.",
  },
  nbfc: {
    title: "Borrowings and equity history",
    subtitle:
      "How the loan book is funded. A non-bank lender borrows wholesale and lends onward, so gearing is the shape of the business rather than a warning sign, and it should be read against capital adequacy and asset quality.",
  },
  "life-insurer": {
    title: "Borrowings and equity history",
    subtitle:
      "Borrowings against shareholder equity. A life insurer's main liabilities are policy reserves held against contracts running for decades; they are not borrowings and do not appear here.",
  },
  "general-insurer": {
    title: "Borrowings and equity history",
    subtitle:
      "Borrowings against shareholder equity. A general insurer's main liabilities are claims reserves rather than borrowings, so this describes only a small part of the balance sheet.",
  },
};

/** The heading to use when there is equity history but no borrowings history. */
export const EQUITY_ONLY_HEADING = {
  title: "Shareholder equity history",
  subtitle:
    "Equity over time. Historical borrowings are not published for this company by the current data source, so this cannot be a debt-to-equity history and does not claim to be one.",
};
