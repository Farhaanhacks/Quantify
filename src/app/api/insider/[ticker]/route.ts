import { getCompanyInsiderTrades } from "@/lib/insider";
import { getIndiaInsiderDisclosures } from "@/lib/insiderIndia";
import { jsonCached } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker;

  // Indian listings (.NS / .BO) → BSE insider/SAST disclosures. US → SEC Form 4.
  if (/\.(NS|BO)$/i.test(ticker)) {
    try {
      const disclosures = await getIndiaInsiderDisclosures(ticker, 15);
      return jsonCached({ available: disclosures.length > 0, market: "IN", disclosures }, 900, 1800);
    } catch {
      return jsonCached({ available: false, market: "IN", disclosures: [] }, 60);
    }
  }

  try {
    const trades = await getCompanyInsiderTrades(ticker, 15);
    // SEC Form 4 filings update slowly — cache 15 min.
    return jsonCached({ available: trades.length > 0, market: "US", trades }, 900, 1800);
  } catch {
    return jsonCached({ available: false, market: "US", trades: [] }, 60);
  }
}
