import { getYahooEtf } from "@/lib/yahooEtf";
import { jsonCached } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

// ETF / fund analysis. Returns { available:false } for anything that isn't a
// fund (e.g. an ordinary stock) so the caller can fall back to the company
// Quantifi Score instead.
export async function GET(
  _req: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const etf = await getYahooEtf(params.symbol);
    if (!etf) return jsonCached({ available: false }, 300);
    return jsonCached({ available: true, etf }, 600, 1800);
  } catch (err) {
    console.error("[etf] failed:", err);
    return jsonCached({ available: false }, 60);
  }
}
