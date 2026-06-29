"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard, SectionHeading, ScoreRadar } from "@/components/quantifi/Cards";
import { SCORE_AXES } from "@/data/demo";
import type { ScoreAxisKey } from "@/data/demo";

// Short axis labels for the compact peer snowflakes.
const STOCK_LABELS = ["Value", "Future", "Past", "Health", "Dividend"];
const FUND_LABELS = ["Cost", "Diversify", "Size", "Momentum", "Income"];

interface Peer {
  symbol: string;
  name?: string;
  cap?: number; // market cap (stocks) or AUM (funds)
  values?: number[]; // 5 axis scores, 0..6
}

function capFmt(n?: number): string {
  if (n == null || n <= 0) return "";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}t`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}b`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}m`;
  return `$${n.toFixed(0)}`;
}

async function loadStockPeer(symbol: string): Promise<Peer> {
  try {
    const r = await fetch(`/api/score/${encodeURIComponent(symbol)}`);
    const d = await r.json();
    const peer: Peer = { symbol, name: d.name, cap: d.marketCap };
    const sc = d.analytics?.scores as
      | Record<ScoreAxisKey, { score: number }>
      | undefined;
    if (sc) peer.values = SCORE_AXES.map((a) => sc[a.key]?.score ?? 0);
    return peer;
  } catch {
    return { symbol };
  }
}

async function loadFundPeer(symbol: string): Promise<Peer> {
  try {
    const r = await fetch(`/api/etf/${encodeURIComponent(symbol)}`);
    const d = (await r.json()) as {
      available?: boolean;
      etf?: { name?: string; totalAssets?: number; rating?: { score: number }[] };
    };
    if (!d.available || !d.etf) return { symbol };
    return {
      symbol,
      name: d.etf.name,
      cap: d.etf.totalAssets,
      values: d.etf.rating?.map((a) => a.score),
    };
  } catch {
    return { symbol };
  }
}

export default function Competitors({
  symbol,
  name,
  kind = "stocks",
}: {
  symbol: string;
  name?: string;
  kind?: "stocks" | "funds";
}) {
  const [peers, setPeers] = useState<Peer[] | null>(null);
  const labels = kind === "funds" ? FUND_LABELS : STOCK_LABELS;

  useEffect(() => {
    let cancelled = false;
    setPeers(null);
    (async () => {
      try {
        const r = await fetch(`/api/peers/${encodeURIComponent(symbol)}`);
        const d = (await r.json()) as { peers?: string[] };
        const syms = (d.peers ?? []).slice(0, 4);
        if (!syms.length) {
          if (!cancelled) setPeers([]);
          return;
        }
        const loaded = await Promise.all(
          syms.map((s) => (kind === "funds" ? loadFundPeer(s) : loadStockPeer(s)))
        );
        if (!cancelled) setPeers(loaded.filter((p) => p.name || p.values));
      } catch {
        if (!cancelled) setPeers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, kind]);

  // Nothing relevant to show → render nothing (don't clutter the page).
  if (peers && peers.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow={kind === "funds" ? "Similar funds" : "Peers"}
        title={
          kind === "funds"
            ? `ETFs with similar holdings`
            : `${name ?? symbol} competitors`
        }
        subtitle={
          kind === "funds"
            ? "Funds Yahoo considers comparable, scored on the same fund axes. Tap any to open its X-ray. Research context, not advice."
            : "Companies in the same space, each on the five-axis Quantifi Score. Tap any to open its full analysis. Research context, not advice."
        }
      />

      <GlassCard className="mt-6 p-5 sm:p-6">
        {peers === null ? (
          <p className="py-8 text-center text-sm text-slate-500">Finding comparable names…</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {peers.map((p) => (
              <Link
                key={p.symbol}
                href={`/stock-analysis?symbol=${encodeURIComponent(p.symbol)}`}
                className="group flex flex-col items-center rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center transition hover:border-gold/40"
              >
                <span className="h-24 w-28">
                  {p.values && p.values.length === 5 ? (
                    <ScoreRadar values={p.values} labels={labels} size={150} />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs text-slate-600">
                      no score
                    </span>
                  )}
                </span>
                <span className="mt-2 line-clamp-1 font-display text-sm font-semibold text-white group-hover:text-gold">
                  {p.name ?? p.symbol}
                </span>
                <span className="font-mono text-[0.7rem] text-slate-400">{p.symbol}</span>
                {p.cap ? (
                  <span className="mt-0.5 text-[0.7rem] text-slate-500">{capFmt(p.cap)}</span>
                ) : null}
              </Link>
            ))}
          </div>
        )}
      </GlassCard>
    </section>
  );
}
