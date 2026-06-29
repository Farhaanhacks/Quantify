import { NextResponse } from "next/server";
import { getYahooEtf } from "@/lib/yahooEtf";

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
    if (!etf) return NextResponse.json({ available: false });
    return NextResponse.json({ available: true, etf });
  } catch (err) {
    console.error("[etf] failed:", err);
    return NextResponse.json({ available: false });
  }
}
