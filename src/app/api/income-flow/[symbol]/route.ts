import { getYahooStatements } from "@/lib/yahooCompany";
import { yahooQuoteSummary } from "@/lib/yahooCrumb";
import { jsonCached } from "@/lib/httpCache";
import { aliasSymbol } from "@/lib/symbolAlias";
import {
  buildFlowForModel,
  MODEL_TITLES,
  type AnyIncomeLines,
  type IncomeModel,
} from "@/lib/incomeFlow";

export const dynamic = "force-dynamic";

// The income statement behind the revenue-and-expenses breakdown, and the choice
// of which structure to read it as.
//
// Annual figures, from the most recently reported year. Yahoo's fundamentals
// feed carries no SEGMENT breakdown, so this cannot fan revenue out into
// business lines the way a filing does; the diagram starts at the top line and
// the section says why.

/**
 * Industries that report as lenders.
 *
 * Deliberately NOT the whole Financial Services sector. An insurer has its own
 * list below; an asset manager's account is fee income against compensation and
 * a broker's is commissions, and neither is interest earned and expended.
 * Drawing them as a bank would repeat the same mistake one industry over, so
 * they fall through to the industrial builder and, failing that, to the generic
 * bridge, which claims nothing about structure.
 */
const BANK_INDUSTRIES = new Set([
  "banks",
  "banks—regional",
  "banks—diversified",
  "banks - regional",
  "banks - diversified",
  "banks—regional - us",
  "savings & cooperative banks",
  "thrifts & mortgage finance",
]);

/**
 * Industries that report as insurers.
 *
 * Separate from banking for the same reason banking is separate from industry:
 * an insurer's account runs premiums earned and investment income in, claims
 * incurred out. It has no interest expended and no cost of sales, and drawing it
 * as either would be the same substitution one industry over.
 */
const INSURANCE_INDUSTRIES = new Set([
  "insurance—life",
  "insurance - life",
  "insurance—property & casualty",
  "insurance - property & casualty",
  "insurance—reinsurance",
  "insurance - reinsurance",
  "insurance—specialty",
  "insurance - specialty",
  "insurance—diversified",
  "insurance - diversified",
  "insurance brokers",
  "insurance",
]);

const normIndustry = (s?: string) =>
  (s ?? "").toLowerCase().replace(/\s+/g, " ").trim();

export async function GET(_req: Request, { params }: { params: { symbol: string } }) {
  const symbol = aliasSymbol(params.symbol.toUpperCase());

  try {
    const [statements, summary] = await Promise.all([
      getYahooStatements(symbol),
      yahooQuoteSummary(symbol, "price,assetProfile").catch(() => undefined),
    ]);
    const row = statements.income[0];
    if (!row) {
      return jsonCached(
        {
          available: false,
          reason: "no_statements",
          message: `No annual income statement is published for ${symbol}. This is normal for funds, currencies and very recent listings.`,
        },
        1800,
        3600
      );
    }

    const ap = (summary?.assetProfile ?? {}) as Record<string, unknown>;
    const industry = typeof ap.industry === "string" ? ap.industry : undefined;
    const sector = typeof ap.sector === "string" ? ap.sector : undefined;
    const v = row.values;

    // Each model needs BOTH an industry that reports that way and the lines
    // themselves. The industry alone mis-files anything Yahoo classifies
    // loosely; the lines alone catch every company that happens to report an
    // interest figure, which is most of them.
    const hasBankFields =
      v.netInterestIncome != null ||
      v.interestIncome != null ||
      v.provisionForLoanLosses != null;
    const hasInsuranceFields =
      v.premiumsEarned != null || v.claimsIncurred != null || v.netInvestmentIncome != null;

    const ind = normIndustry(industry);
    const model: IncomeModel = BANK_INDUSTRIES.has(ind) && hasBankFields
      ? "bank"
      : INSURANCE_INDUSTRIES.has(ind) && hasInsuranceFields
        ? "insurance"
        : "industrial";

    const lines: AnyIncomeLines =
      model === "bank"
        ? {
            model: "bank",
            interestIncome: v.interestIncome,
            interestExpense: v.interestExpense,
            netInterestIncome: v.netInterestIncome,
            nonInterestIncome: v.nonInterestIncome,
            operatingExpense: v.operatingExpense,
            provisionForLoanLosses: v.provisionForLoanLosses,
            pretaxIncome: v.pretaxIncome,
            taxProvision: v.taxProvision,
            netIncome: v.netIncome,
            totalIncome: v.revenue,
          }
        : model === "insurance"
          ? {
              model: "insurance",
              premiumsEarned: v.premiumsEarned,
              netInvestmentIncome: v.netInvestmentIncome,
              totalRevenue: v.revenue,
              claimsIncurred: v.claimsIncurred,
              underwritingExpense: v.underwritingExpense,
              operatingExpense: v.operatingExpense,
              pretaxIncome: v.pretaxIncome,
              taxProvision: v.taxProvision,
              netIncome: v.netIncome,
            }
          : {
              model: "industrial",
              revenue: v.revenue,
              costOfRevenue: v.costOfRevenue,
              grossProfit: v.grossProfit,
              researchAndDevelopment: v.researchAndDevelopment,
              sellingGeneralAdmin: v.sellingGeneralAdmin,
              operatingExpense: v.operatingExpense,
              operatingIncome: v.operatingIncome,
              taxProvision: v.taxProvision,
              pretaxIncome: v.pretaxIncome,
              nonOperatingInterest: v.nonOperatingInterest,
              otherNonOperating: v.otherNonOperating,
              netIncome: v.netIncome,
            };

    const flow = buildFlowForModel(lines);
    if (!flow.ok) {
      return jsonCached(
        {
          available: false,
          reason: "not_drawable",
          model: flow.model,
          title: MODEL_TITLES[flow.model ?? "industrial"],
          // The statement itself, so the section can show a table where it
          // cannot draw a diagram. A reader who came for the numbers should not
          // leave with a sentence.
          statement: v,
          periodEnd: row.date,
          message: `The breakdown can't be drawn for ${symbol}: ${flow.reason}.`,
        },
        1800,
        3600
      );
    }

    const pr = (summary?.price ?? {}) as Record<string, unknown>;
    // Annual statements change four times a year. A day at the edge is generous
    // to the source and still fresher than the data itself.
    return jsonCached(
      {
        available: true,
        symbol,
        name: typeof pr.longName === "string" ? pr.longName : undefined,
        currency: typeof pr.currency === "string" ? pr.currency : undefined,
        periodEnd: row.date,
        model: flow.model,
        title: MODEL_TITLES[flow.model ?? "industrial"],
        industry,
        sector,
        flow,
        statement: v,
      },
      86400,
      172800
    );
  } catch (err) {
    console.error("[income-flow] failed:", err);
    return jsonCached(
      {
        available: false,
        reason: "source_unavailable",
        message: `Couldn't reach the income statement for ${symbol} right now.`,
      },
      60,
      120
    );
  }
}
