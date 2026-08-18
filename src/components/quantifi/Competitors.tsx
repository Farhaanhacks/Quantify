"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { GlassCard, SectionHeading, ScoreRadar } from "@/components/quantifi/Cards";
import CompanyLogo from "@/components/quantifi/CompanyLogo";
import { SCORE_AXES, currencySymbol } from "@/data/demo";
import type { ScoreAxisKey } from "@/data/demo";

// Peer cards: the same five-axis snowflake, plus the numbers a reader wants
// before deciding whether a name is worth opening.
//
// Each card has two faces. At rest it is the snowflake with the price and the
// two return windows, which is the comparison you actually scan a row of peers
// for. On hover it turns over to what the company DOES and how it is valued,
// because "should I open this one" is answered by the business and the multiple,
// not by another radar chart.
//
// Both faces occupy the same box, so the row never reflows under the cursor. A
// card whose data did not load keeps its resting face rather than presenting an
// empty back: a hover that reveals nothing is worse than one that does not fire.

const STOCK_LABELS = ["Value", "Future", "Past", "Health", "Dividend"];
const FUND_LABELS = ["Cost", "Diversify", "Size", "Momentum", "Income"];

interface Peer {
  symbol: string;
  name?: string;
  cap?: number; // market cap (stocks) or AUM (funds)
  values?: number[]; // 5 axis scores, 0..6
  price?: number;
  currency?: string;
  pe?: number;
  revGrowth?: number;
  target?: number;
  description?: string;
  sector?: string;
  return7d?: number;
  return1y?: number;
}

function capFmt(n?: number): string {
  if (n == null || n <= 0) return "";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}t`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}b`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}m`;
  return `$${n.toFixed(0)}`;
}

const pctFmt = (n?: number): string =>
  n == null || !isFinite(n) ? "n/a" : `${n > 0 ? "" : ""}${n.toFixed(1)}%`;

async function loadStockPeer(symbol: string): Promise<Peer> {
  try {
    const r = await fetch(`/api/score/${encodeURIComponent(symbol)}`);
    const d = await r.json();
    const peer: Peer = {
      symbol,
      name: d.name,
      cap: d.marketCap,
      price: d.price,
      currency: d.currency,
      pe: d.trailingPE,
      // Yahoo reports growth as a fraction; every other percentage on this card
      // is already in percent, so it is converted once here rather than at each
      // place it is rendered.
      revGrowth: typeof d.revenueGrowth === "number" ? d.revenueGrowth * 100 : undefined,
      target: d.target,
    };
    const sc = d.analytics?.scores as Record<ScoreAxisKey, { score: number }> | undefined;
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

/** A return, coloured by direction, in the pill the screenshot uses. */
function MovePill({ label, value }: { label: string; value?: number }) {
  if (value == null || !isFinite(value)) return null;
  const up = value >= 0;
  return (
    <span className="flex flex-col items-start gap-0.5">
      <span className="text-[0.55rem] uppercase tracking-wider text-slate-500">{label}</span>
      <span
        className={`rounded px-1.5 py-0.5 font-mono text-[0.7rem] tnum ${
          up ? "bg-up/15 text-up" : "bg-down/15 text-down"
        }`}
      >
        {up ? "+" : ""}
        {value.toFixed(1)}%
      </span>
    </span>
  );
}

function PeerCard({ peer, labels }: { peer: Peer; labels: string[] }) {
  const [hover, setHover] = useState(false);
  const cur = currencySymbol(peer.currency);
  // The back face needs something to say. With no description and no valuation
  // figures it would be an empty green panel, so the card simply does not turn.
  const hasBack = Boolean(peer.description || peer.pe != null || peer.target != null);
  const showBack = hover && hasBack;

  return (
    <Link
      href={`/stock-analysis?symbol=${encodeURIComponent(peer.symbol)}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      className={`group flex h-[19rem] flex-col rounded-xl border p-4 transition ${
        showBack
          ? "border-up/50 bg-up/[0.16]"
          : "border-white/[0.06] bg-white/[0.02] hover:border-gold/40"
      }`}
    >
      {showBack ? (
        <>
          <div className="flex items-center justify-between gap-2">
            <CompanyLogo symbol={peer.symbol} name={peer.name} size={28} />
            {peer.sector ? (
              <span className="truncate rounded-full bg-white/10 px-2 py-0.5 text-[0.6rem] text-slate-200">
                {peer.sector}
              </span>
            ) : null}
          </div>
          <p className="mt-3 line-clamp-6 flex-1 text-left text-xs leading-relaxed text-slate-200">
            {peer.description ?? `${peer.name ?? peer.symbol}, on the numbers below.`}
          </p>
          <div className="mt-3 grid grid-cols-3 gap-2 border-t border-white/10 pt-3 text-left">
            <span>
              <span className="block text-[0.55rem] uppercase tracking-wider text-slate-400">P/E</span>
              <span className="font-mono text-sm tnum text-white">
                {peer.pe != null ? `${peer.pe.toFixed(1)}x` : "n/a"}
              </span>
            </span>
            <span>
              <span className="block text-[0.55rem] uppercase tracking-wider text-slate-400">Growth</span>
              <span className="font-mono text-sm tnum text-white">{pctFmt(peer.revGrowth)}</span>
            </span>
            <span>
              <span className="block text-[0.55rem] uppercase tracking-wider text-slate-400">Target</span>
              <span className="font-mono text-sm tnum text-white">
                {peer.target != null ? `${cur}${peer.target.toFixed(2)}` : "n/a"}
              </span>
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="text-left">
            <p className="line-clamp-1 font-display text-sm font-semibold text-white group-hover:text-gold">
              {peer.name ?? peer.symbol}
            </p>
            <p className="text-[0.7rem] text-slate-500">{capFmt(peer.cap) || peer.symbol}</p>
          </div>
          <div className="flex flex-1 items-center justify-center">
            {peer.values && peer.values.length === 5 ? (
              <ScoreRadar values={peer.values} labels={labels} size={150} />
            ) : (
              <span className="text-xs text-slate-600">no score</span>
            )}
          </div>
          <div className="flex items-end justify-between gap-2 border-t border-white/[0.06] pt-3">
            <span className="flex flex-col items-start gap-0.5">
              <span className="font-mono text-[0.6rem] text-slate-500">{peer.symbol}</span>
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 font-mono text-[0.7rem] tnum text-white">
                {peer.price != null ? `${cur}${peer.price.toFixed(2)}` : "n/a"}
              </span>
            </span>
            <MovePill label="7D" value={peer.return7d} />
            <MovePill label="1Y" value={peer.return1y} />
          </div>
        </>
      )}
    </Link>
  );
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

        // The card extras arrive second and merge in. The snowflakes are the
        // point of the row and should not wait on a description, so the cards
        // render as soon as the scores land and fill in from here.
        if (kind === "stocks") {
          try {
            const cr = await fetch(
              `/api/peer-cards/${encodeURIComponent(symbol)}?peers=${encodeURIComponent(syms.join(","))}`
            );
            const cd = (await cr.json()) as {
              cards?: { symbol: string; description?: string; sector?: string; return7d?: number; return1y?: number }[];
            };
            if (cancelled || !cd.cards?.length) return;
            const extras = new Map(cd.cards.map((c) => [c.symbol, c]));
            setPeers((prev) =>
              prev
                ? prev.map((p) => {
                    const e = extras.get(p.symbol);
                    return e ? { ...p, ...e } : p;
                  })
                : prev
            );
          } catch {
            /* the cards work without the extras */
          }
        }
      } catch {
        if (!cancelled) setPeers([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, kind]);

  // Nothing relevant to show, so render nothing rather than clutter the page.
  if (peers && peers.length === 0) return null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow={kind === "funds" ? "Similar funds" : "Peers"}
        title={kind === "funds" ? `ETFs with similar holdings` : `${name ?? symbol} competitors`}
        subtitle={
          kind === "funds"
            ? "Funds Yahoo considers comparable, scored on the same fund axes. Tap any to open its X-ray. Research context, not advice."
            : "Companies in the same space, each on the five-axis Quantifi Score. Hover a card for what the company does and how it is valued; tap to open its full analysis. Research context, not advice."
        }
      />

      <GlassCard className="mt-6 p-5 sm:p-6">
        {peers === null ? (
          <p className="py-8 text-center text-sm text-slate-500">Finding comparable names…</p>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {peers.map((p) => (
              <PeerCard key={p.symbol} peer={p} labels={labels} />
            ))}
          </div>
        )}
      </GlassCard>
    </section>
  );
}
