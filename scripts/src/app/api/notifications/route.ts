import { NextResponse } from "next/server";
import { getCompanyNews } from "@/lib/news";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// A single alert the client can show in the bell / fire as a browser notification.
export interface Notif {
  id: string; // stable across polls so we don't re-notify
  ticker: string;
  type: "news" | "move";
  title: string;
  detail?: string;
  url?: string;
  source?: string;
  ts: number; // ms epoch
}

const MOVE_THRESHOLD = 0.04; // |day move| >= 4% is worth a heads-up
const NEWS_WINDOW_MS = 4 * 24 * 3600 * 1000; // only the last few days
const MAX_TICKERS = 8;

const norm = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 48);

const baseSymbol = (t: string) => t.replace(/\.(NS|BO|L|TO|HK)$/i, "");

// Intraday move for one symbol via Yahoo's keyless chart endpoint.
async function getDayMove(
  ticker: string
): Promise<{ price: number; changePct: number; name?: string } | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      ticker
    )}?range=1d&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: { result?: { meta?: Record<string, unknown> }[] };
    };
    const meta = json?.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = Number(meta.regularMarketPrice);
    const prev = Number(meta.chartPreviousClose ?? meta.previousClose);
    if (!isFinite(price) || !isFinite(prev) || prev <= 0) return null;
    const name =
      (typeof meta.shortName === "string" && meta.shortName) ||
      (typeof meta.longName === "string" && meta.longName) ||
      undefined;
    return { price, changePct: (price - prev) / prev, name };
  } catch {
    return null;
  }
}

async function notifsForTicker(ticker: string): Promise<Notif[]> {
  const out: Notif[] = [];
  const cutoff = Date.now() - NEWS_WINDOW_MS;

  const [newsRes, moveRes] = await Promise.allSettled([
    getCompanyNews(`${baseSymbol(ticker)} stock`),
    getDayMove(ticker),
  ]);

  // Big intraday move
  if (moveRes.status === "fulfilled" && moveRes.value) {
    const { changePct, name } = moveRes.value;
    if (Math.abs(changePct) >= MOVE_THRESHOLD) {
      const day = new Date().toISOString().slice(0, 10);
      const up = changePct >= 0;
      out.push({
        id: `move:${ticker}:${day}`,
        ticker,
        type: "move",
        title: `${ticker} ${up ? "up" : "down"} ${(Math.abs(changePct) * 100).toFixed(1)}% today`,
        detail: name ? `${name} is making an outsized move.` : "Outsized move today.",
        ts: Date.now(),
      });
    }
  }

  // Recent company news (top few)
  if (newsRes.status === "fulfilled") {
    for (const a of newsRes.value.slice(0, 3)) {
      if (a.publishedMs < cutoff) continue;
      out.push({
        id: `news:${ticker}:${norm(a.title)}`,
        ticker,
        type: "news",
        title: a.title,
        detail: a.summary || undefined,
        url: a.link,
        source: a.source,
        ts: a.publishedMs,
      });
    }
  }

  return out;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const raw = (searchParams.get("tickers") || "").trim();
  if (!raw) return NextResponse.json({ ok: true, notifs: [] });

  const tickers = Array.from(
    new Set(
      raw
        .split(",")
        .map((t) => t.trim().toUpperCase())
        .filter(Boolean)
    )
  ).slice(0, MAX_TICKERS);

  const results = await Promise.allSettled(tickers.map(notifsForTicker));
  const all: Notif[] = [];
  for (const r of results) if (r.status === "fulfilled") all.push(...r.value);

  // Dedupe by id (same headline can surface under two tickers), newest first.
  const byId = new Map<string, Notif>();
  for (const n of all) if (!byId.has(n.id)) byId.set(n.id, n);
  const notifs = Array.from(byId.values())
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 40);

  return NextResponse.json({ ok: true, notifs });
}
