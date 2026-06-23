"use client";

import {
  GlassCard,
  SectionHeading,
  ScoreRadar,
  TickerChip,
  Tag,
} from "@/components/quantifi/Cards";
import type { EtfData } from "@/lib/yahooEtf";

function axisColor(score: number): string {
  if (score >= 5) return "#34D399";
  if (score >= 3) return "#E9B872";
  return "#FB7185";
}

const cur = (c?: string) =>
  c === "INR" ? "₹" : c === "GBP" ? "£" : c === "EUR" ? "€" : "$";

const pct = (x: number | undefined, dp = 1): string =>
  x == null ? "—" : `${(x * 100).toFixed(dp)}%`;

const aum = (n: number | undefined): string => {
  if (n == null || n <= 0) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
};

const money = (n: number | undefined, c?: string): string =>
  n == null ? "—" : `${cur(c)}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function EtfSnapshot({
  etf,
  heading = true,
}: {
  etf: EtfData;
  heading?: boolean;
}) {
  const radarValues = etf.rating.map((a) => a.score);
  const radarLabels = etf.rating.map((a) => a.label.split(" ")[0]);

  const stats: { label: string; value: string }[] = [
    { label: "Expense ratio", value: pct(etf.expenseRatio, 2) },
    { label: "Yield", value: pct(etf.yield) },
    { label: "Assets", value: aum(etf.totalAssets) },
    { label: "YTD return", value: pct(etf.ytdReturn) },
    { label: "1Y return", value: pct(etf.oneYearReturn) },
    { label: "3Y return", value: pct(etf.threeYearReturn) },
  ];

  // Allocation (stock / bond / cash) — only render bars we actually have.
  const alloc = [
    { label: "Stocks", value: etf.stockPosition, color: "#4FD1C5" },
    { label: "Bonds", value: etf.bondPosition, color: "#E9B872" },
    { label: "Cash", value: etf.cashPosition, color: "#94A3B8" },
  ].filter((a) => typeof a.value === "number" && a.value! > 0);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="ETF X-ray"
          title="What this fund actually holds"
          subtitle="An ETF isn't a company — it's a basket. So we rate it on what matters for a fund: what it holds, how concentrated it is, what it costs, its size, momentum and income. Educational research view — not advice."
        />
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Rating snowflake + overall */}
        <GlassCard className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <TickerChip ticker={etf.symbol} active />
                <Tag tone="teal">{etf.kind}</Tag>
              </div>
              <div className="mt-2 truncate font-display text-lg font-semibold text-white">
                {etf.name}
              </div>
              <div className="truncate text-xs text-slate-500">
                {[etf.family, etf.category].filter(Boolean).join(" · ") || "Fund"}
              </div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-semibold tnum text-gradient-gold">
                {etf.overall}
                <span className="text-base text-slate-500">/30</span>
              </div>
              <div className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                ETF rating · live
              </div>
            </div>
          </div>
          <div className="mx-auto mt-2 max-w-[260px]">
            <ScoreRadar values={radarValues} labels={radarLabels} />
          </div>
        </GlassCard>

        {/* Per-axis ratings */}
        <GlassCard className="p-5 sm:p-6">
          <div className="space-y-2.5">
            {etf.rating.map((a) => {
              const p = (a.score / 6) * 100;
              return (
                <div
                  key={a.key}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-slate-200">{a.label}</span>
                    <span className="flex items-center gap-3">
                      <span className="hidden h-2 w-28 overflow-hidden rounded-full bg-white/[0.06] sm:block">
                        <span
                          className="block h-full rounded-full"
                          style={{ width: `${p}%`, backgroundColor: axisColor(a.score) }}
                        />
                      </span>
                      <span className="font-mono text-sm tnum text-white">{a.score}/6</span>
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">{a.detail}</p>
                </div>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* Key stats */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {stats.map((s) => (
          <GlassCard key={s.label} className="p-4">
            <div className="text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
              {s.label}
            </div>
            <div className="mt-1 font-mono text-base tnum text-white">{s.value}</div>
          </GlassCard>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Top holdings */}
        <GlassCard className="p-5 sm:p-6">
          <div className="flex items-baseline justify-between">
            <h4 className="font-display text-base font-semibold text-white">Top holdings</h4>
            {etf.topHoldingsWeight != null ? (
              <span className="text-xs text-slate-500">
                {pct(etf.topHoldingsWeight)} of fund
              </span>
            ) : null}
          </div>
          {etf.topHoldings.length ? (
            <ul className="mt-3 space-y-2">
              {etf.topHoldings.map((h) => (
                <li key={h.symbol || h.name} className="flex items-center gap-3">
                  <span className="w-16 flex-none font-mono text-xs text-gold">
                    {h.symbol || "—"}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-300">
                    {h.name}
                  </span>
                  <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-white/[0.06] sm:block">
                    <span
                      className="block h-full rounded-full bg-teal"
                      style={{ width: `${Math.min(100, h.weight * 100 * 4)}%` }}
                    />
                  </span>
                  <span className="w-12 flex-none text-right font-mono text-xs tnum text-slate-300">
                    {pct(h.weight)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Holdings breakdown isn&apos;t published for this fund.
            </p>
          )}
        </GlassCard>

        {/* Sector mix + allocation */}
        <GlassCard className="p-5 sm:p-6">
          <h4 className="font-display text-base font-semibold text-white">Sector mix</h4>
          {etf.sectorWeights.length ? (
            <ul className="mt-3 space-y-2">
              {etf.sectorWeights.slice(0, 8).map((s) => (
                <li key={s.sector} className="flex items-center gap-3">
                  <span className="w-36 flex-none truncate text-sm text-slate-300">
                    {s.sector}
                  </span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className="block h-full rounded-full bg-gold"
                      style={{ width: `${Math.min(100, s.weight * 100 * 2)}%` }}
                    />
                  </span>
                  <span className="w-12 flex-none text-right font-mono text-xs tnum text-slate-300">
                    {pct(s.weight)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Sector breakdown isn&apos;t published.</p>
          )}

          {alloc.length ? (
            <div className="mt-5 border-t border-white/[0.06] pt-4">
              <div className="text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
                Asset allocation
              </div>
              <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-white/[0.06]">
                {alloc.map((a) => (
                  <span
                    key={a.label}
                    style={{ width: `${a.value! * 100}%`, backgroundColor: a.color }}
                    title={`${a.label} ${pct(a.value)}`}
                  />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[0.7rem] text-slate-400">
                {alloc.map((a) => (
                  <span key={a.label} className="flex items-center gap-1.5">
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: a.color }}
                    />
                    {a.label} {pct(a.value)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {etf.holdingsPE != null || etf.holdingsPB != null ? (
            <div className="mt-4 flex gap-6 border-t border-white/[0.06] pt-4 text-xs text-slate-400">
              {etf.holdingsPE != null ? (
                <span>
                  Basket P/E{" "}
                  <span className="font-mono text-slate-200">{etf.holdingsPE.toFixed(1)}x</span>
                </span>
              ) : null}
              {etf.holdingsPB != null ? (
                <span>
                  Basket P/B{" "}
                  <span className="font-mono text-slate-200">{etf.holdingsPB.toFixed(1)}x</span>
                </span>
              ) : null}
              {etf.navPrice != null ? (
                <span>
                  NAV <span className="font-mono text-slate-200">{money(etf.navPrice, etf.currency)}</span>
                </span>
              ) : null}
            </div>
          ) : null}
        </GlassCard>
      </div>

      {/* Rewards / flags */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <GlassCard className="p-5 sm:p-6">
          <h4 className="font-display text-base font-semibold text-up">What works</h4>
          <ul className="mt-3 space-y-2.5">
            {etf.rewards.map((r, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-300">
                <span className="mt-0.5 text-up">+</span>
                <span className="leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
        <GlassCard className="p-5 sm:p-6">
          <h4 className="font-display text-base font-semibold text-down">Watch-outs</h4>
          <ul className="mt-3 space-y-2.5">
            {etf.riskFlags.map((r, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-300">
                <span className="mt-0.5 text-down">!</span>
                <span className="leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </section>
  );
}
