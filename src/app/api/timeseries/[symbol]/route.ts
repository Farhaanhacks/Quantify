import { NextResponse } from "next/server";
import { getStooqSeries, type StooqPoint } from "@/lib/stooq";
import { cacheHeaders } from "@/lib/httpCache";
import { aliasSymbol } from "@/lib/symbolAlias";

// Personal-use price history. Pulls daily closes from Yahoo Finance's (unofficial)
// chart endpoint, falling back to Stooq. Returns real data only — when neither
// source has the series we return an empty, not-available result rather than a
// synthesized chart.

interface Point {
  time: string; // YYYY-MM-DD
  value: number;
}

// Yahoo's long-range history occasionally has a single bad tick — e.g. Tata Steel
// showing a lone ₹645 spike in 2006 that blows the y-axis to 800 and flattens the
// real prices to a near-zero line. Drop points that spike far from BOTH neighbours
// and revert immediately: a genuine move (or a split step) keeps at least one
// neighbour close, so this removes only true single-point anomalies, never trends.
function dropSpikes(pts: Point[]): Point[] {
  if (pts.length < 3) return pts;
  const out: Point[] = [];
  for (let i = 0; i < pts.length; i++) {
    const v = pts[i].value;
    const prev = pts[i - 1]?.value;
    const next = pts[i + 1]?.value;
    if (prev != null && next != null && prev > 0 && next > 0) {
      const rPrev = v / prev;
      const rNext = v / next;
      if ((rPrev > 4 && rNext > 4) || (rPrev < 0.25 && rNext < 0.25)) continue;
    }
    out.push(pts[i]);
  }
  return out;
}

async function yahooSeries(symbol: string, range: string) {
  // Intraday for 1D, weekly for the very long ranges, daily otherwise.
  const interval =
    range === "1d" ? "5m" : range === "max" || range === "10y" ? "1wk" : "1d";
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
  const raw: Point[] = [];
  for (let i = 0; i < ts.length; i++) {
    const c = closes[i];
    if (c == null || !isFinite(c) || c <= 0) continue;
    raw.push({
      time: new Date(ts[i] * 1000).toISOString().slice(0, 10),
      value: Number(c.toFixed(2)),
    });
  }
  const points = dropSpikes(raw);
  if (points.length === 0) throw new Error("Yahoo: empty series");

  const m = result.meta ?? {};
  const price = m.regularMarketPrice ?? points[points.length - 1].value;
  // Use Yahoo's OWN previous close (yesterday's session) for the day change.
  // chartPreviousClose is the close at the START of the requested range window,
  // so on a 1y/5y range it turns the whole-period return into a bogus "today"
  // figure — the price badge now reads /api/quote instead, but keep this correct
  // for any other consumer of this meta.
  const prev =
    m.previousClose ?? m.regularMarketPreviousClose ?? m.chartPreviousClose ?? price;
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
  "1d": 2, // Stooq is EOD-only, so 1D can't be intraday on the fallback path
  "1mo": 22,
  "3mo": 66,
  "6mo": 126,
  ytd: 180,
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
  const symbol = aliasSymbol(params.symbol);
  const allowed = ["1d", "3mo", "6mo", "ytd", "1y", "5y", "max", "1mo"];
  const reqRange = new URL(req.url).searchParams.get("range") ?? "1y";
  const range = allowed.includes(reqRange) ? reqRange : "1y";

  // Chart data is cached at the edge for 5 min so repeat views and range
  // switches don't re-run the function.
  const ok = cacheHeaders(300, 900);

  // 1) Yahoo (broadest coverage)
  try {
    return NextResponse.json(await yahooSeries(symbol, range), { headers: ok });
  } catch (err) {
    console.error("[timeseries] Yahoo failed:", err);
  }

  // 2) Stooq fallback (free EOD)
  try {
    const stooq = await getStooqSeries(symbol);
    if (stooq) return NextResponse.json(fromStooq(symbol, stooq, range), { headers: ok });
  } catch (err) {
    console.error("[timeseries] Stooq failed:", err);
  }

  // 3) No live source had the series — return an honest not-available result
  //    (empty points) rather than a synthesized chart. Cache briefly only.
  return NextResponse.json(
    {
      symbol,
      points: [],
      meta: {
        price: 0,
        change: 0,
        changePct: 0,
        currency: symbol.toUpperCase().endsWith(".NS") ? "INR" : "USD",
      },
      live: false,
      available: false,
    },
    { headers: cacheHeaders(60, 120) }
  );
}
