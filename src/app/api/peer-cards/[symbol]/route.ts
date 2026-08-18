import { yahooQuoteSummary } from "@/lib/yahooCrumb";
import { jsonCached } from "@/lib/httpCache";
import { aliasSymbol } from "@/lib/symbolAlias";
import { seriesReturnPct, pooled } from "@/lib/marketMath";

export const dynamic = "force-dynamic";

// The extras the peer cards show beyond the score: a one-line description, the
// sector, and the 7-day and 1-year moves.
//
// Deliberately NOT the score itself. Every peer card already fetches
// /api/score/<symbol>, which is CDN-cached and shared with the rest of the page;
// re-deriving those numbers here would double the upstream work for figures the
// client already holds.

const MAX_PEERS = 6;
const SPARK = "https://query1.finance.yahoo.com/v8/finance/chart";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface Card {
  symbol: string;
  description?: string;
  sector?: string;
  industry?: string;
  return7d?: number;
  return1y?: number;
}

/** Closing prices for the last year, daily. One request serves both windows. */
async function closes(symbol: string): Promise<number[]> {
  try {
    const res = await fetch(
      `${SPARK}/${encodeURIComponent(symbol)}?range=1y&interval=1d`,
      { headers: { "User-Agent": UA }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(9000) }
    );
    if (!res.ok) return [];
    const json = (await res.json()) as {
      chart?: { result?: { indicators?: { quote?: { close?: (number | null)[] }[] } }[] };
    };
    const raw = json?.chart?.result?.[0]?.indicators?.quote?.[0]?.close ?? [];
    return raw.filter((v): v is number => typeof v === "number" && isFinite(v));
  } catch {
    return [];
  }
}

async function loadCard(symbol: string): Promise<Card> {
  const card: Card = { symbol };
  const [summary, series] = await Promise.all([
    yahooQuoteSummary(symbol, "assetProfile").catch(() => undefined),
    closes(symbol),
  ]);

  const ap = (summary?.assetProfile ?? {}) as Record<string, unknown>;
  if (typeof ap.longBusinessSummary === "string" && ap.longBusinessSummary.length) {
    card.description = ap.longBusinessSummary.slice(0, 400);
  }
  if (typeof ap.sector === "string") card.sector = ap.sector;
  if (typeof ap.industry === "string") card.industry = ap.industry;

  if (series.length > 1) {
    card.return1y = seriesReturnPct(series) ?? undefined;
    // Five trading days, not seven calendar ones. A "7D" figure taken from a
    // daily series seven ROWS back would silently be nine calendar days after a
    // long weekend, which is a different statistic with the right label on it.
    if (series.length > 5) card.return7d = seriesReturnPct(series.slice(-6)) ?? undefined;
  }
  return card;
}

export async function GET(req: Request, { params }: { params: { symbol: string } }) {
  const symbol = aliasSymbol(params.symbol.toUpperCase());
  const peerParam = new URL(req.url).searchParams.get("peers") ?? "";
  const symbols = peerParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, MAX_PEERS);

  if (!symbols.length) return jsonCached({ available: true, cards: [] }, 600);

  try {
    // Three at a time. These are public endpoints being asked for several
    // companies at once on behalf of one reader; a burst of six buys nothing.
    const cards = await pooled(symbols.map((sym) => () => loadCard(sym)), 3);
    return jsonCached({ available: true, symbol, cards }, 3600, 7200);
  } catch (err) {
    console.error("[peer-cards] failed:", err);
    return jsonCached({ available: false, cards: [] }, 60, 120);
  }
}
