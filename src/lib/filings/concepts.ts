// Which filer tag means which Quantifi concept, and for whom.
//
// No imports, so scripts/test-filings.mjs can compile and drive this.
//
// The mapping is industry-aware, and that is not a refinement. "InterestIncome"
// on a bank's profit and loss is the top line of the business; the same tag on a
// manufacturer's is a few lakhs of treasury income sitting below operating
// profit. A single flat alias table would fold the two together and produce a
// bank whose "revenue" was its interest earned and a factory whose revenue
// jumped when it moved cash into a deposit. So a tag resolves inside its
// industry's table, or inside the small shared table of things that mean the
// same everywhere, and nowhere else.
//
// A tag that resolves in some OTHER industry's table is not a near miss to be
// accepted with a warning. It is a filing that does not look like the kind of
// company we think it is, which is worth knowing about, so it is reported as a
// mismatch rather than silently mapped.

export type IndustryType =
  | "ordinary"
  | "bank"
  | "nbfc"
  | "life-insurer"
  | "general-insurer";

/**
 * Concepts that mean the same thing on any balance sheet.
 *
 * Deliberately short. Nearly everything interesting about a company's accounts
 * is specific to what it does, and a long shared table is a sign of exactly the
 * flattening this file exists to prevent.
 */
const SHARED_ALIASES: Record<string, string[]> = {
  totalAssets: ["Assets", "TotalAssets", "AssetsTotal"],
  totalLiabilities: ["Liabilities", "TotalLiabilities", "LiabilitiesTotal"],
  shareholderEquity: [
    "Equity",
    "TotalEquity",
    "EquityAttributableToOwnersOfParent",
    "EquityShareCapitalAndOtherEquity",
    "ShareholdersFunds",
  ],
  cashAndEquivalents: [
    "CashAndCashEquivalents",
    "CashAndBankBalances",
    "CashAndCashEquivalentsAtEndOfPeriod",
  ],
  profitAfterTax: [
    "ProfitLossForPeriod",
    "ProfitLoss",
    "ProfitAfterTax",
    "NetProfitLossForPeriod",
    "ComprehensiveIncomeForThePeriod",
  ],
  taxExpense: ["TaxExpense", "IncomeTaxExpense", "CurrentTax", "TotalTaxExpense"],
};

const ORDINARY_ALIASES: Record<string, string[]> = {
  revenue: [
    "RevenueFromOperations",
    "RevenueFromOperationsNet",
    "RevenueFromSaleOfProducts",
    "Revenue",
    "TurnoverGross",
  ],
  otherIncome: ["OtherIncome", "OtherOperatingRevenue"],
  costOfMaterials: ["CostOfMaterialsConsumed", "CostOfGoodsSold", "CostOfRevenue"],
  purchasesOfStockInTrade: ["PurchasesOfStockInTrade"],
  changesInInventories: ["ChangesInInventoriesOfFinishedGoodsWorkInProgressAndStockInTrade"],
  employeeBenefits: ["EmployeeBenefitExpense", "EmployeeBenefitsExpense"],
  financeCosts: ["FinanceCosts", "InterestExpense"],
  depreciation: ["DepreciationDepletionAndAmortisationExpense", "DepreciationAndAmortisationExpense"],
  otherExpenses: ["OtherExpenses"],
  inventories: ["Inventories"],
  tradeReceivables: ["TradeReceivables", "TradeReceivablesCurrent"],
  tradePayables: ["TradePayables", "TradePayablesCurrent"],
  borrowings: ["Borrowings", "TotalBorrowings", "LongTermBorrowings"],
  // Treasury income, which is NOT the top line for a company that makes things.
  interestIncomeNonOperating: ["InterestIncome", "InterestIncomeOnFinancialAssets"],
};

/**
 * A bank's account, which shares almost nothing with the one above.
 *
 * There is no "revenue" here on purpose. A bank reports interest earned and
 * interest expended, and the difference between them is the closest thing it has
 * to a gross margin; calling either of them revenue invites a cost-of-sales
 * calculation that has no meaning. Total income exists as its own concept for
 * the cases that genuinely need a top line.
 */
const BANK_ALIASES: Record<string, string[]> = {
  interestEarned: ["InterestEarned", "InterestIncome", "InterestRevenue", "InterestEarnedTotal"],
  interestExpended: ["InterestExpended", "InterestExpense", "FinanceCosts"],
  netInterestIncome: ["NetInterestIncome"],
  otherIncomeBank: ["OtherIncome", "NonInterestIncome", "FeeAndCommissionIncome"],
  totalIncome: ["TotalIncome", "TotalRevenue"],
  operatingExpenses: ["OperatingExpenses", "OperatingExpensesTotal"],
  deposits: ["Deposits", "TotalDeposits", "CustomerDeposits", "DepositsFromCustomers"],
  demandDeposits: ["DemandDeposits", "CurrentAccountDeposits"],
  savingsDeposits: ["SavingsBankDeposits", "SavingsDeposits"],
  termDeposits: ["TermDeposits", "FixedDeposits"],
  advances: ["Advances", "LoansAndAdvances", "AdvancesNet", "NetAdvances", "LoansAndAdvancesToCustomers"],
  grossAdvances: ["GrossAdvances", "GrossLoansAndAdvances"],
  investments: ["Investments", "InvestmentsTotal"],
  borrowingsBank: ["Borrowings", "BorrowingsTotal"],
  // Asset quality, which is the whole reason this pipeline exists.
  grossNpa: ["GrossNonPerformingAssets", "GrossNPA", "GrossNPAs", "GrossNonPerformingAdvances"],
  netNpa: ["NetNonPerformingAssets", "NetNPA", "NetNPAs", "NetNonPerformingAdvances"],
  grossNpaRatio: ["GrossNPARatio", "PercentageOfGrossNPA", "GrossNonPerformingAssetsRatio"],
  netNpaRatio: ["NetNPARatio", "PercentageOfNetNPA", "NetNonPerformingAssetsRatio"],
  provisionCoverageRatio: ["ProvisionCoverageRatio", "PCR"],
  provisionsAndContingencies: ["ProvisionsAndContingencies", "CreditLossesProvision", "ProvisionForNonPerformingAssets"],
  // Regulatory capital.
  capitalAdequacyRatio: ["CapitalAdequacyRatio", "CRAR", "TotalCapitalRatio", "CapitalToRiskWeightedAssetsRatio"],
  tier1Ratio: ["Tier1CapitalRatio", "TierICapitalRatio", "Tier1Ratio"],
  cet1Ratio: ["CommonEquityTier1CapitalRatio", "CET1Ratio", "CommonEquityTier1Ratio"],
  riskWeightedAssets: ["RiskWeightedAssets", "TotalRiskWeightedAssets"],
};

/**
 * A non-bank lender's account.
 *
 * Deposits are absent, and their absence is the definition: most NBFCs are not
 * licensed to take them. What replaces deposit funding as the thing that can
 * kill the company is the maturity of its borrowings against the maturity of
 * its book, so that is what gets tagged.
 */
const NBFC_ALIASES: Record<string, string[]> = {
  interestEarned: ["InterestIncome", "InterestEarned", "RevenueFromOperations"],
  financeCosts: ["FinanceCosts", "InterestExpense", "InterestExpended"],
  loanBook: ["Loans", "LoansAndAdvances", "AssetsUnderManagement", "AUM", "LoanBook"],
  stage3Assets: ["Stage3Assets", "GrossStage3", "GrossNonPerformingAssets", "GrossNPA"],
  stage3Ratio: ["GrossStage3Ratio", "GrossNPARatio", "Stage3AssetsRatio"],
  impairmentAllowance: ["ImpairmentLossAllowance", "ExpectedCreditLossAllowance", "ProvisionForExpectedCreditLoss"],
  provisionCoverageRatio: ["ProvisionCoverageRatio", "PCR"],
  crar: ["CRAR", "CapitalAdequacyRatio", "CapitalToRiskWeightedAssetsRatio"],
  tier1Ratio: ["Tier1CapitalRatio", "TierICapitalRatio"],
  borrowingsNbfc: ["Borrowings", "DebtSecurities", "BorrowingsOtherThanDebtSecurities"],
  netWorth: ["NetWorth", "OwnedFunds"],
  liquidityCoverageRatio: ["LiquidityCoverageRatio", "LCR"],
  securedLoans: ["SecuredLoans", "LoansSecuredByTangibleAssets"],
  unsecuredLoans: ["UnsecuredLoans"],
};

const LIFE_INSURER_ALIASES: Record<string, string[]> = {
  grossPremium: ["GrossWrittenPremium", "GrossPremiumIncome", "PremiumIncome", "GrossDirectPremium"],
  netPremium: ["NetPremiumIncome", "NetWrittenPremium"],
  firstYearPremium: ["FirstYearPremium", "NewBusinessPremium"],
  renewalPremium: ["RenewalPremium"],
  annualisedPremiumEquivalent: ["AnnualisedPremiumEquivalent", "APE"],
  valueOfNewBusiness: ["ValueOfNewBusiness", "VNB"],
  solvencyRatio: ["SolvencyRatio", "SolvencyMargin", "AvailableSolvencyMarginRatio"],
  requiredSolvencyMargin: ["RequiredSolvencyMargin", "RSM"],
  availableSolvencyMargin: ["AvailableSolvencyMargin", "ASM"],
  policyholderLiabilities: ["PolicyholdersLiabilities", "PolicyLiabilities", "LifeInsuranceContractLiabilities"],
  claimSettlementRatio: ["ClaimSettlementRatio", "ClaimsSettlementRatio"],
  persistency13m: ["Persistency13thMonth", "PersistencyRatio13Month"],
  persistency61m: ["Persistency61stMonth", "PersistencyRatio61Month"],
  benefitsPaid: ["BenefitsPaid", "ClaimsByDeath", "PolicyholderBenefitsPaid"],
  reinsuranceCeded: ["PremiumCededToReinsurers", "ReinsuranceCeded"],
};

const GENERAL_INSURER_ALIASES: Record<string, string[]> = {
  grossWrittenPremium: ["GrossWrittenPremium", "GrossDirectPremiumIncome", "GrossPremiumIncome"],
  netEarnedPremium: ["NetEarnedPremium", "NetPremiumEarned"],
  claimsIncurred: ["ClaimsIncurred", "NetClaimsIncurred", "IncurredClaims"],
  claimsRatio: ["ClaimsRatio", "LossRatio", "IncurredClaimsRatio"],
  expenseRatio: ["ExpenseRatio", "ExpensesOfManagementRatio"],
  combinedRatio: ["CombinedRatio"],
  underwritingResult: ["UnderwritingProfitLoss", "UnderwritingResult"],
  solvencyRatio: ["SolvencyRatio", "SolvencyMargin"],
  claimsReserves: ["ClaimsOutstanding", "ReserveForOutstandingClaims", "UnexpiredRiskReserve"],
  reinsuranceCeded: ["PremiumCededToReinsurers", "ReinsuranceCeded"],
};

const BY_INDUSTRY: Record<IndustryType, Record<string, string[]>> = {
  ordinary: ORDINARY_ALIASES,
  bank: BANK_ALIASES,
  nbfc: NBFC_ALIASES,
  "life-insurer": LIFE_INSURER_ALIASES,
  "general-insurer": GENERAL_INSURER_ALIASES,
};

/**
 * Strip the namespace prefix and any decoration a filer put on a tag.
 *
 * Indian filings arrive under several taxonomies and each prefixes its own way:
 * "in-bse-fin:RevenueFromOperations", "ind-as:RevenueFromOperations",
 * "{http://.../ind-as}RevenueFromOperations". The local name is the part that
 * carries meaning.
 */
export function localName(tag: string): string {
  const noNamespace = tag.replace(/^\{[^}]*\}/, "");
  const afterPrefix = noNamespace.includes(":")
    ? noNamespace.slice(noNamespace.lastIndexOf(":") + 1)
    : noNamespace;
  return afterPrefix.trim();
}

const canonical = (tag: string) => localName(tag).toLowerCase().replace(/[^a-z0-9]/g, "");

/** Built once: every alias of every industry, canonicalised, for reverse lookup. */
const INDEX: Record<IndustryType, Map<string, string>> = (() => {
  const out = {} as Record<IndustryType, Map<string, string>>;
  for (const industry of Object.keys(BY_INDUSTRY) as IndustryType[]) {
    const m = new Map<string, string>();
    for (const [concept, tags] of Object.entries(SHARED_ALIASES)) {
      for (const t of tags) if (!m.has(canonical(t))) m.set(canonical(t), concept);
    }
    // The industry's own table wins over the shared one where they collide:
    // "FinanceCosts" is an ordinary company's interest bill and a bank's
    // interest expended, and the bank's reading is the right one for a bank.
    for (const [concept, tags] of Object.entries(BY_INDUSTRY[industry])) {
      for (const t of tags) m.set(canonical(t), concept);
    }
    out[industry] = m;
  }
  return out;
})();

export interface ConceptMatch {
  concept?: string;
  /** Set when the tag is known, but belongs to a different kind of company. */
  mismatchedIndustries?: IndustryType[];
}

/**
 * Which Quantifi concept a filer's tag means, for THIS kind of company.
 *
 * Returns no concept rather than a guess when the tag is unknown, and reports
 * the industries it WOULD have matched when it is known but foreign. That second
 * case is worth surfacing: a filing full of deposit tags from a company we have
 * classified as a manufacturer means one of the two is wrong, and quietly
 * dropping the tags would hide it.
 */
export function conceptFor(tag: string, industry: IndustryType): ConceptMatch {
  const key = canonical(tag);
  if (!key) return {};
  const own = INDEX[industry].get(key);
  if (own) return { concept: own };

  const elsewhere = (Object.keys(INDEX) as IndustryType[]).filter(
    (i) => i !== industry && INDEX[i].has(key)
  );
  return elsewhere.length ? { mismatchedIndustries: elsewhere } : {};
}

/** Every concept this kind of company can report. */
export function conceptsFor(industry: IndustryType): string[] {
  return [
    ...Object.keys(SHARED_ALIASES),
    ...Object.keys(BY_INDUSTRY[industry]),
  ].sort();
}

/**
 * Concepts that are RATIOS in the filing, already expressed as percentages.
 *
 * Kept explicit because the failure is silent: a gross NPA ratio filed as 1.33
 * meaning 1.33% and stored as the fraction 1.33 would say the bank's book is
 * 133% bad, pass no arithmetic check, and read as a catastrophe.
 */
export const PERCENTAGE_CONCEPTS = new Set([
  "grossNpaRatio",
  "netNpaRatio",
  "provisionCoverageRatio",
  "capitalAdequacyRatio",
  "tier1Ratio",
  "cet1Ratio",
  "crar",
  "stage3Ratio",
  "liquidityCoverageRatio",
  "solvencyRatio",
  "claimSettlementRatio",
  "persistency13m",
  "persistency61m",
  "claimsRatio",
  "expenseRatio",
  "combinedRatio",
]);
