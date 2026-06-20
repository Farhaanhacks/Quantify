import { NextResponse } from "next/server";
import { stockByTicker } from "@/data/demo";
import { getStooqSeries } from "@/lib/stooq";

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
        const prevRaw = meta.chartPreviousClose ?? meta.previousClose;
        const prev =
          typeof prevRaw === "number" && isFinite(prevRaw) && prevRaw > 0 ? prevRaw : price;
        const changePct = prev ? Number((((price - prev) / prev) * 100).toFixed(2)) : 0;
        return NextResponse.json({
          valid: true,
          price: Number(price.toFixed(2)),
          prevClose: Number(prev.toFixed(2)),
          changePct,
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

  // Fallback 1: Stooq (free EOD) — last close as the price.
  try {
    const stooq = await getStooqSeries(symbol);
    if (stooq && stooq.length) {
      const last = stooq[stooq.length - 1].value;
      const prev = stooq.length >= 2 ? stooq[stooq.length - 2].value : last;
      const changePct = prev ? Number((((last - prev) / prev) * 100).toFixed(2)) : 0;
      return NextResponse.json({
        valid: true,
        price: last,
        prevClose: prev,
        changePct,
        currency: symbol.endsWith(".NS") ? "INR" : "USD",
        name: symbol,
        source: "stooq",
      });
    }
  } catch (err) {
    console.error("[quote] Stooq failed:", err);
  }

  // Fallback 2: demo names are always considered valid.
  const demo = stockByTicker[symbol];
  if (demo) {
    return NextResponse.json({
      valid: true,
      price: demo.price,
      prevClose: Number((demo.price / (1 + demo.changePct / 100)).toFixed(2)),
      changePct: demo.changePct,
      currency: "USD",
      name: demo.name,
    });
  }

  return NextResponse.json({ valid: false });
}
