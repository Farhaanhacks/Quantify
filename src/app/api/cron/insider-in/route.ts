import { NextResponse } from "next/server";
import { fetchNSEInsiderMarketWide } from "@/lib/insiderIndiaNSE";
import { fetchVendorInsiderMarketWide } from "@/lib/insiderVendor";
import { mergeStoredInsider, setIngestMeta, kvConfigured } from "@/lib/insiderStore";
import type { IndiaDisclosure } from "@/lib/insiderIndia";

// Daily ingestion of Indian insider disclosures. This runs OFF the user path
// (Vercel Cron, ~7pm IST) so it can retry the flaky exchange scrape as hard as it
// needs to. It fetches the WHOLE market's insider filings in one shot, buckets
// them by symbol, and writes to Redis — from which every user request then reads
// instantly and deterministically. Layer 1 (a paid vendor API) is tried first;
// Layer 2 (the NSE market-wide scraper) is the fallback.
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Vercel Cron requests carry no secret by default; if CRON_SECRET is set we
// require it (as a Bearer header or ?key=) so the endpoint can't be spammed.
function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization") || "";
  const key = new URL(req.url).searchParams.get("key") || "";
  return auth === `Bearer ${secret}` || key === secret;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!kvConfigured()) {
    return NextResponse.json(
      { ok: false, error: "KV (Upstash Redis) not configured. Set KV_REST_API_URL / KV_REST_API_TOKEN" },
      { status: 500 }
    );
  }

  // Layer 1: paid vendor (InsiderScreener etc.) if configured, else Layer 2: NSE.
  // The NSE market-wide feed uses SHORT windows internally (a wide window returns
  // empty), so we MERGE each run's rows into the store to accumulate history.
  let source = "vendor";
  let bySymbol: Map<string, IndiaDisclosure[]>;
  let rawCount: number;
  let status: number | null = 200;
  let wonWith: string | undefined;
  let tried: { q: string; status: number | null; rows: number }[] = [];

  const vendor = await fetchVendorInsiderMarketWide(7);
  if (vendor && vendor.bySymbol.size > 0) {
    bySymbol = vendor.bySymbol;
    rawCount = vendor.rows;
  } else {
    source = "nse-market-wide";
    const nse = await fetchNSEInsiderMarketWide(3);
    bySymbol = nse.bySymbol;
    rawCount = nse.rawCount;
    status = nse.status;
    wonWith = nse.wonWith;
    tried = nse.tried;
  }

  let symbolsWritten = 0;
  for (const [symbol, fresh] of bySymbol) {
    await mergeStoredInsider(symbol, fresh);
    symbolsWritten++;
  }

  const lastRun = new Date().toISOString();
  await setIngestMeta({ lastRun, symbols: symbolsWritten, rows: rawCount, source });

  return NextResponse.json({
    ok: true,
    source,
    upstreamStatus: status,
    wonWith,
    tried, // per-variant {window, status, rows} so we can see what NSE returns
    symbolsWritten,
    rowsParsed: rawCount,
    lastRun,
    note:
      symbolsWritten === 0
        ? "No rows ingested. status 200 with rows:0 on every variant = NSE's market-wide feed needs different params (see `tried`). status 401/null = cookie handshake failed."
        : undefined,
  });
}
