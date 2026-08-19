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

export type HealthModel = "industrial" | "lender" | "insurer";

/**
 * Industries whose leverage is raw material rather than a capital-structure
 * choice.
 *
 * Substring matching, unlike the income-flow registry's exact sets, because
 * this list has to catch "Credit Services", "Banks—Regional" and an Indian
 * "Infrastructure Finance" alike, and a missed match here is a company judged
 * by the wrong yardstick rather than a diagram that fails to draw.
 */
const LENDER_TERMS = [
  "bank",
  "credit services",
  "consumer finance",
  "mortgage finance",
  "specialty finance",
  "infrastructure finance",
  "development finance",
  "thrifts",
  "savings & cooperative",
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
const INSURER_TERMS = ["insurance", "insurers", "reinsurance"];
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
  if (NOT_INSURER_TERMS.some((t) => i.includes(t))) return "industrial";
  if (LENDER_TERMS.some((t) => i.includes(t))) return "lender";
  if (INSURER_TERMS.some((t) => i.includes(t))) return "insurer";
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

  if (model === "lender") {
    return {
      verdict: `${ratio.toFixed(2)}x gearing`,
      tone: "neutral",
      note:
        "A lender funds its loan book with borrowings, so gearing is the shape of the business rather than a warning sign. It should be read alongside capital adequacy, asset quality and liquidity, which are published in the company's own filings and not in this data source.",
    };
  }

  if (model === "insurer") {
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
  lender: {
    title: "Borrowings and equity history",
    subtitle:
      "How the loan book is funded. For a lender, borrowings are raw material rather than a burden, so this shows the shape of the balance sheet instead of judging it against industrial thresholds.",
  },
  insurer: {
    title: "Borrowings and equity history",
    subtitle:
      "Borrowings against shareholder equity. An insurer's main liabilities are policy reserves, which are not borrowings and do not appear here.",
  },
};

/** The heading to use when there is equity history but no borrowings history. */
export const EQUITY_ONLY_HEADING = {
  title: "Shareholder equity history",
  subtitle:
    "Equity over time. Historical borrowings are not published for this company by the current data source, so this cannot be a debt-to-equity history and does not claim to be one.",
};
