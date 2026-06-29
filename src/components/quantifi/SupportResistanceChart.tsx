"use client";

import { useEffect, useState } from "react";

const cur = (c?: string, t?: string) =>
  c === "INR" || (t && /\.(NS|BO)$/i.test(t)) ? "₹" : c === "GBp" ? "p" : "$";

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round(p * (sorted.length - 1))));
  return sorted[i];
}

export default function SupportResistanceChart({ symbol, currency }: { symbol: string; currency?: string }) {
  const [vals, setVals] = useState<number[] | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setVals(undefined);
    (async () => {
      try {
        const r = await fetch(`/api/timeseries/${encodeURIComponent(symbol)}?range=6mo`);
        const d = await r.json();
        const pts = Array.isArray(d?.points) ? d.points : [];
        const v = pts.map((p: { value: number }) => p.value).filter((x: number) => typeof x === "number" && isFinite(x));
        if (!cancelled) setVals(v.length >= 5 ? v : null);
      } catch {
        if (!cancelled) setVals(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (vals === undefined) return <div className="mt-4 h-44 animate-pulse rounded-lg bg-white/[0.03]" />;
  if (!vals) return <p className="mt-4 text-sm text-slate-500">Price history not available for this name.</p>;

  const W = 320;
  const H = 170;
  const pad = 6;
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const lo = min - range * 0.06;
  const hi = max + range * 0.06;
  const span = hi - lo;

  const sorted = [...vals].sort((a, b) => a - b);
  const resistance = percentile(sorted, 0.92);
  const support = percentile(sorted, 0.08);

  const x = (i: number) => pad + (i / (vals.length - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - ((v - lo) / span) * (H - pad * 2);

  const line = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const area = `${line} ${x(vals.length - 1).toFixed(1)},${H - pad} ${x(0).toFixed(1)},${H - pad}`;
  const last = vals[vals.length - 1];
  const up = last >= vals[0];
  const stroke = up ? "#34D399" : "#FB7185";
  const decimals = max < 20 ? 3 : 2;

  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="none" style={{ height: 200 }}>
        <defs>
          <linearGradient id={`sr-fill-${symbol}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.18" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Resistance + support dashed lines */}
        <line x1={pad} x2={W - pad} y1={y(resistance)} y2={y(resistance)} stroke="#FB7185" strokeWidth="1" strokeDasharray="5 4" opacity="0.8" />
        <line x1={pad} x2={W - pad} y1={y(support)} y2={y(support)} stroke="#34D399" strokeWidth="1" strokeDasharray="5 4" opacity="0.8" />

        {/* Price area + line */}
        <polygon points={area} fill={`url(#sr-fill-${symbol})`} />
        <polyline points={line} fill="none" stroke={stroke} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      </svg>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-down">
          <span className="inline-block h-px w-4 border-t border-dashed border-down" /> Resistance
          <span className="font-mono text-slate-300">{cur(currency, symbol)}{resistance.toFixed(decimals)}</span>
        </span>
        <span className="flex items-center gap-1.5 text-up">
          <span className="inline-block h-px w-4 border-t border-dashed border-up" /> Support
          <span className="font-mono text-slate-300">{cur(currency, symbol)}{support.toFixed(decimals)}</span>
        </span>
      </div>
      <p className="mt-2 text-[0.65rem] text-slate-500">
        Short-term levels from the last ~6 months of price action — where the price has tended to find a
        ceiling and a floor. Not a forecast.
      </p>
    </div>
  );
}
