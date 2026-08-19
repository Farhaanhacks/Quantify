import { getYahooStatements } from "@/lib/yahooCompany";
import { yahooQuoteSummary } from "@/lib/yahooCrumb";
import { jsonCached } from "@/lib/httpCache";
import { aliasSymbol } from "@/lib/symbolAlias";
import {
  buildFlowForModel,
  type BankIncomeLines,
  type IndustrialIncomeLines,
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
 * Deliberately NOT the whole Financial Services sector. An insurer's account
 * runs premiums earned to claims incurred to underwriting result; an asset
 * manager's is fee income against compensation; a broker's is commissions. None
 * of those are interest earned and expended, and drawing them as a bank would
 * repeat the same mistake this selection exists to fix, one industry over. They
 * fall through to the industrial builder, which refuses honestly, until each has
 * a model of its own.
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

    // Two conditions, both required. The industry alone would mis-file any
    // company Yahoo classifies loosely; the fields alone would catch every
    // company that happens to report an interest line, which is most of them.
    const hasBankFields =
      v.netInterestIncome != null ||
      v.interestIncome != null ||
      v.provisionForLoanLosses != null;
    const isBank = BANK_INDUSTRIES.has(normIndustry(industry)) && hasBankFields;

    const lines: BankIncomeLines | IndustrialIncomeLines = isBank
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
