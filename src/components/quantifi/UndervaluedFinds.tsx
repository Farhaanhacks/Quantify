"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  GlassCard,
  SectionHeading,
  TickerChip,
  Tag,
} from "@/components/quantifi/Cards";
import { UNDERVALUED_CANDIDATES, CANDIDATE_SECTORS } from "@/data/candidates";

interface Row {
  ticker: string;
  name: string;
  price: number;
  target: number;
  targetHigh?: number;
  targetLow?: number;
  upside: number;
  recommendation?: string;
  numAnalysts?: number;
  marketCap?: number;
  total?: number;
}

const pctOf = (from: number, to: number) => ((to - from) / from) * 100;
const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

// Real analyst range: bear (low target) · base (mean target) · bull (high
// target), each shown as price + % vs the current price. Live data, not a
// model — straight from the analyst estimates Yahoo aggregates.
function AnalystRange({ row }: { row: Row }) {
  const hasRange = typeof row.targetHigh === "number" && typeof row.targetLow === "number";
  const lowP = hasRange ? (row.targetLow as number) : row.target;
  const highP = hasRange ? (row.targetHigh as number) : row.target;

  const down = pctOf(row.price, lowP);
  const base = pctOf(row.price, row.target);
  const up = pctOf(row.price, highP);

  // A "range" only means something if the low and high targets genuinely differ.
  // With a single analyst — or when a provider reports low = mean = high — the
  // three bars collapse to one value and a range chart is nonsensical (Low, Mean
  // and High all "+233%"). In that case show a plain current-vs-target view.
  const spread = Math.abs(highP - lowP);
  const realRange =
    hasRange && (row.numAnalysts ?? 0) > 1 && spread > Math.max(0.01, row.price * 0.01);

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-center justify-between text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
        <span>Analyst {realRange ? "price-target range" : "price target"}</span>
        <span className="text-slate-600">
          {row.numAnalysts ?? "n/a"} analyst{row.numAnalysts === 1 ? "" : "s"}
        </span>
      </div>

      {/* Bar chart: full low/mean/high only when there's a real spread; otherwise
          just current vs the single target. */}
      {(() => {
        const bars = realRange
          ? [
              { label: "Now", val: row.price, color: "#94A3B8", pct: 0 },
              { label: "Low", val: lowP, color: "#FB7185", pct: down },
              { label: "Mean", val: row.target, color: "#4F93F7", pct: base },
              { label: "High", val: highP, color: "#34D399", pct: up },
            ]
          : [
              { label: "Now", val: row.price, color: "#94A3B8", pct: 0 },
              { label: "Target", val: row.target, color: base >= 0 ? "#34D399" : "#FB7185", pct: base },
            ];
        const maxV = Math.max(...bars.map((b) => b.val)) || 1;
        return (
          <div className="mt-4 flex h-32 items-end gap-3 border-b border-white/[0.08] pb-0">
            {bars.map((b) => (
              <div key={b.label} className="flex flex-1 flex-col items-center justify-end">
                <span className="font-mono text-[0.62rem] text-white">{b.val.toFixed(0)}</span>
                <div
                  className="mt-1 w-full max-w-[42px] rounded-t-md transition-all"
                  style={{ height: `${Math.max(4, (b.val / maxV) * 92)}px`, backgroundColor: b.color }}
                />
                <span className="mt-1.5 text-[0.6rem] text-slate-400">{b.label}</span>
                <span
                  className="text-[0.58rem] font-medium"
                  style={{ color: b.label === "Now" ? "#64748B" : b.color }}
                >
                  {b.label === "Now" ? "current" : fmtPct(b.pct)}
                </span>
              </div>
            ))}
          </div>
        );
      })()}

      {realRange ? (
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
          {[
            { label: "Bear · low target", price: lowP, pct: down, cls: "border-down/25 bg-down/[0.06]", txt: "text-down" },
            { label: "Base · mean target", price: row.target, pct: base, cls: "border-gold/25 bg-gold/[0.06]", txt: "text-gold" },
            { label: "Bull · high target", price: highP, pct: up, cls: "border-up/25 bg-up/[0.06]", txt: "text-up" },
          ].map((c) => (
            <div key={c.label} className={`rounded-lg border p-2.5 ${c.cls}`}>
              <div className="text-[0.55rem] uppercase tracking-[0.12em] text-slate-500">{c.label}</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="font-mono text-sm tnum text-white">{c.price.toFixed(2)}</span>
                <span className={`font-mono text-xs font-semibold ${c.txt}`}>{fmtPct(c.pct)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-lg border border-gold/25 bg-gold/[0.06] p-2.5">
          <div className="text-[0.55rem] uppercase tracking-[0.12em] text-slate-500">Mean target</div>
          <div className="mt-1 flex items-baseline justify-between">
            <span className="font-mono text-sm tnum text-white">{row.target.toFixed(2)}</span>
            <span className={`font-mono text-xs font-semibold ${base >= 0 ? "text-up" : "text-down"}`}>{fmtPct(base)}</span>
          </div>
        </div>
      )}

      {!realRange ? (
        <p className="mt-3 text-[0.7rem] text-slate-500">
          {(row.numAnalysts ?? 0) <= 1
            ? "Only one analyst covers this name; a single target, so there's no high/low range to plot."
            : "The published high and low targets match, so there's no meaningful range to show."}
        </p>
      ) : null}

      <p className="mt-3 text-[0.7rem] leading-relaxed text-slate-600">
        Upside/downside here is the spread of Wall-Street analyst price targets vs the current price; a
        gauge of expectations, not a forecast or advice.
      </p>
    </div>
  );
}

function fmtCap(n?: number): string {
  if (!n || !isFinite(n)) return "n/a";
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
      return "n/a";
  }
}

function ratingTone(r?: string): "up" | "gold" | "down" | "neutral" {
  const k = (r || "").toLowerCase();
  if (k === "strong_buy" || k === "buy") return "up";
  if (k === "hold") return "gold";
  if (k === "underperform" || k === "sell") return "down";
  return "neutral";
}

// One scanner row + its expandable analyst-range panel. Shared across every
// sector table so the layout stays identical.
function ScanRow({
  r,
  i,
  isOpen,
  onToggle,
}: {
  r: Row;
  i: number;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <li>
      <div
        onClick={onToggle}
        className={`grid cursor-pointer grid-cols-2 gap-2 px-5 py-3.5 transition hover:bg-white/[0.02] lg:grid-cols-[0.4fr_0.7fr_2fr_1fr_0.7fr_0.8fr_0.9fr_0.9fr] lg:items-center ${
          isOpen ? "bg-white/[0.02]" : ""
        }`}
      >
        <span className="font-mono text-xs text-slate-500">{i + 1}</span>
        <Link href={`/stock-analysis?symbol=${r.ticker}`} onClick={(e) => e.stopPropagation()}>
          <TickerChip ticker={r.ticker} />
        </Link>
        <span className="truncate text-sm text-slate-200">
          {r.name}
          <span className="ml-2 text-[0.65rem] text-gold/70">{isOpen ? "▲" : "▾"}</span>
        </span>
        <span>
          <Tag tone={ratingTone(r.recommendation)}>{ratingLabel(r.recommendation)}</Tag>
        </span>
        <span className="text-right font-mono text-sm tnum text-slate-400">{r.numAnalysts ?? "n/a"}</span>
        <span className="text-right font-mono text-sm tnum text-white">{r.target.toFixed(2)}</span>
        <span
          className={`text-right font-mono text-sm font-semibold tnum ${
            r.upside >= 0 ? "text-up" : "text-down"
          }`}
        >
          {r.upside >= 0 ? "+" : ""}
          {r.upside.toFixed(1)}%
        </span>
        <span className="text-right font-mono text-sm tnum text-slate-400">{fmtCap(r.marketCap)}</span>
      </div>
      {isOpen ? (
        <div className="px-5 pb-4">
          <AnalystRange row={r} />
        </div>
      ) : null}
    </li>
  );
}

export default function UndervaluedFinds() {
  const [rows, setRows] = useState<Row[]>([]);
  const [done, setDone] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
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
                targetHigh: typeof d.targetHigh === "number" ? d.targetHigh : undefined,
                targetLow: typeof d.targetLow === "number" ? d.targetLow : undefined,
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

  const loading = done < total;

  // Group the loaded rows under their curated sector, in the curated order
  // (precious-metals first, tech/AI next, healthcare, then the rest). Within a
  // sector, rank by the analyst-target gap. Sectors with nothing loaded yet are
  // hidden so we never show an empty header.
  const sections = CANDIDATE_SECTORS.map((sec) => ({
    sector: sec,
    rows: rows
      .filter((r) => sec.tickers.includes(r.ticker))
      .sort((a, b) => b.upside - a.upside),
  })).filter((s) => s.rows.length > 0);

  const HEADER = (
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
  );

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Undervalued Finds"
        title="Biggest gaps to analyst fair value, by sector"
        subtitle="A live scan of a curated universe, grouped by sector and ranked by how far each trades below the analysts' average price target. Each sector opens with how it tends to behave if the AI-bubble debate turns; starting with gold miners as the classic safe haven. Tap any row for the analyst bear / base / bull range. Real data; a research starting point, not advice."
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

      {sections.length === 0 && !loading ? (
        <GlassCard className="mt-5 px-5 py-10 text-center text-sm text-slate-500">
          Couldn&apos;t pull analyst data right now; try refreshing in a moment.
        </GlassCard>
      ) : (
        <div className="mt-6 space-y-10">
          {sections.map(({ sector, rows: secRows }, si) => (
            <div key={sector.id}>
              <div className="flex items-baseline gap-3">
                <span className="font-mono text-xs text-gold/70">{String(si + 1).padStart(2, "0")}</span>
                <h3 className="font-display text-lg font-semibold text-white">{sector.name}</h3>
                <span className="text-xs text-slate-500">
                  {secRows.length} name{secRows.length === 1 ? "" : "s"}
                </span>
              </div>
              <p className="mt-2 max-w-4xl text-xs leading-relaxed text-slate-400">{sector.blurb}</p>

              <GlassCard className="mt-4 overflow-hidden">
                {HEADER}
                <ul className="divide-y divide-white/[0.05]">
                  {secRows.map((r, i) => (
                    <ScanRow
                      key={r.ticker}
                      r={r}
                      i={i}
                      isOpen={open === r.ticker}
                      onToggle={() => setOpen(open === r.ticker ? null : r.ticker)}
                    />
                  ))}
                </ul>
              </GlassCard>
            </div>
          ))}
        </div>
      )}

      <p className="mt-8 text-xs text-slate-600">
        &quot;Upside&quot; is the analysts&apos; average price target versus the current price, pulled
        live from public data. It reflects a curated watch-universe, not the entire market, and a high
        target gap is not a recommendation. The sector framings describe general tendencies, not
        forecasts; always do your own research.
      </p>
    </section>
  );
}
