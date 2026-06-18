import { NextResponse } from "next/server";
import { stockByTicker } from "@/data/demo";
import { getStooqSeries, type StooqPoint } from "@/lib/stooq";

// Personal-use price history. Pulls daily closes from Yahoo Finance's (unofficial)
// chart endpoint and falls back to synthesized demo data if Yahoo is unavailable,
// so the chart always renders. Intended for a personal, non-commercial app.

interface Point {
  time: string; // YYYY-MM-DD
  value: number;
}

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h || 1;
}

// Deterministic synthetic series so the demo chart is stable across reloads.
function demoSeries(symbol: string) {
  const known = stockByTicker[symbol.toUpperCase()];
  const target = known?.price ?? 40 + (hashSeed(symbol) % 260);
  let seed = hashSeed(symbol);
  const rand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  let v = target * 0.8;
  const points: Point[] = [];
  const today = new Date();
  for (let i = 250; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dow = d.getDay();
    if (dow === 0 || dow === 6) continue; // weekdays only
    v = Math.max(1, v * (1 + (rand() - 0.48) * 0.03));
    points.push({ time: d.toISOString().slice(0, 10), value: Number(v.toFixed(2)) });
  }
  const last = points[points.length - 1]?.value ?? target;
  const prev = points[points.length - 2]?.value ?? last;
  return {
    symbol,
    points,
    meta: {
      price: last,
      change: Number((last - prev).toFixed(2)),
      changePct: prev ? Number((((last - prev) / prev) * 100).toFixed(2)) : 0,
      currency: symbol.toUpperCase().endsWith(".NS") ? "INR" : "USD",
    },
    live: false,
  };
}

async function yahooSeries(symbol: string, range: string) {
  const interval = range === "max" || range === "10y" ? "1wk" : "1d";
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=${encodeURIComponent(range)}&interval=${interval}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Yahoo responded ${res.status}`);
  const json = await res.json();
  const result = json?.chart?.result?.[0];
  if (!result || json?.chart?.error) throw new Error("Yahoo: no data");

  const ts: number[] = result.timestamp ?? [];
  const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
  const points: Point[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null) continue;
    points.push({
      time: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      value: Number(c.toFixed(2)),
    });
  }
  if (points.length === 0) throw new Error("Yahoo: empty series");

  const m = result.meta ?? {};
  const price = m.regularMarketPrice ?? points[points.length - 1].value;
  const prev = m.chartPreviousClose ?? m.previousClose ?? points[points.length - 2]?.value ?? price;
  return {
    symbol,
    points,
    meta: {
      price: Number(price.toFixed(2)),
      change: Number((price - prev).toFixed(2)),
      changePct: prev ? Number((((price - prev) / prev) * 100).toFixed(2)) : 0,
      currency: m.currency ?? (symbol.toUpperCase().endsWith(".NS") ? "INR" : "USD"),
    },
    live: true,
  };
}

const RANGE_COUNT: Record<string, number> = {
  "1mo": 22,
  "6mo": 126,
  "1y": 252,
  "5y": 1260,
  max: 100000,
};

function fromStooq(symbol: string, points: StooqPoint[], range: string) {
  const n = RANGE_COUNT[range] ?? 252;
  const sliced = points.slice(-n);
  const last = sliced[sliced.length - 1]?.value ?? 0;
  const prev = sliced[sliced.length - 2]?.value ?? last;
  return {
    symbol,
    points: sliced,
    meta: {
      price: last,
      change: Number((last - prev).toFixed(2)),
      changePct: prev ? Number((((last - prev) / prev) * 100).toFixed(2)) : 0,
      currency: symbol.toUpperCase().endsWith(".NS") ? "INR" : "USD",
    },
    live: true,
    source: "stooq",
  };
}

export async function GET(
  req: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol;
  const allowed = ["1mo", "6mo", "1y", "5y", "max"];
  const reqRange = new URL(req.url).searchParams.get("range") ?? "1y";
  const range = allowed.includes(reqRange) ? reqRange : "1y";

  // 1) Yahoo (broadest coverage)
  try {
    return NextResponse.json(await yahooSeries(symbol, range));
  } catch (err) {
    console.error("[timeseries] Yahoo failed:", err);
  }

  // 2) Stooq fallback (free EOD)
  try {
    const stooq = await getStooqSeries(symbol);
    if (stooq) return NextResponse.json(fromStooq(symbol, stooq, range));
  } catch (err) {
    console.error("[timeseries] Stooq failed:", err);
  }

  // 3) Demo so the chart never breaks
  return NextResponse.json(demoSeries(symbol));
}
