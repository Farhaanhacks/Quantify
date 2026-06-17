import { NextResponse } from "next/server";
import { getYahooScore } from "@/lib/yahooFundamentals";
import { companyAnalytics, stockByTicker } from "@/data/demo";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol.toUpperCase();

  // 1) Try real fundamentals from Yahoo.
  try {
    const y = await getYahooScore(symbol);
    if (y) {
      return NextResponse.json({
        available: true,
        live: true,
        analytics: y.analytics,
        price: y.price,
        name: y.name,
      });
    }
  } catch (err) {
    console.error("[score] Yahoo failed:", err);
  }

  // 2) Fall back to curated demo data if we have it.
  const demo = companyAnalytics[symbol];
  if (demo) {
    const s = stockByTicker[symbol];
    return NextResponse.json({
      available: true,
      live: false,
      analytics: demo,
      price: s?.price,
      name: s?.name,
    });
  }

  // 3) Nothing to score.
  return NextResponse.json({ available: false });
}
