"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GlassCard,
  SectionHeading,
  TickerChip,
  Tag,
} from "@/components/quantifi/Cards";
import { UNDERVALUED_CANDIDATES } from "@/data/candidates";

interface Row {
  ticker: string;
  name: string;
  price: number;
  target: number;
  upside: number;
  recommendation?: string;
  numAnalysts?: number;
  marketCap?: number;
  total?: number;
}

function fmtCap(n?: number): string {
  if (!n || !isFinite(n)) return "—";
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(0)}M`;
  return `${Math.round(n)}`;
}

function ratingLabel(r?: string): string {
  switch ((r || "").toLowerCase()) {
    case "strong_buy":
      return "Strong Buy";
    case "buy":
      return "Buy";
    case "hold":
      return "Hold";
    case "underperform":
      return "Underperform";
    case "sell":
      return "Sell";
    default:
      return "—";
  }
}

function ratingTone(r?: string): "up" | "gold" | "down" | "neutral" {
  const k = (r || "").toLowerCase();
  if (k === "strong_buy" || k === "buy") return "up";
  if (k === "hold") return "gold";
  if (k === "underperform" || k === "sell") return "down";
  return "neutral";
}

export default function UndervaluedFinds() {
  const [rows, setRows] = useState<Row[]>([]);
  const [done, setDone] = useState(0);
  const total = UNDERVALUED_CANDIDATES.length;

  useEffect(() => {
    let cancelled = false;
    UNDERVALUED_CANDIDATES.forEach(async (t) => {
      try {
        const r = await fetch(`/api/score/${encodeURIComponent(t)}`);
        const d = await r.json();
        if (
          !cancelled &&
          d?.available &&
          typeof d.price === "number" &&
          typeof d.target === "number" &&
          d.target > 0
        ) {
          const upside = ((d.target - d.price) / d.price) * 100;
          const scores = d.analytics?.scores;
          const total30 = scores
            ? (["value", "growth", "past", "health", "dividends"] as const).reduce(
                (acc, k) => acc + (scores[k]?.score ?? 0),
                0
              )
            : undefined;
          setRows((prev) => {
            if (prev.some((p) => p.ticker === t)) return prev;
            return [
              ...prev,
              {
                ticker: t,
                name: d.name ?? t,
                price: d.price,
                target: d.target,
                upside,
                recommendation: d.recommendation,
                numAnalysts: d.numAnalysts,
                marketCap: d.marketCap,
                total: total30,
              },
            ];
          });
        }
      } catch {
        /* skip this candidate */
      } finally {
        if (!cancelled) setDone((n) => n + 1);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const sorted = [...rows].sort((a, b) => b.upside - a.upside);
  const loading = done < total;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Undervalued Finds"
        title="Biggest gaps to analyst fair value"
        subtitle="A live scan of a curated universe, ranked by how far each trades below the analysts' average price target. Real data — a research starting point, not advice."
      />

      {loading ? (
        <div className="mt-5 flex items-center gap-3">
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-gold transition-all"
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
          <span className="text-xs text-slate-500">
            Scanning {done}/{total} names…
          </span>
        </div>
      ) : null}

      <GlassCard className="mt-5 overflow-hidden">
        <div className="hidden grid-cols-[0.4fr_0.7fr_2fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr] gap-3 border-b border-white/[0.06] px-5 py-3 text-[0.6rem] uppercase tracking-[0.14em] text-slate-500 lg:grid">
          <span>#</span>
          <span>Symbol</span>
          <span>Company</span>
          <span>Top rating</span>
          <span className="text-right">Analysts</span>
          <span className="text-right">Target</span>
          <span className="text-right">Upside</span>
          <span className="text-right">Mkt cap</span>
        </div>

        {sorted.length === 0 && !loading ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            Couldn&apos;t pull analyst data right now — try refreshing in a moment.
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {sorted.map((r, i) => (
              <li
                key={r.ticker}
                className="grid grid-cols-2 gap-2 px-5 py-3.5 lg:grid-cols-[0.4fr_0.7fr_2fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr] lg:items-center"
              >
                <span className="font-mono text-xs text-slate-500">{i + 1}</span>
                <Link href={`/stock-analysis?symbol=${r.ticker}`}>
                  <TickerChip ticker={r.ticker} />
                </Link>
                <span className="truncate text-sm text-slate-200">{r.name}</span>
                <span>
                  <Tag tone={ratingTone(r.recommendation)}>{ratingLabel(r.recommendation)}</Tag>
                </span>
                <span className="text-right font-mono text-sm tnum text-slate-400">
                  {r.numAnalysts ?? "—"}
                </span>
                <span className="text-right font-mono text-sm tnum text-white">
                  {r.target.toFixed(2)}
                </span>
                <span
                  className={`text-right font-mono text-sm font-semibold tnum ${
                    r.upside >= 0 ? "text-up" : "text-down"
                  }`}
                >
                  {r.upside >= 0 ? "+" : ""}
                  {r.upside.toFixed(1)}%
                </span>
                <span className="text-right font-mono text-sm tnum text-slate-400">
                  {fmtCap(r.marketCap)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>

      <p className="mt-3 text-xs text-slate-600">
        &quot;Upside&quot; is the analysts&apos; average price target versus the current price, pulled
        live from public data. It reflects a curated watch-universe, not the entire market, and a high
        target gap is not a recommendation — always do your own research.
      </p>
    </section>
  );
}
