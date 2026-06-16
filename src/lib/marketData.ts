// Server-only market-data access layer.
//
// Provider-agnostic: reads MARKET_DATA_PROVIDER + MARKET_DATA_API_KEY from the
// environment. With no key (or provider="demo") it returns the bundled demo
// data, so the app always renders. Set the env vars to switch to live data.
//
// NOTE: this file must only be imported from server components or route
// handlers (it reads process.env and never ships to the browser).

import { stockByTicker } from "@/data/demo";

export interface LiveQuote {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  marketCap?: string;
  live: boolean; // true = from provider, false = demo fallback
}

const PROVIDER = process.env.MARKET_DATA_PROVIDER ?? "demo";
const KEY = process.env.MARKET_DATA_API_KEY ?? "";

function formatCap(n: number | null | undefined): string | undefined {
  if (!n || n <= 0) return undefined;
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

function demoQuote(ticker: string): LiveQuote {
  const s = stockByTicker[ticker];
  return {
    ticker,
    name: s?.name ?? ticker,
    price: s?.price ?? 0,
    changePct: s?.changePct ?? 0,
    marketCap: s?.marketCap,
    live: false,
  };
}

// ── Financial Modeling Prep adapter ──────────────────────────────────────────
// Docs: https://site.financialmodelingprep.com/developer/docs
// Batch quote endpoint accepts comma-separated symbols. Indian symbols use the
// ".NS" suffix (e.g. RELIANCE.NS), which matches our demo tickers.

async function fmpQuotes(tickers: string[]): Promise<LiveQuote[]> {
  const url = `https://financialmodelingprep.com/api/v3/quote/${encodeURIComponent(
    tickers.join(",")
  )}?apikey=${KEY}`;
  // Revalidate at most once a minute so we are not hammering the API.
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`FMP responded ${res.status}`);
  const data = (await res.json()) as Array<{
    symbol: string;
    name?: string;
    price?: number;
    changesPercentage?: number;
    marketCap?: number;
  }>;
  return data.map((q) => ({
    ticker: q.symbol,
    name: q.name ?? q.symbol,
    price: q.price ?? 0,
    changePct: q.changesPercentage ?? 0,
    marketCap: formatCap(q.marketCap),
    live: true,
  }));
}

// ── Public API ───────────────────────────────────────────────────────────────

export async function getQuotes(tickers: string[]): Promise<LiveQuote[]> {
  if (PROVIDER === "fmp" && KEY) {
    try {
      const live = await fmpQuotes(tickers);
      const byTicker = new Map(live.map((q) => [q.ticker, q]));
      // Guarantee one entry per requested ticker; fall back per-missing.
      return tickers.map((t) => byTicker.get(t) ?? demoQuote(t));
    } catch (err) {
      // Any failure (bad key, rate limit, network) degrades gracefully.
      console.error("[marketData] live fetch failed, using demo:", err);
    }
  }
  return tickers.map(demoQuote);
}

export async function getQuote(ticker: string): Promise<LiveQuote> {
  return (await getQuotes([ticker]))[0];
}

export function isLiveConfigured(): boolean {
  return PROVIDER === "fmp" && Boolean(KEY);
}
