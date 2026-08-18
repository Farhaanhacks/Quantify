import { getPulse } from "@/lib/marketPulse";
import { jsonCached } from "@/lib/httpCache";

// The market strip's data, as an endpoint.
//
// It exists because the strip was rendered once on the server and then never
// again: the marquee kept scrolling, so it LOOKED live, while the numbers
// underneath were whatever they had been when the page was built. On a page
// left open — which is most of them, for a research site — the quotes could be
// hours old and still labelled "live market data".
//
// 30 seconds at the edge. Long enough that a hundred readers cost one upstream
// fetch, short enough that the strip is never meaningfully behind the market.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonCached({ ok: true, ...(await getPulse()) }, 30, 60);
  } catch {
    return jsonCached({ ok: false, pulse: [], movers: [], live: false, asOf: "" }, 15, 30);
  }
}
