import { getMarketsOverview, normaliseMarketRegion } from "@/lib/marketsOverview";
import { jsonCached } from "@/lib/httpCache";

// The whole-market view for one region, aggregated from company quotes.
//
// Region is a query parameter rather than a path segment because it is a filter
// on one resource, not a different resource — and because it is validated
// against a fixed list either way, so nothing arbitrary reaches the upstream.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const region = normaliseMarketRegion(new URL(req.url).searchParams.get("region"));
  try {
    const data = await getMarketsOverview(region);
    // Five minutes at the edge, matching the underlying quote cache: a market
    // overview that re-fans-out over several hundred symbols per visitor would
    // be a lot of upstream traffic for numbers that move a fraction of a percent
    // in that time.
    return jsonCached({ ok: true, ...data }, 300, 900);
  } catch (err) {
    console.error("[markets] failed:", err);
    return jsonCached(
      { ok: false, region, reason: "source_unavailable" },
      30,
      60
    );
  }
}
