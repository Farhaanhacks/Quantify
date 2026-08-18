import { NextResponse } from "next/server";
import { fetchTaiwanInsiderMarketWide } from "@/lib/taiwan/insiderFetch";
import {
  setStoredTaiwanInsider,
  setTaiwanIngestMeta,
  setTaiwanRoster,
  kvConfigured,
  type TaiwanIngestMeta,
} from "@/lib/taiwan/insiderStore";

// Scheduled ingestion of the Taiwan insider datasets.
//
// Six market-wide files, three from TWSE and three from TPEx, downloaded,
// parsed and written per company. Runs off the user path, so a stock page reads
// one Redis key instead of downloading every listed company's filings to
// display one company's.
//
// Exchanges publish these once a day; the schedule in vercel.json runs a little
// after that, and again later in case the first run met a bad moment.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization") || "";
  const key = new URL(req.url).searchParams.get("key") || "";
  return auth === `Bearer ${secret}` || key === secret;
}

/** Write with a few in flight. ~1,800 companies over one REST round trip each. */
async function writeAll(
  entries: [string, Parameters<typeof setStoredTaiwanInsider>[1]][],
  limit = 8
): Promise<number> {
  let next = 0;
  let written = 0;
  const workers = Array.from({ length: Math.min(limit, entries.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= entries.length) return;
      const [companyId, records] = entries[i];
      if (await setStoredTaiwanInsider(companyId, records)) written++;
    }
  });
  await Promise.all(workers);
  return written;
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!kvConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "KV (Upstash Redis) not configured. Set KV_REST_API_URL / KV_REST_API_TOKEN",
      },
      { status: 500 }
    );
  }

  const started = Date.now();
  const result = await fetchTaiwanInsiderMarketWide();

  const datasets = result.outcomes.map((o) => ({
    dataset: o.dataset,
    ok: o.ok,
    rowsIn: o.rowsIn,
    httpStatus: o.httpStatus,
    error: o.error,
    // The payload's own column names, recorded on every run. A renamed column
    // is then a diff between two runs' metadata rather than an investigation.
    seenColumns: o.seenColumns?.slice(0, 40),
  }));

  // A run where nothing answered must not touch the store. Overwriting good
  // data with an empty result is how a source outage turns into every company
  // in Taiwan appearing to have filed nothing.
  if (!result.any) {
    const meta: TaiwanIngestMeta = {
      lastRun: new Date().toISOString(),
      companies: 0,
      records: 0,
      datasets,
    };
    await setTaiwanIngestMeta(meta);
    return NextResponse.json(
      { ok: false, error: "no dataset answered", elapsedMs: Date.now() - started, datasets },
      { status: 502 }
    );
  }

  const entries = [...result.byCompany.entries()];
  const written = await writeAll(entries);

  // The roster is what licenses "this company filed nothing", so it is only
  // rewritten for a market whose datasets ALL answered. Per market, because one
  // exchange failing says nothing about the other: with a single flag, TWSE's
  // three files could ingest 27,528 rows and still leave every TWSE company
  // reporting "source unavailable" because TPEx was down.
  const now = new Date().toISOString();
  const lastCompleteByMarket: Record<string, string> = {};
  for (const market of ["TWSE", "TPEx"] as const) {
    if (!result.completeByMarket[market]) continue;
    const ids = result.outcomes
      .filter((o) => o.market === market)
      .flatMap((o) => o.records.map((r) => r.companyId));
    await setTaiwanRoster(market, [...new Set(ids)]);
    lastCompleteByMarket[market] = now;
  }

  const meta: TaiwanIngestMeta = {
    lastRun: new Date().toISOString(),
    lastCompleteRun: result.complete ? now : undefined,
    lastCompleteByMarket,
    companies: entries.length,
    records: result.totalRecords,
    datasets,
  };
  await setTaiwanIngestMeta(meta);

  return NextResponse.json({
    ok: true,
    complete: result.complete,
    completeByMarket: result.completeByMarket,
    companies: entries.length,
    written,
    records: result.totalRecords,
    elapsedMs: Date.now() - started,
    datasets,
  });
}
