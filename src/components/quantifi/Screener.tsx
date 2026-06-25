"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  GlassCard,
  SectionHeading,
  ChangePill,
  TickerChip,
  Tag,
  ScoreRadar,
} from "@/components/quantifi/Cards";
import {
  companyAnalytics,
  stockByTicker,
  overallScore,
  valuationGapPct,
  fmtPrice,
  SCORE_AXES,
} from "@/data/demo";
import type { ScoreAxisKey, CompanyAnalytics } from "@/data/demo";

type RegionFilter = "All" | "US" | "India";

const AXIS_COLORS: Record<ScoreAxisKey, string> = {
  value: "#4FD1C5",
  growth: "#E9B872",
  past: "#818CF8",
  health: "#34D399",
  dividends: "#F472B6",
};

const ZERO_AXIS: Record<ScoreAxisKey, number> = {
  value: 0,
  growth: 0,
  past: 0,
  health: 0,
  dividends: 0,
};

interface Preset {
  name: string;
  desc: string;
  region?: RegionFilter;
  minScore?: number;
  minAxis?: Partial<Record<ScoreAxisKey, number>>;
  under?: boolean;
}

const PRESETS: Preset[] = [
  { name: "Dividend Powerhouses", desc: "Strong, well-covered dividends", minAxis: { dividends: 4 } },
  { name: "Undervalued on cash flows", desc: "Cheap vs DCF fair value", minAxis: { value: 4 }, under: true },
  { name: "High-growth names", desc: "Top future-growth scores", minAxis: { growth: 5 } },
  { name: "Rock-solid balance sheets", desc: "Strongest financial health", minAxis: { health: 6 } },
  { name: "Quality compounders", desc: "Great track record + healthy", minAxis: { past: 5, health: 5 } },
  { name: "Top overall", desc: "Highest total Quantifi Score", minScore: 22 },
];

export default function Screener({ heading = true }: { heading?: boolean }) {
  const [region, setRegion] = useState<RegionFilter>("All");
  const [sector, setSector] = useState<string>("All");
  const [minScore, setMinScore] = useState<number>(0);
  const [minAxis, setMinAxis] = useState<Record<ScoreAxisKey, number>>(ZERO_AXIS);
  const [onlyUndervalued, setOnlyUndervalued] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      Object.values(companyAnalytics)
        .map((a) => {
          const stock = stockByTicker[a.ticker];
          const scores: Record<ScoreAxisKey, number> = {
            value: a.scores.value.score,
            growth: a.scores.growth.score,
            past: a.scores.past.score,
            health: a.scores.health.score,
            dividends: a.scores.dividends.score,
          };
          return {
            ticker: a.ticker,
            name: stock?.name ?? a.ticker,
            region: stock?.region ?? "US",
            sector: stock?.sector ?? "—",
            price: stock?.price ?? 0,
            changePct: stock?.changePct ?? 0,
            total: overallScore(a),
            gap: valuationGapPct(a.ticker),
            scores,
            analytics: a as CompanyAnalytics,
          };
        })
        .sort((x, y) => y.total - x.total),
    []
  );

  const sectors = useMemo(
    () => ["All", ...Array.from(new Set(rows.map((r) => r.sector)))],
    [rows]
  );

  const filtered = rows.filter((r) => {
    if (region !== "All" && r.region !== region) return false;
    if (sector !== "All" && r.sector !== sector) return false;
    if (r.total < minScore) return false;
    if (onlyUndervalued && !(r.gap !== null && r.gap > 0)) return false;
    for (const ax of SCORE_AXES) if (r.scores[ax.key] < minAxis[ax.key]) return false;
    return true;
  });

  const clearTouch = () => setActivePreset(null);

  const applyPreset = (p: Preset) => {
    setActivePreset(p.name);
    setRegion(p.region ?? "All");
    setSector("All");
    setMinScore(p.minScore ?? 0);
    setMinAxis({ ...ZERO_AXIS, ...(p.minAxis ?? {}) });
    setOnlyUndervalued(p.under ?? false);
    setExpanded(null);
  };

  const resetAll = () => {
    setActivePreset(null);
    setRegion("All");
    setSector("All");
    setMinScore(0);
    setMinAxis(ZERO_AXIS);
    setOnlyUndervalued(false);
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Screener"
          title="Filter the universe"
          subtitle="Narrow names by region, sector, the Quantifi snowflake and valuation. A discovery starting point — not a recommendation list."
        />
      ) : null}

      {/* Popular screens */}
      <div className="mt-6">
        <div className="mb-2 text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
          Popular screens
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-1">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              onClick={() => applyPreset(p)}
              className={`flex min-w-[200px] flex-none items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                activePreset === p.name
                  ? "border-gold/50 bg-gold/[0.1]"
                  : "border-white/10 bg-white/[0.03] hover:border-white/20"
              }`}
            >
              <span className="grid h-9 w-9 flex-none place-items-center rounded-full border border-gold/30 bg-gold/10 text-gold">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="9" />
                  <circle cx="12" cy="12" r="4.5" />
                  <circle cx="12" cy="12" r="1" fill="currentColor" />
                </svg>
              </span>
              <span>
                <span className="block text-sm font-medium text-white">{p.name}</span>
                <span className="block text-xs text-slate-400">{p.desc}</span>
              </span>
            </button>
          ))}
          <button
            type="button"
            onClick={resetAll}
            className="flex-none rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm text-slate-400 transition hover:text-white"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Controls */}
      <GlassCard className="mt-4 p-5">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-2 text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">Region</div>
            <div className="flex flex-wrap gap-2">
              {(["All", "US", "India"] as RegionFilter[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => {
                    setRegion(r);
                    clearTouch();
                  }}
                  className={`rounded-full border px-3 py-1.5 text-xs transition ${
                    region === r
                      ? "border-gold/50 bg-gold/15 text-gold"
                      : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">Sector</div>
            <select
              value={sector}
              onChange={(e) => {
                setSector(e.target.value);
                clearTouch();
              }}
              className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-slate-200 outline-none focus:border-gold/40"
            >
              {sectors.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
              <span>Min total score</span>
              <span className="font-mono text-slate-300">{minScore}/30</span>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              value={minScore}
              onChange={(e) => {
                setMinScore(Number(e.target.value));
                clearTouch();
              }}
              className="w-full accent-gold"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setOnlyUndervalued((v) => !v);
                clearTouch();
              }}
              className={`w-full rounded-lg border px-3 py-2 text-sm transition ${
                onlyUndervalued
                  ? "border-up/40 bg-up/10 text-up"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
              }`}
            >
              {onlyUndervalued ? "✓ " : ""}Below fair value only
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Snowflake filter */}
      <GlassCard className="mt-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-white">Snowflake filter</h3>
          <span className="text-xs text-slate-500">Minimum score per axis · 0–6</span>
        </div>
        <div className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
          {SCORE_AXES.map((axdef) => (
            <div key={axdef.key}>
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-300">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: AXIS_COLORS[axdef.key] }} />
                  {axdef.label}
                </span>
                <span className="font-mono text-slate-400">≥ {minAxis[axdef.key]}</span>
              </div>
              <input
                type="range"
                min={0}
                max={6}
                value={minAxis[axdef.key]}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setMinAxis((prev) => ({ ...prev, [axdef.key]: v }));
                  clearTouch();
                }}
                className="w-full accent-gold"
              />
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Results */}
      <GlassCard className="mt-4 overflow-hidden">
        <div className="hidden grid-cols-[1.4fr_0.9fr_0.8fr_0.7fr_0.8fr_0.9fr] gap-3 border-b border-white/[0.06] px-5 py-3 text-[0.62rem] uppercase tracking-[0.16em] text-slate-500 lg:grid">
          <span>Company</span>
          <span>Sector</span>
          <span className="text-right">Price</span>
          <span className="text-right">Score</span>
          <span className="text-center">Snowflake</span>
          <span className="text-right">Valuation</span>
        </div>
        <ul className="divide-y divide-white/[0.05]">
          {filtered.map((r) => {
            const under = r.gap !== null && r.gap > 0;
            const isOpen = expanded === r.ticker;
            return (
              <li
                key={r.ticker}
                onClick={() => setExpanded(isOpen ? null : r.ticker)}
                className="grid cursor-pointer grid-cols-2 gap-3 px-5 py-4 transition hover:bg-white/[0.02] lg:grid-cols-[1.4fr_0.9fr_0.8fr_0.7fr_0.8fr_0.9fr] lg:items-center"
              >
                <div className="flex items-center gap-2.5">
                  <TickerChip ticker={r.ticker} />
                  <span className="hidden text-sm text-slate-300 sm:inline">{r.name}</span>
                </div>
                <div className="text-xs text-slate-400">{r.sector}</div>
                <div className="text-right">
                  <div className="font-mono text-sm tnum text-white">${fmtPrice(r.price)}</div>
                  <div className="flex justify-end">
                    <ChangePill value={r.changePct} size="xs" />
                  </div>
                </div>
                <div className="text-right font-mono text-sm tnum text-gradient-gold">{r.total}/30</div>
                <div className="flex items-end justify-center gap-[3px]" title="Value · Future · Past · Health · Dividends">
                  {SCORE_AXES.map((axdef) => (
                    <span
                      key={axdef.key}
                      className="relative flex h-5 w-1.5 items-end overflow-hidden rounded-sm bg-white/[0.06]"
                    >
                      <span
                        className="w-full rounded-sm"
                        style={{
                          height: `${(r.scores[axdef.key] / 6) * 100}%`,
                          backgroundColor: AXIS_COLORS[axdef.key],
                        }}
                      />
                    </span>
                  ))}
                </div>
                <div className="flex justify-end">
                  {r.gap !== null ? (
                    <Tag tone={under ? "up" : "down"}>
                      {under ? "Below" : "Above"} · {Math.abs(r.gap).toFixed(0)}%
                    </Tag>
                  ) : (
                    <span className="text-xs text-slate-600">—</span>
                  )}
                </div>

                {isOpen ? (
                  <div className="col-span-2 mt-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 lg:col-span-6">
                    <div className="grid gap-5 sm:grid-cols-[190px_1fr]">
                      <div className="mx-auto h-[180px] w-[180px]">
                        <ScoreRadar
                          values={SCORE_AXES.map((a) => r.scores[a.key])}
                          labels={SCORE_AXES.map((a) => a.label)}
                          size={170}
                        />
                      </div>
                      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
                        {SCORE_AXES.map((axdef) => (
                          <div key={axdef.key}>
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5 font-medium" style={{ color: AXIS_COLORS[axdef.key] }}>
                                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: AXIS_COLORS[axdef.key] }} />
                                {axdef.label}
                              </span>
                              <span className="font-mono text-slate-400">{r.scores[axdef.key]}/6</span>
                            </div>
                            <ul className="mt-1 space-y-0.5">
                              {r.analytics.scores[axdef.key].checks.map((chk, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                                  <span className={chk.pass ? "text-up" : "text-slate-600"}>{chk.pass ? "✓" : "·"}</span>
                                  {chk.label}
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No names match these filters. Try loosening a snowflake axis, the score, or the valuation filter.
          </div>
        ) : null}
      </GlassCard>
      <p className="mt-3 text-xs text-slate-600">
        Tap any row to open its snowflake. The screener covers a curated set of names; the scores and fair
        values here are illustrative examples — open any stock on the{" "}
        <Link href="/stock-analysis" className="text-slate-400 underline-offset-2 hover:text-gold hover:underline">
          Stock Analysis
        </Link>{" "}
        page for a live score computed from current fundamentals. A research starting point, not advice.
      </p>
    </section>
  );
}
