"use client";

import { useEffect, useState } from "react";
import { GlassCard, SectionHeading } from "@/components/quantifi/Cards";

// P/E-vs-price over time. Two lines on one time axis, dual y-axes: the price
// (left) and the approximated trailing P/E (right). The point is to show whether
// today's valuation is high or low against the stock's OWN 5-year history —
// context a single current P/E number can't give. Data + the TTM-EPS maths come
// from /api/pe-history; this component only draws.

interface PePoint {
  t: string;
  price: number;
  pe: number | null;
}
interface PeData {
  available: boolean;
  currency?: string;
  currentPE?: number | null;
  peg?: number | null;
  pe?: { min: number; median: number; max: number };
  series?: PePoint[];
}

const cur = (c?: string) => (c === "INR" ? "₹" : c === "USD" ? "$" : "");

export default function PeRatioChart({ symbol, name }: { symbol: string; name?: string }) {
  const [data, setData] = useState<PeData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setLoading(true);
    (async () => {
      try {
        const r = await fetch(`/api/pe-history/${encodeURIComponent(symbol)}`);
        const d = (await r.json()) as PeData;
        if (!cancelled) setData(d);
      } catch {
        if (!cancelled) setData({ available: false });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // Hide entirely when there's no meaningful history (loss-making names, or
  // listings Yahoo has no quarterly EPS for) — no empty box.
  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
        <div className="h-40 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
      </section>
    );
  }
  if (!data || !data.available || !data.series || data.series.length < 8) return null;

  const series = data.series;
  const prices = series.map((s) => s.price);
  const peSeries = series.filter((s) => s.pe != null && s.pe > 0) as { t: string; price: number; pe: number }[];
  if (peSeries.length < 8) return null;

  const W = 860, H = 340, padX = 12, padTop = 16, padBot = 28;
  const n = series.length;
  const X = (i: number) => padX + (i / (n - 1)) * (W - 2 * padX);

  // Left axis: price
  const pMin = Math.min(...prices), pMax = Math.max(...prices);
  const pSpan = pMax - pMin || 1;
  const Yp = (v: number) => padTop + (1 - (v - pMin) / pSpan) * (H - padTop - padBot);

  // Right axis: P/E — clamp the top to the 95th percentile so one blow-out
  // quarter (near-zero EPS) doesn't flatten the whole line.
  const peOnly = peSeries.map((s) => s.pe).sort((a, b) => a - b);
  const peLo = Math.min(0, peOnly[0]);
  const peHiRaw = peOnly[Math.floor(peOnly.length * 0.95)] ?? peOnly[peOnly.length - 1];
  const peHi = Math.max(peHiRaw, (data.pe?.median ?? 10) * 1.2);
  const peSpan = peHi - peLo || 1;
  const Ype = (v: number) => padTop + (1 - (Math.min(v, peHi) - peLo) / peSpan) * (H - padTop - padBot);

  const priceLine = series.map((s, i) => `${X(i)},${Yp(s.price)}`).join(" ");
  // The P/E line follows the same x-index as its point in the full series.
  const idxOf = new Map(series.map((s, i) => [s.t, i] as const));
  const peLine = peSeries.map((s) => `${X(idxOf.get(s.t) ?? 0)},${Ype(s.pe)}`).join(" ");

  // Median P/E reference line (right axis).
  const medY = data.pe ? Ype(data.pe.median) : null;

  const currentPE = data.currentPE ?? null;
  const median = data.pe?.median ?? null;
  const richVsHistory = currentPE != null && median != null ? currentPE > median : null;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Valuation over time"
        title={`${name ?? symbol} — P/E vs price`}
        subtitle="How the price (blue) and the trailing P/E (amber) have moved over ~5 years, so you can see whether today's valuation is high or low against the company's own history. P/E is approximated from quarterly EPS — research context, not advice."
      />

      <GlassCard className="mt-6 p-5 sm:p-6">
        {/* Stat row */}
        <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2">
          <span className="flex items-center gap-1.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#4F93F7" }} />
            <span className="text-slate-400">Price</span>
          </span>
          <span className="flex items-center gap-1.5 text-sm">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: "#F59E0B" }} />
            <span className="text-slate-400">Trailing P/E</span>
          </span>
          {currentPE != null ? (
            <span className="text-sm text-slate-400">
              Now <span className="font-mono font-semibold text-white">{currentPE.toFixed(1)}×</span>
            </span>
          ) : null}
          {data.pe ? (
            <span className="text-sm text-slate-400">
              5y range{" "}
              <span className="font-mono text-slate-300">
                {data.pe.min.toFixed(0)}–{data.pe.max.toFixed(0)}×
              </span>{" "}
              · median <span className="font-mono text-slate-300">{data.pe.median.toFixed(0)}×</span>
            </span>
          ) : null}
          {data.peg != null ? (
            <span className="text-sm text-slate-400">
              PEG <span className="font-mono font-semibold text-white">{data.peg.toFixed(2)}</span>
            </span>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" style={{ height: 340 }}>
            {/* Median P/E reference */}
            {medY != null ? (
              <>
                <line x1={padX} x2={W - padX} y1={medY} y2={medY} stroke="rgba(245,158,11,0.28)" strokeWidth="1" strokeDasharray="5 5" />
                <text x={W - padX} y={medY - 4} textAnchor="end" className="fill-amber-500/70" style={{ fontSize: 10 }}>
                  median {data.pe?.median.toFixed(0)}×
                </text>
              </>
            ) : null}
            {/* Price line */}
            <polyline fill="none" stroke="#4F93F7" strokeWidth="2" vectorEffect="non-scaling-stroke" points={priceLine} />
            {/* P/E line */}
            <polyline fill="none" stroke="#F59E0B" strokeWidth="2" vectorEffect="non-scaling-stroke" points={peLine} />
            {/* x-axis endpoints */}
            <text x={padX} y={H - 8} className="fill-slate-500" style={{ fontSize: 10 }}>{series[0].t}</text>
            <text x={W - padX} y={H - 8} textAnchor="end" className="fill-slate-500" style={{ fontSize: 10 }}>
              {series[series.length - 1].t}
            </text>
          </svg>
        </div>

        <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
          <span>
            Left axis: price ({cur(data.currency)}). Right axis: trailing P/E (×).
          </span>
          {richVsHistory != null ? (
            <span className={richVsHistory ? "text-amber-400/90" : "text-up/90"}>
              {richVsHistory
                ? "Trading above its 5-year median P/E — richer than usual."
                : "Trading below its 5-year median P/E — cheaper than usual."}
            </span>
          ) : null}
        </div>
      </GlassCard>
    </section>
  );
}
