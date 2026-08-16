import {
  getMarketReturns,
  normaliseMarketRegion,
  normaliseWindow,
} from "@/lib/marketsOverview";
import { jsonCached } from "@/lib/httpCache";

// Sector returns over a chosen window.
//
// Separate from /api/markets because it is separately expensive: today's move
// falls out of the quote feed the overview already needs, while a one-month or
// five-year return means fetching price history for every company in the market.
// Loading all four windows on every visit would pay that cost four times over
// for the three nobody clicked.

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const region = normaliseMarketRegion(sp.get("region"));
  const window = normaliseWindow(sp.get("window"));
  try {
    const data = await getMarketReturns(region, window);
    // Half an hour at the edge. The shortest window here is a month, so a
    // fresher figure would be a different number only in the last decimal.
    return jsonCached({ ok: true, ...data }, 1800, 3600);
  } catch (err) {
    console.error("[markets/returns] failed:", err);
    return jsonCached({ ok: false, region, window, reason: "source_unavailable" }, 30, 60);
  }
}
