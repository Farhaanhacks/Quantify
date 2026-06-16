"use client";

import { useMemo, useState } from "react";
import {
  GlassCard,
  SectionHeading,
  ChangePill,
  TickerChip,
  Tag,
} from "@/components/quantifi/Cards";
import {
  companyAnalytics,
  stockByTicker,
  overallScore,
  valuationGapPct,
  fmtPrice,
} from "@/data/demo";

type RegionFilter = "All" | "US" | "India";

export default function Screener({ heading = true }: { heading?: boolean }) {
  const [region, setRegion] = useState<RegionFilter>("All");
  const [sector, setSector] = useState<string>("All");
  const [minScore, setMinScore] = useState<number>(0);
  const [onlyUndervalued, setOnlyUndervalued] = useState(false);

  const rows = useMemo(
    () =>
      Object.values(companyAnalytics)
        .map((a) => {
          const stock = stockByTicker[a.ticker];
          return {
            ticker: a.ticker,
            name: stock?.name ?? a.ticker,
            region: stock?.region ?? "US",
            sector: stock?.sector ?? "—",
            price: stock?.price ?? 0,
            changePct: stock?.changePct ?? 0,
            total: overallScore(a),
            gap: valuationGapPct(a.ticker),
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
    return true;
  });

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Screener"
          title="Filter the universe"
          subtitle="Narrow names by region, sector, Quantifi Score and valuation. A discovery starting point — not a recommendation list."
        />
      ) : null}

      {/* Controls */}
      <GlassCard className="mt-6 p-5">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="mb-2 text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
              Region
            </div>
            <div className="flex flex-wrap gap-2">
              {(["All", "US", "India"] as RegionFilter[]).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRegion(r)}
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
            <div className="mb-2 text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
              Sector
            </div>
            <select
              value={sector}
              onChange={(e) => setSector(e.target.value)}
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
              <span>Min score</span>
              <span className="font-mono text-slate-300">{minScore}/30</span>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              value={minScore}
              onChange={(e) => setMinScore(Number(e.target.value))}
              className="w-full accent-gold"
            />
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setOnlyUndervalued((v) => !v)}
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

      {/* Results */}
      <GlassCard className="mt-4 overflow-hidden">
        <div className="hidden grid-cols-[1.5fr_1fr_0.8fr_0.8fr_1fr] gap-3 border-b border-white/[0.06] px-5 py-3 text-[0.62rem] uppercase tracking-[0.16em] text-slate-500 lg:grid">
          <span>Company</span>
          <span>Sector</span>
          <span className="text-right">Price</span>
          <span className="text-right">Score</span>
          <span className="text-right">Valuation</span>
        </div>
        <ul className="divide-y divide-white/[0.05]">
          {filtered.map((r) => {
            const under = r.gap !== null && r.gap > 0;
            return (
              <li
                key={r.ticker}
                className="grid grid-cols-2 gap-3 px-5 py-4 lg:grid-cols-[1.5fr_1fr_0.8fr_0.8fr_1fr] lg:items-center"
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
                <div className="text-right font-mono text-sm tnum text-gradient-gold">
                  {r.total}/30
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
              </li>
            );
          })}
        </ul>
        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No names match these filters. Try loosening the score or valuation filter.
          </div>
        ) : null}
      </GlassCard>
      <p className="mt-3 text-xs text-slate-600">
        Scores and fair values are illustrative demo data for the prototype.
      </p>
    </section>
  );
}
