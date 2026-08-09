import { NextResponse } from "next/server";
import { cacheHeaders } from "@/lib/httpCache";
import { aliasSymbol } from "@/lib/symbolAlias";
import { yahooQuoteSummary } from "@/lib/yahooCrumb";
import { currencyForTicker } from "@/data/demo";

// Approximate historical P/E for a company, so users can see whether a stock is
// expensive or cheap RELATIVE TO ITS OWN HISTORY — not just today's snapshot.
// Yahoo doesn't serve a P/E time-series, so we build one:
//   1. pull ANNUAL + QUARTERLY EPS (fundamentals-timeseries),
//   2. build a trailing-twelve-month (TTM) EPS step-series — quarterly rolling
//      sums where available (recent), annual EPS to extend coverage backwards,
//   3. pull weekly price history, and
//   4. P/E(t) = price(t) ÷ the most recent TTM EPS as of that date.
//
// Crucially we then ANCHOR the whole series to Yahoo's authoritative current
// trailing P/E (summaryDetail.trailingPE). Yahoo reports EPS for many listings —
// notably Indian .NS names — in a different currency/unit than the local price,
// which otherwise inflates P/E by the FX rate (Infosys read ~1477× instead of
// ~23×). A single multiplicative rescale to the known-good current P/E fixes the
// level for the entire history while preserving its real shape.

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

type EpsPt = { date: string; eps: number };

// Pull EPS series (annual + quarterly, diluted preferred, basic fallback) in one
// fundamentals-timeseries call. Returns each series oldest → newest.
async function epsSeries(symbol: string): Promise<{ annual: EpsPt[]; quarterly: EpsPt[] }> {
  const types = [
    "annualDilutedEPS",
    "annualBasicEPS",
    "quarterlyDilutedEPS",
    "quarterlyBasicEPS",
  ];
  const now = Math.floor(Date.now() / 1000);
  const p1 = now - 8 * 365 * 24 * 3600;
  const url = `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(
    symbol
  )}?symbol=${encodeURIComponent(symbol)}&type=${types.join(",")}&period1=${p1}&period2=${now}&merge=false`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return { annual: [], quarterly: [] };
    const json = (await res.json()) as { timeseries?: { result?: Record<string, unknown>[] } };
    const results = json?.timeseries?.result ?? [];
    const byType: Record<string, EpsPt[]> = {};
    for (const r of results) {
      const type = (r.meta as { type?: string[] } | undefined)?.type?.[0];
      if (!type) continue;
      const arr = r[type] as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(arr)) continue;
      const list: EpsPt[] = [];
      for (const pt of arr) {
        const date = str(pt?.asOfDate);
        const val = num(pt?.reportedValue);
        if (date && val != null) list.push({ date, eps: val });
      }
      byType[type] = list.sort((a, b) => a.date.localeCompare(b.date));
    }
    return {
      annual: (byType.annualDilutedEPS?.length ? byType.annualDilutedEPS : byType.annualBasicEPS) ?? [],
      quarterly:
        (byType.quarterlyDilutedEPS?.length ? byType.quarterlyDilutedEPS : byType.quarterlyBasicEPS) ?? [],
    };
  } catch {
    return { annual: [], quarterly: [] };
  }
}

// Weekly closes over ~5y, oldest → newest, plus the price currency.
async function weeklyPrices(
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

// Authoritative current trailing P/E (correct currency/units) for anchoring.
async function authoritativePE(symbol: string): Promise<number | undefined> {
  try {
    const r = await yahooQuoteSummary(symbol, "summaryDetail,defaultKeyStatistics", 3600);
    if (!r) return undefined;
    const sd = (r.summaryDetail ?? {}) as Record<string, unknown>;
    const ks = (r.defaultKeyStatistics ?? {}) as Record<string, unknown>;
    const pe = num(sd.trailingPE) ?? num(ks.trailingPE);
    return pe != null && pe > 0 ? pe : undefined;
  } catch {
    return undefined;
  }
}

export async function GET(
  _req: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = aliasSymbol(params.symbol.toUpperCase());

  const [{ annual, quarterly }, priceRes, authPE] = await Promise.all([
    epsSeries(symbol),
    weeklyPrices(symbol),
    authoritativePE(symbol),
  ]);
  const prices = priceRes.points;
  const currency = priceRes.currency ?? (currencyForTicker(symbol) ?? "USD");

  if (prices.length < 8) {
    return NextResponse.json({ available: false }, { headers: cacheHeaders(600, 1200) });
  }

  // Build a combined TTM-EPS step series (oldest → newest):
  //   • quarterly rolling 4-quarter sums (recent, granular), and
  //   • annual EPS as TTM checkpoints (each fiscal-year EPS is already a TTM
  //     figure) to extend coverage back across the full price window.
  // De-dupe by date, quarterly winning when both exist on the same date.
  const ttmMap = new Map<string, number>();
  for (const a of annual) ttmMap.set(a.date, a.eps);
  for (let i = 3; i < quarterly.length; i++) {
    const s = quarterly[i].eps + quarterly[i - 1].eps + quarterly[i - 2].eps + quarterly[i - 3].eps;
    ttmMap.set(quarterly[i].date, s);
  }
  const ttm = Array.from(ttmMap.entries())
    .map(([date, v]) => ({ date, ttm: v }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (ttm.length < 2) {
    return NextResponse.json({ available: false }, { headers: cacheHeaders(600, 1200) });
  }

  // Join: for each weekly price, use the most recent TTM EPS on/before that date.
  const raw: { t: string; price: number; pe: number | null }[] = [];
  let k = 0;
  for (const p of prices) {
    while (k < ttm.length && ttm[k].date <= p.t) k++;
    const e = k > 0 ? ttm[k - 1] : null;
    const pe = e && e.ttm > 0 ? p.v / e.ttm : null;
    raw.push({ t: p.t, price: p.v, pe });
  }

  // Latest computed P/E (last non-null), used to anchor the whole series to the
  // authoritative current P/E — this corrects any constant currency/unit factor.
  const lastComputed = [...raw].reverse().find((r) => r.pe != null && r.pe > 0)?.pe;
  let scale = 1;
  if (authPE != null && lastComputed != null && lastComputed > 0) {
    const s = authPE / lastComputed;
    // Only rescale for a real, sane factor (guards against a broken authPE).
    if (isFinite(s) && s > 0.001 && s < 1000) scale = s;
  }

  const series = raw.map((r) => ({
    t: r.t,
    price: r.price,
    pe: r.pe != null && r.pe > 0 ? Number((r.pe * scale).toFixed(2)) : null,
  }));

  const peVals = series
    .map((s) => s.pe)
    .filter((v): v is number => v != null && v > 0 && v < 5000);
  if (peVals.length < 8) {
    return NextResponse.json({ available: false }, { headers: cacheHeaders(600, 1200) });
  }

  // If we had NO authoritative P/E to anchor to and the level still looks
  // implausible (a currency artefact we couldn't correct), suppress rather than
  // publish a misleading chart.
  const sortedGuard = [...peVals].sort((a, b) => a - b);
  const medianGuard = sortedGuard[Math.floor(sortedGuard.length / 2)];
  if (scale === 1 && authPE == null && medianGuard > 150) {
    return NextResponse.json({ available: false }, { headers: cacheHeaders(600, 1200) });
  }

  const sorted = sortedGuard;
  const currentPE = authPE ?? series[series.length - 1].pe ?? peVals[peVals.length - 1];

  // Current PEG from YoY TTM-EPS growth (4 quarters back), if we have quarters.
  let peg: number | null = null;
  if (quarterly.length >= 8) {
    const qttm = (i: number) =>
      quarterly[i].eps + quarterly[i - 1].eps + quarterly[i - 2].eps + quarterly[i - 3].eps;
    const last = qttm(quarterly.length - 1);
    const yearAgo = qttm(quarterly.length - 5);
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
        median: Number(sorted[Math.floor(sorted.length / 2)].toFixed(1)),
        max: Number(sorted[sorted.length - 1].toFixed(1)),
      },
      series,
    },
    { headers: cacheHeaders(3600, 7200) }
  );
}
