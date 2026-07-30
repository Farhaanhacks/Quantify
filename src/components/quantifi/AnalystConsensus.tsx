"use client";

import { useEffect, useState } from "react";
import { GlassCard, SectionHeading } from "@/components/quantifi/Cards";
import type { CompanyData } from "@/lib/yahooCompany";
import { fmtPrice, currencySymbol } from "@/data/demo";

// The analyst view as a gauge instead of a word: where the street sits on the
// sell→buy spectrum, how many analysts are behind it, and the target range they
// cover (low / mean / high) against today's price.

// Yahoo's recommendationKey → a 0..1 position on the gauge + display label.
const RATING: Record<string, { pos: number; label: string }> = {
  strong_buy: { pos: 0.92, label: "Strong Buy" },
  buy: { pos: 0.72, label: "Buy" },
  outperform: { pos: 0.72, label: "Outperform" },
  hold: { pos: 0.5, label: "Hold" },
  neutral: { pos: 0.5, label: "Hold" },
  underperform: { pos: 0.28, label: "Underperform" },
  sell: { pos: 0.28, label: "Sell" },
  strong_sell: { pos: 0.08, label: "Strong Sell" },
};

// Five zones across the arc, coloured by market semantics (sell red → hold gold →
// buy green), which stays readable even in a gold-on-black theme.
const ZONES = [
  { from: 0, to: 0.2, color: "#FB7185", label: "Sell" },
  { from: 0.2, to: 0.4, color: "#F0806A" },
  { from: 0.4, to: 0.6, color: "#D4AF37", label: "Hold" },
  { from: 0.6, to: 0.8, color: "#8FCB7A" },
  { from: 0.8, to: 1, color: "#34D399", label: "Buy" },
];

function Gauge({ pos, label }: { pos: number; label: string }) {
  const W = 260;
  const H = 150;
  const cx = W / 2;
  const cy = 128;
  const r = 96;
  const thickness = 20;

  // Map a 0..1 position onto the semicircle (π → 0 radians, i.e. left → right).
  const pt = (p: number, radius: number) => {
    const a = Math.PI - p * Math.PI;
    return [cx + radius * Math.cos(a), cy - radius * Math.sin(a)] as const;
  };
  const arc = (from: number, to: number, radius: number) => {
    const [x0, y0] = pt(from, radius);
    const [x1, y1] = pt(to, radius);
    return `M ${x0} ${y0} A ${radius} ${radius} 0 0 1 ${x1} ${y1}`;
  };

  const [nx, ny] = pt(pos, r - thickness / 2 - 6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W }} role="img" aria-label={`Analyst consensus: ${label}`}>
      {ZONES.map((z) => (
        <path
          key={z.from}
          d={arc(z.from + 0.006, z.to - 0.006, r - thickness / 2)}
          fill="none"
          stroke={z.color}
          strokeWidth={thickness}
          strokeLinecap="butt"
        />
      ))}
      {/* Needle */}
      <line x1={cx} y1={cy} x2={nx} y2={ny} stroke="#fff" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="7" fill="#fff" />
      {/* End labels */}
      <text x={cx - r} y={cy + 16} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 10 }}>Sell</text>
      <text x={cx} y={18} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 10 }}>Hold</text>
      <text x={cx + r} y={cy + 16} textAnchor="middle" className="fill-slate-500" style={{ fontSize: 10 }}>Buy</text>
    </svg>
  );
}

// Verdict sits BELOW the dial as HTML — drawing it inside the arc meant the needle
// could cross straight through the text at some ratings.
function GaugeBlock({ pos, label, analysts }: { pos: number; label: string; analysts?: number }) {
  return (
    <div className="flex flex-col items-center">
      <Gauge pos={pos} label={label} />
      <div className="-mt-1 text-center">
        <div className="font-display text-xl font-semibold text-white">{label}</div>
        {analysts != null ? (
          <div className="text-xs text-slate-400">
            {analysts} analyst{analysts === 1 ? "" : "s"}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function AnalystConsensus({ symbol, name }: { symbol: string; name?: string }) {
  const [data, setData] = useState<CompanyData | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    fetch(`/api/company/${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d: { available?: boolean; data?: CompanyData }) => {
        if (!cancelled) setData(d?.available && d.data ? d.data : null);
      })
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (data === undefined) {
    return (
      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
        <div className="h-52 animate-pulse rounded-lg border border-white/[0.06] bg-white/[0.02]" />
      </section>
    );
  }
  if (!data) return null;

  const rec = data.recommendationKey ? RATING[data.recommendationKey.toLowerCase()] : undefined;
  const { targetLow, targetMean, targetHigh, price } = data;
  const hasTargets = targetMean != null && price != null && price > 0;
  if (!rec && !hasTargets) return null;

  const sym = currencySymbol(data.currency, symbol);
  const label = name ?? data.name ?? symbol;
  const upside = hasTargets ? ((targetMean! - price!) / price!) * 100 : undefined;

  // Position markers on the low→high target range.
  const lo = targetLow ?? Math.min(price ?? 0, targetMean ?? 0);
  const hi = targetHigh ?? Math.max(price ?? 0, targetMean ?? 0);
  const span = hi - lo || 1;
  const pctOf = (v: number) => Math.min(97, Math.max(3, ((v - lo) / span) * 100));

  return (
    <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Analyst view"
        title="What the street thinks"
        subtitle={`The published analyst consensus on ${label} and the price targets behind it — an input to weigh, never a recommendation to act on.`}
      />

      <GlassCard className="mt-6 p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
          {/* Consensus gauge */}
          <div className="flex justify-center">
            {rec ? (
              <GaugeBlock pos={rec.pos} label={rec.label} analysts={data.numberOfAnalysts} />
            ) : (
              <p className="text-sm text-slate-500">No published consensus rating.</p>
            )}
          </div>

          {/* Target range */}
          {hasTargets ? (
            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-sm text-slate-300">Analyst price target</span>
                <span className="flex items-baseline gap-2">
                  <span className="font-mono text-2xl font-semibold text-white">
                    {sym}{fmtPrice(targetMean!)}
                  </span>
                  {upside != null ? (
                    <span className={`font-mono text-sm ${upside >= 0 ? "text-up" : "text-down"}`}>
                      {upside >= 0 ? "+" : ""}{upside.toFixed(1)}%
                    </span>
                  ) : null}
                </span>
              </div>

              {/* low ─ mean ─ high, with each marker labelled in place so there's
                  no guessing which dot is the target and which is today's price.
                  When the price and the target are close (a small implied upside)
                  the two chips would sit on top of each other, so we stack them on
                  separate rows; near either end we anchor the chip inward so it
                  can't overflow the card. */}
              {(() => {
                const pPrice = price != null ? pctOf(price) : null;
                const pMean = pctOf(targetMean!);
                const collide = pPrice != null && Math.abs(pPrice - pMean) < 16;
                // Anchor the label to the marker without spilling past the edges.
                const anchor = (p: number) =>
                  p < 12 ? "translate-x-0" : p > 88 ? "-translate-x-full" : "-translate-x-1/2";
                return (
                  <div className={`relative h-2 rounded-full bg-gradient-to-r from-down/40 via-gold/40 to-up/40 ${collide ? "mt-16" : "mt-10"}`}>
                    {pPrice != null ? (
                      <span className="absolute" style={{ left: `${pPrice}%` }}>
                        <span
                          className={`absolute whitespace-nowrap rounded border border-white/20 bg-ink-800 px-1.5 py-0.5 font-mono text-[0.65rem] text-white ${anchor(pPrice)}`}
                          style={{ top: collide ? "-3.6rem" : "-1.8rem" }}
                        >
                          {sym}{fmtPrice(price!)}
                        </span>
                        <span className="absolute -top-1 h-4 w-0.5 -translate-x-1/2 rounded bg-white" />
                      </span>
                    ) : null}
                    <span className="absolute" style={{ left: `${pMean}%` }}>
                      <span
                        className={`absolute whitespace-nowrap rounded border border-gold/50 bg-gold/15 px-1.5 py-0.5 font-mono text-[0.65rem] font-semibold text-gold ${anchor(pMean)}`}
                        style={{ top: "-1.8rem" }}
                      >
                        {sym}{fmtPrice(targetMean!)}
                      </span>
                      <span className="absolute -top-1.5 h-5 w-5 -translate-x-1/2 rounded-full border-2 border-gold bg-gold/30 shadow-[0_0_0_3px_rgba(212,175,55,0.15)]" />
                    </span>
                  </div>
                );
              })()}
              <div className="mt-3 flex justify-between text-[0.7rem] text-slate-500">
                <span className="font-mono">Low {sym}{fmtPrice(lo)}</span>
                <span className="font-mono">High {sym}{fmtPrice(hi)}</span>
              </div>

              <div className="mt-4 flex flex-wrap gap-4 text-[0.7rem] text-slate-400">
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-0.5 bg-white" /> Current price
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full border-2 border-gold bg-gold/30" /> Mean target
                </span>
              </div>
            </div>
          ) : null}
        </div>

        <p className="mt-5 text-xs leading-relaxed text-slate-500">
          Consensus and targets are what sell-side analysts have published; they are frequently revised and often
          lag events. Research context, not advice.
        </p>
      </GlassCard>
    </section>
  );
}
