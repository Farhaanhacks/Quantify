"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  GlassCard,
  SectionHeading,
  TickerChip,
  Tag,
  ScoreRadar,
} from "@/components/quantifi/Cards";
import { SCORE_AXES, fmtPrice } from "@/data/demo";
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

interface UniverseEntry {
  ticker: string;
  name: string;
  region: Exclude<RegionFilter, "All">;
  sector: string;
}

// Real, liquid names the screener scores LIVE from current fundamentals
// (via /api/score, which pulls Yahoo Finance). Region + sector are kept
// locally so the filters stay stable and meaningful; price, the snowflake
// scores and the valuation gap all come from the live fetch.
const SCREENER_UNIVERSE: UniverseEntry[] = [
  { ticker: "NVDA", name: "NVIDIA Corp.", region: "US", sector: "Semiconductors" },
  { ticker: "MSFT", name: "Microsoft Corp.", region: "US", sector: "Software" },
  { ticker: "AMZN", name: "Amazon.com Inc.", region: "US", sector: "E-commerce" },
  { ticker: "GOOGL", name: "Alphabet Inc.", region: "US", sector: "Internet" },
  { ticker: "META", name: "Meta Platforms", region: "US", sector: "Internet" },
  { ticker: "AAPL", name: "Apple Inc.", region: "US", sector: "Hardware" },
  { ticker: "AVGO", name: "Broadcom Inc.", region: "US", sector: "Semiconductors" },
  { ticker: "AMD", name: "Advanced Micro Devices", region: "US", sector: "Semiconductors" },
  { ticker: "ORCL", name: "Oracle Corp.", region: "US", sector: "Software" },
  { ticker: "CRM", name: "Salesforce Inc.", region: "US", sector: "Software" },
  { ticker: "NFLX", name: "Netflix Inc.", region: "US", sector: "Media" },
  { ticker: "PLTR", name: "Palantir Technologies", region: "US", sector: "Software" },
  { ticker: "TSLA", name: "Tesla Inc.", region: "US", sector: "Autos" },
  { ticker: "RKLB", name: "Rocket Lab", region: "US", sector: "Aerospace" },
  { ticker: "ASTS", name: "AST SpaceMobile", region: "US", sector: "Aerospace" },
  { ticker: "TCS.NS", name: "Tata Consultancy Services", region: "India", sector: "IT Services" },
  { ticker: "INFY.NS", name: "Infosys Ltd.", region: "India", sector: "IT Services" },
  { ticker: "RELIANCE.NS", name: "Reliance Industries", region: "India", sector: "Conglomerate" },
  { ticker: "HDFCBANK.NS", name: "HDFC Bank", region: "India", sector: "Banking" },
  { ticker: "ICICIBANK.NS", name: "ICICI Bank", region: "India", sector: "Banking" },
  { ticker: "BHARTIARTL.NS", name: "Bharti Airtel", region: "India", sector: "Telecom" },
];

interface Row {
  ticker: string;
  name: string;
  region: Exclude<RegionFilter, "All">;
  sector: string;
  price: number | null;
  total: number;
  gap: number | null; // % upside/downside vs estimated fair value
  scores: Record<ScoreAxisKey, number>;
  analytics: CompanyAnalytics;
  live: boolean;
}

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

const CONCURRENCY = 5;

export default function Screener({ heading = true }: { heading?: boolean }) {
  const [region, setRegion] = useState<RegionFilter>("All");
  const [sector, setSector] = useState<string>("All");
  const [minScore, setMinScore] = useState<number>(0);
  const [minAxis, setMinAxis] = useState<Record<ScoreAxisKey, number>>(ZERO_AXIS);
  const [onlyUndervalued, setOnlyUndervalued] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // Score the whole universe live from current fundamentals, with limited
  // concurrency and progressive render so rows appear as they resolve.
  useEffect(() => {
    let cancelled = false;
    const queue = [...SCREENER_UNIVERSE];
    const collected: Row[] = [];

    const flush = () => {
      if (cancelled) return;
      setRows([...collected].sort((a, b) => b.total - a.total));
    };

    async function worker() {
      for (;;) {
        const entry = queue.shift();
        if (!entry) return;
        try {
          const res = await fetch(`/api/score/${encodeURIComponent(entry.ticker)}`);
          const d = await res.json();
          if (cancelled) return;
          if (!d?.available || !d?.analytics?.scores) continue;
          const a = d.analytics as CompanyAnalytics;
          const scores: Record<ScoreAxisKey, number> = {
            value: a.scores.value.score,
            growth: a.scores.growth.score,
            past: a.scores.past.score,
            health: a.scores.health.score,
            dividends: a.scores.dividends.score,
          };
          const total = SCORE_AXES.reduce((s, ax) => s + scores[ax.key], 0);
          const price = typeof d.price === "number" ? d.price : null;
          const fv = a.fairValue?.estimate;
          const gap =
            price && price > 0 && typeof fv === "number" && fv > 0
              ? ((fv - price) / price) * 100
              : null;
          collected.push({
            ticker: entry.ticker,
            name: typeof d.name === "string" && d.name ? d.name : entry.name,
            region: entry.region,
            sector: entry.sector,
            price,
            total,
            gap,
            scores,
            analytics: a,
            live: Boolean(d.live),
          });
          flush();
        } catch {
          // Skip a name that fails to fetch — the rest still render.
        }
      }
    }

    Promise.all(Array.from({ length: CONCURRENCY }, () => worker())).then(() => {
      if (!cancelled) setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const sectors = useMemo(
    () => ["All", ...Array.from(new Set(SCREENER_UNIVERSE.map((s) => s.sector)))],
    []
  );

  const liveCount = rows.filter((r) => r.live).length;

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
          subtitle="Narrow names by region, sector, the Quantifi snowflake and valuation. Every score is computed live from current fundamentals — a discovery starting point, not a recommendation list."
        />
      ) : null}

      {/* Live status */}
      <div className="mt-5 flex items-center gap-2 text-xs text-slate-400">
        <span
          className={`inline-flex h-2 w-2 rounded-full ${
            loading ? "animate-pulse bg-gold" : "bg-up"
          }`}
        />
        {loading ? (
          <span>
            Scoring live from current fundamentals… {rows.length}/{SCREENER_UNIVERSE.length} names
          </span>
        ) : (
          <span>
            {liveCount} of {rows.length} names scored live from current fundamentals
            {liveCount < rows.length ? " · the rest on a cached estimate" : ""}
          </span>
        )}
      </div>

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
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
        <div className="mt-4 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
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
                <div className="text-right font-mono text-sm tnum text-white">
                  {r.price !== null ? fmtPrice(r.price) : "—"}
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
                      <div className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
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
                    <div className="mt-4 flex justify-end">
                      <Link
                        href={`/stock-analysis?symbol=${encodeURIComponent(r.ticker)}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-xs text-gold underline-offset-2 hover:underline"
                      >
                        Open full analysis →
                      </Link>
                    </div>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>

        {filtered.length === 0 && loading ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            Scoring names from live fundamentals…
          </div>
        ) : null}
        {filtered.length === 0 && !loading ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No names match these filters. Try loosening a snowflake axis, the score, or the valuation filter.
          </div>
        ) : null}
      </GlassCard>
      <p className="mt-3 text-xs text-slate-600">
        Tap any row to open its snowflake. Scores and fair values are computed live from current
        fundamentals when you load this screen; a name briefly falls back to a cached estimate only if
        live data is unavailable. Open any stock on the{" "}
        <Link href="/stock-analysis" className="text-slate-400 underline-offset-2 hover:text-gold hover:underline">
          Stock Analysis
        </Link>{" "}
        page for the full breakdown. A research starting point, not advice.
      </p>
    </section>
  );
}
