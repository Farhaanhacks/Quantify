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

// How many companies the payload carries. The overview only DRAWS the largest
// hundred or so — past that tiles shrink to a pixel — but the client keeps the
// rest so that drilling into a sector can show the companies the overview had
// no room for. That is the whole point of the drill-down: it reveals names you
// could not otherwise see, rather than just magnifying the ones you could.
const MAX_TILES = 400;

/**
 * The day's move for a quote.
 *
 * Yahoo's own reported percentage is authoritative — it is the figure brokers
 * show, and recomputing from prices would drift from it. But it sometimes comes
 * back as a flat 0 while that same response's price and previous close plainly
 * disagree, which is how a handful of companies end up sitting at "+0.00%" on a
 * day they moved. When the field and the prices contradict each other, the
 * prices win; a 0 that the prices agree with is left alone, because plenty of
 * companies really do close unchanged.
 *
 * Returns undefined when there is nothing trustworthy to show, so the caller
 * can drop the tile rather than draw a fabricated one.
 */
export function resolveChangePct(q: {
  changePercent?: number;
  price?: number;
  previousClose?: number;
}): number | undefined {
  const reported = q.changePercent;
  const canDerive =
    typeof q.price === "number" &&
    typeof q.previousClose === "number" &&
    q.previousClose > 0;
  const derived = canDerive
    ? ((q.price as number) - (q.previousClose as number)) / (q.previousClose as number) * 100
    : undefined;

  if (typeof reported === "number" && Number.isFinite(reported)) {
    // Only override an exact zero, and only when the prices disagree by enough
    // to actually show at the two decimals we display.
    if (reported === 0 && derived != null && Math.abs(derived) >= 0.005) return derived;
    return reported;
  }
  return derived != null && Number.isFinite(derived) ? derived : undefined;
}

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
      const changePct = resolveChangePct(q);
      if (changePct == null) continue;
      tiles.push({
        symbol,
        name: q.name || symbol,
        sector,
        marketCap: q.marketCap,
        changePct,
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
