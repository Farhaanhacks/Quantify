import { NextResponse } from "next/server";
import { cacheHeaders } from "@/lib/httpCache";
import { aliasSymbol } from "@/lib/symbolAlias";

// Approximate historical P/E for a company, so users can see whether a stock is
// expensive or cheap RELATIVE TO ITS OWN HISTORY — not just today's snapshot.
// Yahoo doesn't serve a P/E time-series, so we build one:
//   1. pull QUARTERLY diluted EPS (fundamentals-timeseries),
//   2. roll it into a trailing-twelve-month (TTM) EPS at each quarter,
//   3. pull weekly price history, and
//   4. P/E(t) = price(t) ÷ the most recent TTM EPS as of that date.
// It's an approximation (EPS steps quarterly, prices are weekly), clearly
// labelled as such in the UI. Loss-making names, or listings where Yahoo has no
// quarterly EPS (many Indian stocks), return available:false and the UI hides.

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const num = (x: unknown): number | undefined => {
  if (typeof x === "number" && isFinite(x)) return x;
  if (x && typeof x === "object" && "raw" in x) {
    const raw = (x as { raw: unknown }).raw;
    if (typeof raw === "number" && isFinite(raw)) return raw;
  }
  return undefined;
};
const str = (x: unknown): string | undefined =>
  typeof x === "string" && x.length ? x : undefined;

// Quarterly EPS, oldest → newest. Prefers diluted, falls back to basic.
async function quarterlyEps(symbol: string): Promise<{ date: string; eps: number }[]> {
  const types = ["quarterlyDilutedEPS", "quarterlyBasicEPS"];
  const now = Math.floor(Date.now() / 1000);
  const p1 = now - 7 * 365 * 24 * 3600;
  const url = `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(
    symbol
  )}?symbol=${encodeURIComponent(symbol)}&type=${types.join(",")}&period1=${p1}&period2=${now}&merge=false`;
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    next: { revalidate: 86400 },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) return [];
  const json = (await res.json()) as { timeseries?: { result?: Record<string, unknown>[] } };
  const results = json?.timeseries?.result ?? [];
  const byType: Record<string, { date: string; eps: number }[]> = {};
  for (const r of results) {
    const type = (r.meta as { type?: string[] } | undefined)?.type?.[0];
    if (!type) continue;
    const arr = r[type] as Array<Record<string, unknown>> | undefined;
    if (!Array.isArray(arr)) continue;
    const list: { date: string; eps: number }[] = [];
    for (const pt of arr) {
      const date = str(pt?.asOfDate);
      const val = num(pt?.reportedValue);
      if (date && val != null) list.push({ date, eps: val });
    }
    byType[type] = list;
  }
  const chosen =
    (byType.quarterlyDilutedEPS?.length ? byType.quarterlyDilutedEPS : byType.quarterlyBasicEPS) ?? [];
  return chosen.sort((a, b) => a.date.localeCompare(b.date));
}

export async function GET(
  _req: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = aliasSymbol(params.symbol.toUpperCase());

  const [q, priceRes] = await Promise.all([quarterlyEps(symbol), weeklyPricesWrapped(symbol)]);
  const prices = priceRes.points;
  const currency = priceRes.currency ?? (symbol.endsWith(".NS") ? "INR" : "USD");

  // Need at least a year of quarters (4) to form one TTM point, and some prices.
  if (q.length < 4 || prices.length < 8) {
    return NextResponse.json({ available: false }, { headers: cacheHeaders(600, 1200) });
  }

  // Rolling TTM EPS at each quarter end (oldest → newest).
  const ttm: { date: string; ttm: number }[] = [];
  for (let i = 3; i < q.length; i++) {
    ttm.push({ date: q[i].date, ttm: q[i].eps + q[i - 1].eps + q[i - 2].eps + q[i - 3].eps });
  }
  if (!ttm.length) {
    return NextResponse.json({ available: false }, { headers: cacheHeaders(600, 1200) });
  }

  // Join: for each weekly price, use the most recent TTM EPS on/before that date.
  const series: { t: string; price: number; pe: number | null }[] = [];
  let k = 0;
  for (const p of prices) {
    while (k < ttm.length && ttm[k].date <= p.t) k++;
    const e = k > 0 ? ttm[k - 1] : null;
    const pe = e && e.ttm > 0 ? Number((p.v / e.ttm).toFixed(2)) : null;
    series.push({ t: p.t, price: p.v, pe });
  }

  const peVals = series.map((s) => s.pe).filter((v): v is number => v != null && v > 0 && v < 2000);
  if (peVals.length < 8) {
    // Mostly negative EPS (loss-making) or no overlap → a P/E history isn't
    // meaningful. Hide rather than show a broken chart.
    return NextResponse.json({ available: false }, { headers: cacheHeaders(600, 1200) });
  }

  const sorted = [...peVals].sort((a, b) => a - b);
  const pctl = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
  const currentPE = series[series.length - 1].pe ?? peVals[peVals.length - 1];

  // Current PEG: TTM-EPS growth year-over-year (4 quarters back) → PEG = PE / g%.
  let peg: number | null = null;
  if (ttm.length >= 5) {
    const last = ttm[ttm.length - 1].ttm;
    const yearAgo = ttm[ttm.length - 5].ttm;
    if (yearAgo > 0 && last > 0) {
      const gPct = ((last - yearAgo) / yearAgo) * 100;
      if (gPct > 0 && currentPE != null) peg = Number((currentPE / gPct).toFixed(2));
    }
  }

  return NextResponse.json(
    {
      available: true,
      currency,
      currentPE: currentPE != null ? Number(currentPE.toFixed(1)) : null,
      peg,
      pe: {
        min: Number(sorted[0].toFixed(1)),
        median: Number(pctl(0.5).toFixed(1)),
        max: Number(sorted[sorted.length - 1].toFixed(1)),
      },
      series,
    },
    { headers: cacheHeaders(3600, 7200) }
  );
}

// Small wrapper so weeklyPrices can return both points and currency cleanly.
async function weeklyPricesWrapped(
  symbol: string
): Promise<{ points: { t: string; v: number }[]; currency?: string }> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?range=5y&interval=1wk`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return { points: [] };
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result || json?.chart?.error) return { points: [] };
    const ts: number[] = result.timestamp ?? [];
    const closes: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];
    const points: { t: string; v: number }[] = [];
    for (let i = 0; i < ts.length; i++) {
      const c = closes[i];
      if (c == null || !isFinite(c) || c <= 0) continue;
      points.push({ t: new Date(ts[i] * 1000).toISOString().slice(0, 10), v: Number(c.toFixed(2)) });
    }
    return { points, currency: result.meta?.currency as string | undefined };
  } catch {
    return { points: [] };
  }
}
