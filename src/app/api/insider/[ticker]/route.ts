import { getCompanyInsiderTrades } from "@/lib/insider";
import { getIndiaInsiderWithDebug } from "@/lib/insiderIndia";
import { jsonCached } from "@/lib/httpCache";

export const dynamic = "force-dynamic";
// The Indian path proxies BSE through ScraperAPI (residential proxies, slow) and
// may auto-escalate to a second ultra_premium pass on a block. The default
// serverless budget can kill that mid-flight — which left the UI stuck on
// "Loading…" and, because the request never finished, nothing was ever cached so
// every load retried from cold. Give it headroom for both passes.
export const maxDuration = 60;

export async function GET(req: Request, { params }: { params: { ticker: string } }) {
  const ticker = params.ticker;
  const wantDebug = new URL(req.url).searchParams.get("debug") === "1";

  // Indian listings (.NS / .BO) → BSE insider/SAST disclosures. US → SEC Form 4.
  if (/\.(NS|BO)$/i.test(ticker)) {
    try {
      const { disclosures, debug } = await getIndiaInsiderWithDebug(ticker, 20);
      const hit = disclosures.length > 0;
      // Cache a HIT for 15 min (BSE disclosures change slowly). Cache a MISS only
      // briefly (2 min) so a transient BSE block clears fast instead of freezing
      // "no data" on the page for a full 15 minutes.
      return jsonCached(
        {
          available: hit,
          market: "IN",
          disclosures,
          ...(wantDebug ? { debug } : {}),
        },
        hit ? 900 : 120,
        hit ? 1800 : 240
      );
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
