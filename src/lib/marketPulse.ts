import { yahooQuotes } from "@/lib/yahooCrumb";

// Live market pulse — indices, commodities, crypto, rates and movers — pulled
// from Yahoo's keyless chart endpoint (the same source the charts use). Real
// data only: an index that can't be fetched shows "—", and a mover with no live
// quote is dropped, rather than showing a stale/fabricated value.

// The watched movers row — a curated set of tickers we surface day-change for.
// Only their LIVE change is ever shown; if a quote is missing the name is
// dropped from the row.
const MOVER_TICKERS = ["NVDA", "AMD", "PLTR", "TSLA", "ASTS", "RKLB", "RELIANCE.NS"];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export interface PulseEntry {
  label: string;
  value: string;
  changePct: number;
}
export interface MoverEntry {
  ticker: string;
  changePct: number;
  price: number;
}

type Fmt = "index" | "usd" | "pct" | "plain";

const SYMBOLS: { label: string; symbol: string; fmt: Fmt }[] = [
  { label: "S&P 500", symbol: "^GSPC", fmt: "index" },
  { label: "NASDAQ", symbol: "^IXIC", fmt: "index" },
  { label: "DOW", symbol: "^DJI", fmt: "index" },
  { label: "NIFTY 50", symbol: "^NSEI", fmt: "index" },
  { label: "SENSEX", symbol: "^BSESN", fmt: "index" },
  { label: "FTSE 100", symbol: "^FTSE", fmt: "index" },
  { label: "NIKKEI", symbol: "^N225", fmt: "index" },
  { label: "VIX", symbol: "^VIX", fmt: "plain" },
  { label: "BTC", symbol: "BTC-USD", fmt: "usd" },
  { label: "GOLD", symbol: "GC=F", fmt: "usd" },
  { label: "BRENT", symbol: "BZ=F", fmt: "usd" },
  { label: "10Y UST", symbol: "^TNX", fmt: "pct" },
];

async function fetchOne(symbol: string): Promise<{ price: number; prev: number } | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1d&interval=1d`,
      { headers: { "User-Agent": UA }, next: { revalidate: 60 }, signal: AbortSignal.timeout(7000) }
    );
    if (!r.ok) return null;
    const j = (await r.json()) as {
      chart?: { result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number } }[] };
    };
    const m = j?.chart?.result?.[0]?.meta;
    const price = m?.regularMarketPrice;
    if (typeof price !== "number" || !isFinite(price)) return null;
    // Prefer the official previous close (matches Yahoo's displayed % change);
    // chartPreviousClose is adjusted and can skew the day-change figure.
    const prev = m?.previousClose ?? m?.chartPreviousClose;
    return { price, prev: typeof prev === "number" && prev > 0 ? prev : price };
  } catch {
    return null;
  }
}

function fmtVal(v: number, fmt: Fmt): string {
  if (fmt === "index") return v.toLocaleString("en-US", { maximumFractionDigits: 0 });
  if (fmt === "usd")
    return `$${v.toLocaleString("en-US", { maximumFractionDigits: v >= 1000 ? 0 : 2 })}`;
  if (fmt === "pct") {
    const y = v > 20 ? v / 10 : v; // ^TNX is sometimes quoted x10
    return `${y.toFixed(2)}%`;
  }
  return v.toFixed(2);
}

export async function getPulse(): Promise<{
  pulse: PulseEntry[];
  movers: MoverEntry[];
  live: boolean;
  asOf: string;
}> {
  let live = false;
  const asOf =
    new Date().toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
      hour12: false,
    }) + " UTC";

  // One batched, authoritative quote call for every symbol on the bar. We use
  // Yahoo's reported day-change directly so the numbers match what a broker
  // shows. Anything missing here falls back to the per-symbol chart endpoint,
  // then shows a dash — never a stale or fabricated value.
  const quotes = await yahooQuotes([
    ...SYMBOLS.map((s) => s.symbol),
    ...MOVER_TICKERS,
  ]);

  const idx = await Promise.all(
    SYMBOLS.map(async (s): Promise<PulseEntry | null> => {
      const q = quotes.get(s.symbol.toUpperCase());
      if (q && q.price != null && q.changePercent != null) {
        return {
          label: s.label,
          value: fmtVal(q.price, s.fmt),
          changePct: Number(q.changePercent.toFixed(2)),
        };
      }
      const d = await fetchOne(s.symbol);
      if (!d) return null;
      const changePct = d.prev ? ((d.price - d.prev) / d.prev) * 100 : 0;
      return { label: s.label, value: fmtVal(d.price, s.fmt), changePct: Number(changePct.toFixed(2)) };
    })
  );
  const pulse: PulseEntry[] = SYMBOLS.map((s, i) => {
    if (idx[i]) {
      live = true;
      return idx[i] as PulseEntry;
    }
    // No live value for this symbol — show a dash, never a stale/fabricated one.
    return { label: s.label, value: "n/a", changePct: 0 };
  });

  const moverResults = await Promise.all(
    MOVER_TICKERS.map(async (ticker): Promise<MoverEntry | null> => {
      const q = quotes.get(ticker.toUpperCase());
      if (q && q.changePercent != null) {
        return { ticker, changePct: Number(q.changePercent.toFixed(2)), price: q.price ?? 0 };
      }
      const d = await fetchOne(ticker);
      if (!d) return null;
      const changePct = d.prev ? ((d.price - d.prev) / d.prev) * 100 : 0;
      return { ticker, changePct: Number(changePct.toFixed(2)), price: d.price };
    })
  );
  // Only movers with a live quote are shown — no fabricated day-change.
  const movers: MoverEntry[] = moverResults.filter((m): m is MoverEntry => m != null);
  if (movers.length) live = true;

  return { pulse, movers, live, asOf };
}
