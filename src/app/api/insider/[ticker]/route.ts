import { getCompanyInsiderTrades } from "@/lib/insider";
import { getIndiaInsiderWithDebug } from "@/lib/insiderIndia";
import { getNSEInsiderWithDebug } from "@/lib/insiderIndiaNSE";
import { getTaiwanInsiderWithDebug } from "@/lib/insiderTaiwan";
import { getStoredInsider } from "@/lib/insiderStore";
import { jsonCached } from "@/lib/httpCache";
import { aliasSymbol } from "@/lib/symbolAlias";

export const dynamic = "force-dynamic";
// The Indian path proxies BSE through ScraperAPI (residential proxies, slow) and
// may auto-escalate to a second ultra_premium pass on a block. The default
// serverless budget can kill that mid-flight — which left the UI stuck on
// "Loading…" and, because the request never finished, nothing was ever cached so
// every load retried from cold. Give it headroom for both passes.
export const maxDuration = 110;

export async function GET(req: Request, { params }: { params: { ticker: string } }) {
  const ticker = aliasSymbol(params.ticker);
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

  // Taiwan (.TW / .TWO) → FinMind's open insider-shareholding dataset. Open data,
  // so it carries none of the "personal use only" redistribution limits that
  // retail market-data vendors put on their consumer tiers.
  if (/\.(TW|TWO)$/i.test(ticker)) {
    try {
      const { disclosures, debug } = await getTaiwanInsiderWithDebug(ticker, 20);
      const hit = disclosures.length > 0;
      return jsonCached(
        {
          available: hit,
          market: "TW",
          source: hit ? "finmind" : "none",
          disclosures,
          ...(wantDebug ? { debug } : {}),
        },
        hit ? 3600 : 300,
        hit ? 7200 : 600
      );
    } catch {
      return jsonCached({ available: false, market: "TW", disclosures: [] }, 60);
    }
  }

  // Markets we don't have a licensed/open insider source wired for yet. Korea has
  // OpenDART and China has CNINFO — both official and free, but each needs its own
  // issuer-code mapping (DART corp_code / CNINFO orgId) before it can serve a
  // ticker. Returning an explicit "unsupported market" beats silently handing the
  // symbol to EDGAR, which can never have it.
  const OTHER_MARKETS: Record<string, string> = {
    KS: "KR", KQ: "KR", SS: "CN", SZ: "CN", HK: "HK", T: "JP", L: "UK",
  };
  const suffix = ticker.toUpperCase().match(/\.([A-Z]{1,4})$/)?.[1];
  if (suffix && OTHER_MARKETS[suffix]) {
    return jsonCached(
      {
        available: false,
        market: OTHER_MARKETS[suffix],
        source: "none",
        disclosures: [],
        reason: "No insider-disclosure source is wired for this market yet.",
      },
      3600,
      7200
    );
  }

  try {
    const trades = await getCompanyInsiderTrades(ticker, 15);
    // SEC Form 4 filings update slowly — cache 15 min.
    return jsonCached({ available: trades.length > 0, market: "US", trades }, 900, 1800);
  } catch {
    return jsonCached({ available: false, market: "US", trades: [] }, 60);
  }
}
