import { getYahooCompany } from "@/lib/yahooCompany";
import { jsonCached } from "@/lib/httpCache";
import { aliasSymbol } from "@/lib/symbolAlias";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const data = await getYahooCompany(aliasSymbol(params.symbol));
    // Company profile/financials change slowly — cache 10 min at the edge.
    if (!data) return jsonCached({ available: false }, 300);
    return jsonCached({ available: true, data }, 600, 1800);
  } catch (err) {
    console.error("[company] failed:", err);
    return jsonCached({ available: false }, 60);
  }
}
