"use client";

import { useEffect, useState } from "react";
import {
  GlassCard,
  SectionHeading,
  TickerChip,
  ScoreRadar,
} from "@/components/quantifi/Cards";
import { usePortfolios } from "@/lib/usePortfolios";
import { SCORE_AXES } from "@/data/demo";
import type { ScoreAxisKey } from "@/data/demo";

const AXIS_COLORS: Record<ScoreAxisKey, string> = {
  value: "#4FD1C5",
  growth: "#E9B872",
  past: "#818CF8",
  health: "#34D399",
  dividends: "#F472B6",
};

interface Scored {
  ticker: string;
  name: string;
  value: number;
  total: number;
  scores: Record<ScoreAxisKey, number>;
}

export default function PortfolioSnowflake({ heading = true }: { heading?: boolean }) {
  const { portfolios, ready } = usePortfolios();
  const holdings = ready ? portfolios[0]?.holdings ?? [] : [];
  const tickersKey = holdings.map((h) => h.ticker.toUpperCase()).sort().join(",");

  const [scored, setScored] = useState<Scored[]>([]);
  const [missing, setMissing] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tickersKey) {
      setScored([]);
      setMissing([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const out: Scored[] = [];
      const miss: string[] = [];
      await Promise.all(
        holdings.map(async (h) => {
          const t = h.ticker.toUpperCase();
          try {
            const r = await fetch(`/api/score/${encodeURIComponent(t)}`);
            const d = await r.json();
            const s = d?.analytics?.scores;
            if (d?.available && s) {
              const scores: Record<ScoreAxisKey, number> = {
                value: s.value?.score ?? 0,
                growth: s.growth?.score ?? 0,
                past: s.past?.score ?? 0,
                health: s.health?.score ?? 0,
                dividends: s.dividends?.score ?? 0,
              };
              out.push({
                ticker: t,
                name: d.name ?? t,
                value: h.shares * h.price,
                total: SCORE_AXES.reduce((acc, ax) => acc + scores[ax.key], 0),
                scores,
              });
            } else {
              miss.push(t);
            }
          } catch {
            miss.push(t);
          }
        })
      );
      if (cancelled) return;
      out.sort((a, b) => b.value - a.value);
      setScored(out);
      setMissing(miss);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey]);

  const totalVal = scored.reduce((s, x) => s + x.value, 0) || 1;
  const agg: Record<ScoreAxisKey, number> = { value: 0, growth: 0, past: 0, health: 0, dividends: 0 };
  for (const x of scored) for (const ax of SCORE_AXES) agg[ax.key] += x.scores[ax.key] * x.value;
  for (const ax of SCORE_AXES) agg[ax.key] = scored.length ? agg[ax.key] / totalVal : 0;
  const aggTotal = SCORE_AXES.reduce((s, ax) => s + agg[ax.key], 0);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Quality snowflake"
          title="How healthy is your portfolio?"
          subtitle="Each holding scored on Value, Future, Past, Financial Health and Dividends, weighted by position size."
        />
      ) : null}

      {holdings.length === 0 ? (
        <GlassCard className="mt-6 p-8 text-center">
          <p className="text-sm text-slate-400">
            Add holdings and Quantifi will score each one and blend them into a portfolio snowflake.
          </p>
        </GlassCard>
      ) : loading && scored.length === 0 ? (
        <p className="mt-6 text-sm text-slate-500">Scoring your holdings…</p>
      ) : scored.length === 0 ? (
        <GlassCard className="mt-6 p-8 text-center">
          <p className="text-sm text-slate-400">
            Couldn&apos;t find fundamental data to score your current holdings
            {missing.length ? ` (${missing.join(", ")})` : ""}.
          </p>
        </GlassCard>
      ) : (
        <GlassCard className="mt-6 p-5 sm:p-6">
          <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
            {/* aggregate snowflake */}
            <div>
              <div className="mx-auto h-[200px] w-[200px]">
                <ScoreRadar
                  values={SCORE_AXES.map((a) => agg[a.key])}
                  labels={SCORE_AXES.map((a) => a.label)}
                  size={190}
                />
              </div>
              <div className="mt-2 text-center">
                <div className="font-mono text-2xl text-gradient-gold">{aggTotal.toFixed(1)}/30</div>
                <div className="text-xs text-slate-500">blended portfolio score</div>
              </div>
            </div>

            {/* per-holding breakdown */}
            <div>
              <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1.5 text-[0.7rem] text-slate-400">
                {SCORE_AXES.map((ax) => (
                  <span key={ax.key} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: AXIS_COLORS[ax.key] }} />
                    {ax.label}
                  </span>
                ))}
              </div>
              <ul className="divide-y divide-white/[0.05]">
                {scored.map((h) => (
                  <li key={h.ticker} className="flex items-center justify-between gap-4 py-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <TickerChip ticker={h.ticker} />
                      <span className="truncate text-sm text-slate-300">{h.name}</span>
                    </div>
                    <div className="flex flex-none items-center gap-4">
                      <div className="flex items-end gap-[3px]" title="Value · Future · Past · Health · Dividends">
                        {SCORE_AXES.map((ax) => (
                          <span
                            key={ax.key}
                            className="relative flex h-5 w-1.5 items-end overflow-hidden rounded-sm bg-white/[0.06]"
                          >
                            <span
                              className="w-full rounded-sm"
                              style={{
                                height: `${(h.scores[ax.key] / 6) * 100}%`,
                                backgroundColor: AXIS_COLORS[ax.key],
                              }}
                            />
                          </span>
                        ))}
                      </div>
                      <span className="w-12 text-right font-mono text-sm tnum text-white">{h.total}/30</span>
                    </div>
                  </li>
                ))}
              </ul>
              {missing.length ? (
                <p className="mt-3 text-xs text-slate-600">
                  No fundamental score available for: {missing.join(", ")}.
                </p>
              ) : null}
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-600">
            Scores are computed from live fundamentals where available. Illustrative, not investment advice.
          </p>
        </GlassCard>
      )}
    </section>
  );
}
