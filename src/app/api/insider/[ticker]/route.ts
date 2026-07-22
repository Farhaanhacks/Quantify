import { getCompanyInsiderTrades } from "@/lib/insider";
import { getIndiaInsiderWithDebug } from "@/lib/insiderIndia";
import { getNSEInsiderWithDebug } from "@/lib/insiderIndiaNSE";
import { getStoredInsider } from "@/lib/insiderStore";
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

  // Indian listings (.NS / .BO). Serving order:
  //   0) The ingested STORE (Redis) — fast, deterministic, filled by the daily
  //      cron. This is the reliable path once ingestion has run.
  //   1) LIVE NSE structured API — fallback for symbols not yet ingested.
  //   2) LIVE BSE announcements — final fallback.
  // US → SEC Form 4.
  if (/\.(NS|BO)$/i.test(ticker)) {
    try {
      // 0) Ingested store first.
      const stored = await getStoredInsider(ticker);
      if (stored && stored.length > 0) {
        return jsonCached(
          {
            available: true,
            market: "IN",
            source: "store",
            disclosures: stored,
            ...(wantDebug ? { debug: { source: "store", count: stored.length } } : {}),
          },
          900,
          1800
        );
      }

      // 1) NSE first — the richer, structured source.
      const nse = await getNSEInsiderWithDebug(ticker, 20);
      if (nse.disclosures.length > 0) {
        return jsonCached(
          {
            available: true,
            market: "IN",
            source: "nse",
            disclosures: nse.disclosures,
            ...(wantDebug ? { debug: nse.debug } : {}),
          },
          900,
          1800
        );
      }

      // 2) Fall back to BSE announcements.
      const { disclosures, debug } = await getIndiaInsiderWithDebug(ticker, 20);
      const hit = disclosures.length > 0;
      // Cache a HIT for 15 min (disclosures change slowly). Cache a MISS only
      // briefly (2 min) so a transient block clears fast instead of freezing
      // "no data" on the page for a full 15 minutes.
      return jsonCached(
        {
          available: hit,
          market: "IN",
          source: hit ? "bse" : "none",
          disclosures,
          // On a miss, surface BOTH sources' debug so we can see why each failed.
          ...(wantDebug ? { debug: { nse: nse.debug, bse: debug } } : {}),
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
