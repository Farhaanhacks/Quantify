import { NextResponse } from "next/server";
import { stockByTicker } from "@/data/demo";
import { getStooqSeries } from "@/lib/stooq";
import { yahooQuotes } from "@/lib/yahooCrumb";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Validates a ticker against Yahoo and returns its current price + today's move.
// Used to stop junk tickers being added to a portfolio and to track real value,
// gain and daily change.
export async function GET(
  _req: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol.toUpperCase();

  // 1) Authoritative quote — Yahoo's OWN regularMarketChangePercent and previous
  // close, the exact day-change a broker shows. We use this first so "today's
  // move" can never drift the way a recomputed figure does.
  try {
    const q = (await yahooQuotes([symbol])).get(symbol);
    if (q && typeof q.price === "number" && isFinite(q.price)) {
      const prev =
        typeof q.previousClose === "number" && q.previousClose > 0
          ? q.previousClose
          : q.price;
      const changePct =
        typeof q.changePercent === "number"
          ? Number(q.changePercent.toFixed(2))
          : prev
          ? Number((((q.price - prev) / prev) * 100).toFixed(2))
          : 0;
      return NextResponse.json({
        valid: true,
        price: Number(q.price.toFixed(2)),
        prevClose: Number(prev.toFixed(2)),
        changePct,
        currency: q.currency || (symbol.endsWith(".NS") ? "INR" : "USD"),
        name: q.name || symbol,
      });
    }
  } catch (err) {
    console.error("[quote] authoritative quote failed:", err);
  }

  try {
    // range=1d so chartPreviousClose is YESTERDAY's close (the true prior
    // session). A wider range made it the close days earlier, which turned a
    // week's move into a bogus one-day change.
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=1d&interval=1d`;
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
        // Prefer the official previous close over chartPreviousClose (which is
        // split/dividend-adjusted and can skew the day change).
        const prevRaw = meta.previousClose ?? meta.chartPreviousClose;
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
