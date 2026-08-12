import { yahooQuotes } from "@/lib/yahooCrumb";
import { universeFor, regionLabel, REGION_KEYS } from "@/data/heatmapUniverse";

// Data for the market heatmap: one tile per company, sized by market cap and
// coloured by the day's move.
//
// The universe of companies per market lives in data/heatmapUniverse; the live
// numbers come from Yahoo, the same source as the rest of the app.
//
// Real data only, consistently with MarketPulse: a company with no live quote
// is dropped rather than drawn at a guessed size. That is also what makes a
// curated ticker list safe — a symbol we have wrong yields no tile at all,
// never a wrong one.

export interface HeatmapTile {
  symbol: string;
  name: string;
  sector: string;
  marketCap: number;
  changePct: number;
  price: number;
  currency: string;
}

export interface HeatmapData {
  /** Region key, e.g. "us", "jp". */
  region: string;
  regionLabel: string;
  tiles: HeatmapTile[];
  asOf: string;
  /** False when nothing could be fetched, so the UI can say so instead of drawing an empty box. */
  live: boolean;
}

// Yahoo's quote endpoint takes a symbol list on the query string; several
// hundred at once makes for an unreasonable URL and a single point of failure,
// so ask in chunks and let one bad chunk cost only its own names.
const CHUNK = 50;

/** How many companies the picture holds. See the note where it is applied. */
const MAX_TILES = 100;

export function normaliseRegion(raw: string | null | undefined): string {
  const k = (raw ?? "").toLowerCase().trim();
  return REGION_KEYS.includes(k) ? k : "us";
}

export async function getHeatmap(regionKey = "us"): Promise<HeatmapData> {
  const region = normaliseRegion(regionKey);
  const universe = universeFor(region);
  const sectorOf = new Map(universe.map((u) => [u.symbol.toUpperCase(), u.sector]));
  const symbols = universe.map((u) => u.symbol);

  const asOf =
    new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      hour12: false,
    }) + " UTC";

  const chunks: string[][] = [];
  for (let i = 0; i < symbols.length; i += CHUNK) chunks.push(symbols.slice(i, i + CHUNK));

  const results = await Promise.all(
    // 5 minutes: a heatmap is a picture of the day, not a ticker, and this is
    // on the home page of every signed-in visit.
    chunks.map((c) => yahooQuotes(c, 300).catch(() => new Map()))
  );

  const tiles: HeatmapTile[] = [];
  for (const map of results) {
    for (const [, q] of map) {
      const symbol = q.symbol?.toUpperCase();
      if (!symbol) continue;
      const sector = sectorOf.get(symbol);
      // Size must be real: without a market cap there is no honest area for
      // this tile, so it doesn't get drawn.
      if (!sector || typeof q.marketCap !== "number" || !(q.marketCap > 0)) continue;
      if (typeof q.changePercent !== "number" || !Number.isFinite(q.changePercent)) continue;
      tiles.push({
        symbol,
        name: q.name || symbol,
        sector,
        marketCap: q.marketCap,
        changePct: q.changePercent,
        price: typeof q.price === "number" ? q.price : 0,
        currency: q.currency || "USD",
      });
    }
  }

  tiles.sort((a, b) => b.marketCap - a.marketCap);
  // Cap the field. Market caps span three orders of magnitude, so drawing every
  // name gives the smallest ones a literal 1px² tile: invisible, but still a
  // focusable button and still costing a DOM node. The largest MAX_TILES are a
  // true treemap of themselves and stay big enough to read and click.
  return {
    region,
    regionLabel: regionLabel(region),
    tiles: tiles.slice(0, MAX_TILES),
    asOf,
    live: tiles.length > 0,
  };
}
