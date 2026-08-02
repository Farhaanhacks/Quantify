"use client";

import { useEffect, useState } from "react";
import { fmtPrice } from "@/data/demo";

interface Point {
  d: string;
  v: number;
  p: number;
}

// Share price against the cash-flow (DCF) value, drawn as two bars on one scale
// so the gap between them is the message. The longer bar is the bigger number;
// the shaded strip between the two marks the over/undervaluation.
export function FairValueBars({
  price,
  fair,
  cur,
  outOfRange = false,
}: {
  price: number;
  fair: number;
  cur: string;
  outOfRange?: boolean;
}) {
  const max = Math.max(price, fair) || 1;
  // Never let the smaller bar vanish entirely — at extreme ratios a 0.5% bar is
  // invisible, and the reader loses the anchor for the label sitting on it.
  const pct = (v: number) => Math.max(4, (v / max) * 100);
  const over = price > fair;
  const gapPct = fair > 0 ? ((price - fair) / fair) * 100 : 0;

  return (
    <div>
      {!outOfRange ? (
        <div className="mb-3">
          <div className={`font-display text-3xl font-semibold ${over ? "text-down" : "text-up"}`}>
            {Math.abs(gapPct).toFixed(1)}%
          </div>
          <div className={`text-sm font-medium ${over ? "text-down" : "text-up"}`}>
            {over ? "Overvalued" : "Undervalued"}
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <div className="font-display text-lg font-semibold text-slate-300">
            Beyond a 10-year DCF horizon
          </div>
          <div className="text-sm text-slate-500">
            Shown as context — the model can&apos;t support an over/under call here.
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Bar
          label="Current Price"
          value={price}
          cur={cur}
          widthPct={pct(price)}
          tone={outOfRange ? "neutral" : over ? "down" : "up"}
        />
        <Bar label="Fair Value" value={fair} cur={cur} widthPct={pct(fair)} tone="fair" />
      </div>

      <p className="mt-3 text-[0.7rem] leading-relaxed text-slate-500">
        Fair value from a 2-stage discounted cash flow: ten years of projected free cash flow plus a
        terminal value, discounted at a cost of equity derived from the company&apos;s beta.
        Research only, not advice.
      </p>
    </div>
  );
}

function Bar({
  label,
  value,
  cur,
  widthPct,
  tone,
}: {
  label: string;
  value: number;
  cur: string;
  widthPct: number;
  tone: "up" | "down" | "fair" | "neutral";
}) {
  const fill =
    tone === "fair"
      ? "bg-gradient-to-r from-up/70 to-up/25"
      : tone === "down"
      ? "bg-gradient-to-r from-down/60 to-down/20"
      : tone === "up"
      ? "bg-gradient-to-r from-up/60 to-up/20"
      : "bg-gradient-to-r from-white/15 to-white/[0.06]";

  return (
    <div className="relative h-14 overflow-hidden rounded-md bg-white/[0.03]">
      <div className={`absolute inset-y-0 left-0 ${fill}`} style={{ width: `${widthPct}%` }} />
      {/* The label sits inside the bar when there's room, and just outside it
          when the bar is too short to hold the text. */}
      <div
        className={`absolute inset-y-0 flex flex-col justify-center ${
          widthPct > 34 ? "items-end pr-3" : "items-start pl-3"
        }`}
        style={widthPct > 34 ? { left: 0, width: `${widthPct}%` } : { left: `${widthPct}%` }}
      >
        <span className="whitespace-nowrap text-[0.68rem] uppercase tracking-[0.12em] text-slate-400">
          {label}
        </span>
        <span className="whitespace-nowrap font-mono text-base font-semibold tnum text-white">
          {cur}
          {fmtPrice(value)}
        </span>
      </div>
    </div>
  );
}

// The recorded history of the cash-flow value against the share price. The
// series accumulates one point per day and cannot be back-filled, so until it
// has a few days in it we say so rather than drawing a line from one point.
export function FairValueHistoryChart({
  symbol,
  cur,
}: {
  symbol: string;
  cur: string;
}) {
  const [points, setPoints] = useState<Point[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setPoints(null);
    fetch(`/api/fair-value-history/${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d) => !cancelled && setPoints(Array.isArray(d?.points) ? d.points : []))
      .catch(() => !cancelled && setPoints([]));
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (points == null) {
    return <div className="mt-4 h-32 animate-pulse rounded-lg bg-white/[0.03]" />;
  }

  const latest = points[points.length - 1];
  const gap = latest && latest.v > 0 ? ((latest.v - latest.p) / latest.v) * 100 : 0;

  if (points.length < 2) {
    return (
      <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-5 text-center">
        <p className="text-sm text-slate-300">History starts building from today.</p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
          Each day&apos;s cash-flow value is recorded as it&apos;s computed. It can&apos;t be
          back-filled — the estimate depends on the fundamentals and rates current on the day, and
          drawing today&apos;s model backwards would be a made-up line, not history.
        </p>
      </div>
    );
  }

  const W = 720;
  const H = 140;
  const pad = 8;
  const all = points.flatMap((p) => [p.v, p.p]);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  const X = (i: number) => pad + (i / (points.length - 1)) * (W - 2 * pad);
  const Y = (v: number) => H - pad - ((v - lo) / span) * (H - 2 * pad);
  const path = (key: "v" | "p") => points.map((p, i) => `${X(i)},${Y(p[key])}`).join(" ");

  return (
    <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-display text-sm font-semibold text-white">
          Future cash flow value history
        </h4>
        <div className="flex flex-wrap items-center gap-4 text-[0.7rem]">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-gold" /> Share price
            <span className="font-mono text-slate-300">
              {cur}
              {fmtPrice(latest.p)}
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-teal" /> Cash flow value
            <span className="font-mono text-slate-300">
              {cur}
              {fmtPrice(latest.v)}
            </span>
          </span>
          <span className={gap > 0 ? "text-up" : "text-down"}>
            {Math.abs(gap).toFixed(1)}% {gap > 0 ? "undervalued" : "overvalued"}
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Cash flow value history">
        <polyline points={path("v")} fill="none" stroke="#4FD1C5" strokeWidth="2" />
        <polyline points={path("p")} fill="none" stroke="#D4AF37" strokeWidth="2" />
      </svg>

      <p className="mt-2 text-[0.62rem] text-slate-600">
        {points.length} day{points.length === 1 ? "" : "s"} recorded · builds as the valuation is
        recomputed
      </p>
    </div>
  );
}
