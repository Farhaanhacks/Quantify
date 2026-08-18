import { getYahooStatements } from "@/lib/yahooCompany";
import { yahooQuoteSummary } from "@/lib/yahooCrumb";
import { jsonCached } from "@/lib/httpCache";
import { aliasSymbol } from "@/lib/symbolAlias";
import { buildIncomeFlow, type IncomeLines } from "@/lib/incomeFlow";

export const dynamic = "force-dynamic";

// The income statement behind the revenue-and-expenses breakdown.
//
// Annual figures, from the most recently reported year. Yahoo's fundamentals
// feed carries no SEGMENT breakdown, so this cannot fan revenue out into
// business lines the way a filing does; the diagram starts at total revenue and
// the section says why.

export async function GET(_req: Request, { params }: { params: { symbol: string } }) {
  const symbol = aliasSymbol(params.symbol.toUpperCase());

  try {
    const [statements, summary] = await Promise.all([
      getYahooStatements(symbol),
      yahooQuoteSummary(symbol, "price").catch(() => undefined),
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

    const lines: IncomeLines = {
      revenue: row.values.revenue,
      costOfRevenue: row.values.costOfRevenue,
      grossProfit: row.values.grossProfit,
      researchAndDevelopment: row.values.researchAndDevelopment,
      sellingGeneralAdmin: row.values.sellingGeneralAdmin,
      operatingExpense: row.values.operatingExpense,
      operatingIncome: row.values.operatingIncome,
      taxProvision: row.values.taxProvision,
      pretaxIncome: row.values.pretaxIncome,
      nonOperatingInterest: row.values.nonOperatingInterest,
      otherNonOperating: row.values.otherNonOperating,
      netIncome: row.values.netIncome,
    };

    const flow = buildIncomeFlow(lines);
    if (!flow.ok) {
      return jsonCached(
        {
          available: false,
          reason: "not_drawable",
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
        flow,
        lines,
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
