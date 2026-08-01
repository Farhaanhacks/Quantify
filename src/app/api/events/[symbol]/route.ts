import { getCompanyEvents } from "@/lib/companyEvents";
import { jsonCached } from "@/lib/httpCache";
import { aliasSymbol } from "@/lib/symbolAlias";

export const dynamic = "force-dynamic";

// Dated corporate events for the price chart: SEC 8-K filings classified by
// their official item codes, plus dividends and splits. Both sources are
// public-domain, so nothing here needs a key or a licence.
//
// A failure is not an error state for the caller — the chart simply draws no
// markers, so we always answer 200 with a (possibly empty) list.
export async function GET(req: Request, { params }: { params: { symbol: string } }) {
  const symbol = aliasSymbol(params.symbol);
  const range = new URL(req.url).searchParams.get("range") || "1y";

  try {
    const events = await getCompanyEvents(symbol, range);
    // Events change at most daily; a stale-while-revalidate window keeps the
    // chart instant on repeat views without hammering EDGAR.
    return jsonCached({ ok: true, symbol, range, events }, 3600, 86400);
  } catch {
    return jsonCached({ ok: false, symbol, range, events: [] }, 300);
  }
}
