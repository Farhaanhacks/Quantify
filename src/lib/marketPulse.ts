import { marketPulse as demoPulse, topMovers } from "@/data/demo";

// Live market pulse — indices, commodities, crypto, rates and movers — pulled
// from Yahoo's keyless chart endpoint (the same source the charts use). Each
// item falls back to its demo value if that one symbol fails, so the bar always
// renders something sensible.

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
      { headers: { "User-Agent": UA }, next: { revalidate: 300 }, signal: AbortSignal.timeout(7000) }
    );
    if (!r.ok) return null;
    const j = (await r.json()) as {
      chart?: { result?: { meta?: { regularMarketPrice?: number; chartPreviousClose?: number; previousClose?: number } }[] };
    };
    const m = j?.chart?.result?.[0]?.meta;
    const price = m?.regularMarketPrice;
    if (typeof price !== "number" || !isFinite(price)) return null;
    const prev = m?.chartPreviousClose ?? m?.previousClose;
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

export async function getPulse(): Promise<{ pulse: PulseEntry[]; movers: MoverEntry[]; live: boolean }> {
  let live = false;

  const idx = await Promise.all(
    SYMBOLS.map(async (s): Promise<PulseEntry | null> => {
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
    const demo = demoPulse.find((p) => p.label === s.label);
    return demo ? { label: demo.label, value: demo.value, changePct: demo.changePct } : { label: s.label, value: "—", changePct: 0 };
  });

  const moverResults = await Promise.all(
    topMovers.map(async (m): Promise<MoverEntry | null> => {
      const d = await fetchOne(m.ticker);
      if (!d) return null;
      const changePct = d.prev ? ((d.price - d.prev) / d.prev) * 100 : 0;
      return { ticker: m.ticker, changePct: Number(changePct.toFixed(2)), price: d.price };
    })
  );
  const movers: MoverEntry[] = topMovers.map((m, i) => {
    if (moverResults[i]) {
      live = true;
      return moverResults[i] as MoverEntry;
    }
    return { ticker: m.ticker, changePct: m.changePct, price: 0 };
  });

  return { pulse, movers, live };
}
