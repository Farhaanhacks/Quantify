import { yahooQuotes, yahooSparks } from "@/lib/yahooCrumb";
import { universeFor, regionLabel, REGION_KEYS } from "@/data/heatmapUniverse";
import { aggregatePE, weightedMean, yearChangePct, seriesReturnPct } from "@/lib/marketMath";

// A whole market, aggregated from the companies in it.
//
// Every figure here is built the way an index is built: bottom-up from real
// company quotes, weighted by market value. Nothing is a headline number copied
// from somewhere else, and nothing is modelled — the market's P/E is the sum of
// its companies' values over the sum of their earnings, its return is its
// companies' returns weighted by size, and a sector's numbers are the same
// arithmetic over the companies in that sector.
//
// The consequence worth stating plainly: this describes the CURATED universe in
// data/heatmapUniverse — a few hundred of the largest listings per market — not
// every listed company. That is what makes it computable from one batched
// request, and the company count is reported alongside every figure so the
// reader knows the base rather than assuming it covers the whole exchange.
//
// A company with no live quote contributes nothing rather than being estimated,
// which is the same rule the heatmap follows.

export interface SectorRow {
  sector: string;
  companies: number;
  /** Share of the universe's market value, 0–1. */
  weight: number;
  /** Cap-weighted move today, %. */
  day: number;
  /** Aggregate P/E: Σ market cap ÷ Σ earnings. */
  pe?: number;
}

export interface MoverRow {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  day: number;
  year?: number;
  pe?: number;
  sector: string;
  marketCap: number;
}

export interface MarketsOverview {
  region: string;
  regionLabel: string;
  /** "Indian", "US", "Japanese" — for the page title. */
  demonym: string;
  /** The market's headline index, for the price chart. */
  indexSymbol: string;
  indexLabel: string;
  currency: string;
  /** How many companies actually carried a live quote. */
  companies: number;
  totalMarketCap: number;
  /** Cap-weighted move today, %, across the whole universe. */
  day: number;
  year?: number;
  pe?: number;
  sectors: SectorRow[];
  gainers: MoverRow[];
  losers: MoverRow[];
  asOf: string;
  /** False when nothing could be fetched, so the page can say so. */
  live: boolean;
}

const INDEX: Record<string, { symbol: string; label: string; demonym: string }> = {
  us: { symbol: "^GSPC", label: "S&P 500", demonym: "US" },
  in: { symbol: "^NSEI", label: "NIFTY 50", demonym: "Indian" },
  uk: { symbol: "^FTSE", label: "FTSE 100", demonym: "UK" },
  ca: { symbol: "^GSPTSE", label: "S&P/TSX", demonym: "Canadian" },
  au: { symbol: "^AXJO", label: "ASX 200", demonym: "Australian" },
  jp: { symbol: "^N225", label: "Nikkei 225", demonym: "Japanese" },
  de: { symbol: "^GDAXI", label: "DAX", demonym: "German" },
  fr: { symbol: "^FCHI", label: "CAC 40", demonym: "French" },
  hk: { symbol: "^HSI", label: "Hang Seng", demonym: "Hong Kong" },
};

const CHUNK = 50;
/** Below this a sector's numbers describe two companies, not a sector. */
const MIN_SECTOR_COMPANIES = 2;

export function normaliseMarketRegion(raw: string | null | undefined): string {
  const k = (raw ?? "").toLowerCase().trim();
  return REGION_KEYS.includes(k) ? k : "in";
}

// ── Sector returns over a chosen window ─────────────────────────────────────
//
// Today's move rides along on the quote feed. Every longer window needs actual
// price history for every company in the market, which the quote feed does not
// carry — so these come from Yahoo's batched "spark" series instead, one call
// per chunk of symbols rather than one call per company.
//
// The interval is chosen to keep each series a sensible length: daily bars for a
// month, weekly beyond that, monthly over five years. A five-year daily series
// for four hundred companies is a megabyte of JSON to answer a question about
// nine sectors.

export const RETURN_WINDOWS: Record<string, { range: string; interval: string; label: string }> = {
  "1mo": { range: "1mo", interval: "1d", label: "1 Month" },
  "6mo": { range: "6mo", interval: "1wk", label: "6 Months" },
  "1y": { range: "1y", interval: "1wk", label: "1 Year" },
  "5y": { range: "5y", interval: "1mo", label: "5 Years" },
};

export function normaliseWindow(raw: string | null | undefined): string {
  const k = (raw ?? "").toLowerCase().trim();
  return k in RETURN_WINDOWS ? k : "1y";
}

export interface SectorReturn {
  sector: string;
  companies: number;
  /** Cap-weighted return over the window, %. */
  change: number;
}

export interface MarketReturns {
  region: string;
  window: string;
  windowLabel: string;
  sectors: SectorReturn[];
  /** Cap-weighted return for the whole universe over the window, %. */
  market?: number;
  /** How many companies had a usable series. Zero means "say so", not "flat". */
  companies: number;
}

export async function getMarketReturns(
  regionKey: string,
  windowKey: string
): Promise<MarketReturns> {
  const region = normaliseMarketRegion(regionKey);
  const win = normaliseWindow(windowKey);
  const { range, interval, label } = RETURN_WINDOWS[win];
  const universe = universeFor(region);
  const sectorOf = new Map(universe.map((u) => [u.symbol.toUpperCase(), u.sector]));
  const symbols = universe.map((u) => u.symbol);

  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += CHUNK) chunks.push(symbols.slice(i, i + CHUNK));

  // Caps come from the quote feed, which the overview has already warmed for
  // this region — weighting by size is the whole point, and an unweighted mean
  // would let the smallest listing in a sector count as much as its largest.
  const [quoteMaps, sparkMaps] = await Promise.all([
    Promise.all(chunks.map((c) => yahooQuotes(c, 300).catch(() => new Map()))),
    // An hour: a one-month return does not move meaningfully within one, and
    // this is the expensive half of the request.
    Promise.all(chunks.map((c) => yahooSparks(c, range, interval, 3600).catch(() => new Map()))),
  ]);

  const caps = new Map<string, number>();
  for (const m of quoteMaps) {
    for (const [, q] of m) {
      const s = q.symbol?.toUpperCase();
      if (s && typeof q.marketCap === "number" && q.marketCap > 0) caps.set(s, q.marketCap);
    }
  }

  const rows: { sector: string; change: number; cap: number }[] = [];
  for (const m of sparkMaps) {
    for (const [symbol, closes] of m) {
      const sector = sectorOf.get(symbol);
      const cap = caps.get(symbol);
      const change = seriesReturnPct(closes);
      if (!sector || cap == null || change == null) continue;
      rows.push({ sector, change, cap });
    }
  }

  const bySector = new Map<string, { sector: string; change: number; cap: number }[]>();
  for (const r of rows) {
    const list = bySector.get(r.sector);
    if (list) list.push(r);
    else bySector.set(r.sector, [r]);
  }

  const sectors: SectorReturn[] = [...bySector.entries()]
    .filter(([, list]) => list.length >= MIN_SECTOR_COMPANIES)
    .map(([sector, list]) => ({
      sector,
      companies: list.length,
      change: weightedMean(list, (r) => r.change, (r) => r.cap).value ?? 0,
    }))
    .sort((a, b) => b.change - a.change);

  return {
    region,
    window: win,
    windowLabel: label,
    sectors,
    market: weightedMean(rows, (r) => r.change, (r) => r.cap).value,
    companies: rows.length,
  };
}

export async function getMarketsOverview(regionKey = "in"): Promise<MarketsOverview> {
  const region = normaliseMarketRegion(regionKey);
  const idx = INDEX[region] ?? INDEX.in;
  const universe = universeFor(region);
  const sectorOf = new Map(universe.map((u) => [u.symbol.toUpperCase(), u.sector]));

  const asOf = new Date().toISOString();

  const chunks: string[][] = [];
  const symbols = universe.map((u) => u.symbol);
  for (let i = 0; i < symbols.length; i += CHUNK) chunks.push(symbols.slice(i, i + CHUNK));
  const results = await Promise.all(
    // Five minutes, the same as the heatmap: this is a picture of the market
    // today, not a ticker, and it fans out over several hundred symbols.
    chunks.map((c) => yahooQuotes(c, 300).catch(() => new Map()))
  );

  const rows: MoverRow[] = [];
  for (const map of results) {
    for (const [, q] of map) {
      const symbol = q.symbol?.toUpperCase();
      if (!symbol) continue;
      const sector = sectorOf.get(symbol);
      // No sector or no size means no weight, and an unweighted company would
      // silently count the same as the largest one in the market.
      if (!sector || typeof q.marketCap !== "number" || !(q.marketCap > 0)) continue;
      const day = q.changePercent;
      if (day == null || !isFinite(day)) continue;
      rows.push({
        symbol,
        name: q.name || symbol,
        price: typeof q.price === "number" ? q.price : 0,
        currency: q.currency || "USD",
        day,
        year: yearChangePct(q),
        pe: q.trailingPE,
        sector,
        marketCap: q.marketCap,
      });
    }
  }

  const bySector = new Map<string, MoverRow[]>();
  for (const r of rows) {
    const list = bySector.get(r.sector);
    if (list) list.push(r);
    else bySector.set(r.sector, [r]);
  }

  const totalMarketCap = rows.reduce((s, r) => s + r.marketCap, 0);
  const sectors: SectorRow[] = [...bySector.entries()]
    .filter(([, list]) => list.length >= MIN_SECTOR_COMPANIES)
    .map(([sector, list]) => {
      const cap = list.reduce((s, r) => s + r.marketCap, 0);
      return {
        sector,
        companies: list.length,
        weight: totalMarketCap > 0 ? cap / totalMarketCap : 0,
        day: weightedMean(list, (r) => r.day, (r) => r.marketCap).value ?? 0,
        // No 52-week figure here: every window longer than a day is served by
        // getMarketReturns from real price history, and two "1 year" numbers
        // derived two ways is exactly the sort of quiet disagreement a reader
        // has no way to resolve.
        pe: aggregatePE(list),
      };
    })
    .sort((a, b) => b.day - a.day);

  // Movers are ranked among companies big enough to matter to the index. Without
  // a floor the list is whichever micro-cap in the universe moved most, which is
  // never the answer to "what drove the market".
  const capFloor = totalMarketCap * 0.0015;
  const eligible = rows.filter((r) => r.marketCap >= capFloor);
  const ranked = [...eligible].sort((a, b) => b.day - a.day);

  const marketYear = weightedMean(rows, (r) => r.year, (r) => r.marketCap);

  return {
    region,
    regionLabel: regionLabel(region),
    demonym: idx.demonym,
    indexSymbol: idx.symbol,
    indexLabel: idx.label,
    currency: rows[0]?.currency ?? "USD",
    companies: rows.length,
    totalMarketCap,
    day: weightedMean(rows, (r) => r.day, (r) => r.marketCap).value ?? 0,
    year: marketYear.n >= Math.ceil(rows.length / 2) ? marketYear.value : undefined,
    pe: aggregatePE(rows),
    sectors,
    gainers: ranked.slice(0, 5),
    losers: ranked.slice(-5).reverse(),
    asOf,
    live: rows.length > 0,
  };
}
