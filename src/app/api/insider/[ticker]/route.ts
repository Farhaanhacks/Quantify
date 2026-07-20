import { getCompanyInsiderTrades } from "@/lib/insider";
import { jsonCached } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { ticker: string } }) {
  try {
    const trades = await getCompanyInsiderTrades(params.ticker, 15);
    // SEC Form 4 filings update slowly — cache 15 min.
    return jsonCached({ available: trades.length > 0, trades }, 900, 1800);
  } catch {
    return jsonCached({ available: false, trades: [] }, 60);
  }
}
