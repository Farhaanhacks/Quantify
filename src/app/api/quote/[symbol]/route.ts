import { NextResponse } from "next/server";
import { stockByTicker } from "@/data/demo";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Validates a ticker against Yahoo and returns its current price. Used to stop
// junk tickers being added to a portfolio and to track real value/gain.
export async function GET(
  _req: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol.toUpperCase();

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=5d&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 120 },
    });
    if (res.ok) {
      const json = (await res.json()) as {
        chart?: { result?: { meta?: Record<string, unknown> }[]; error?: unknown };
      };
      const meta = json?.chart?.result?.[0]?.meta;
      const price = meta?.regularMarketPrice;
      if (meta && typeof price === "number" && isFinite(price)) {
        return NextResponse.json({
          valid: true,
          price: Number(price.toFixed(2)),
          currency:
            (typeof meta.currency === "string" && meta.currency) ||
            (symbol.endsWith(".NS") ? "INR" : "USD"),
          name:
            (typeof meta.shortName === "string" && meta.shortName) ||
            (typeof meta.longName === "string" && meta.longName) ||
            symbol,
        });
      }
    }
  } catch (err) {
    console.error("[quote] Yahoo failed:", err);
  }

  // Fallback: demo names are always considered valid.
  const demo = stockByTicker[symbol];
  if (demo) {
    return NextResponse.json({
      valid: true,
      price: demo.price,
      currency: "USD",
      name: demo.name,
    });
  }

  return NextResponse.json({ valid: false });
}
