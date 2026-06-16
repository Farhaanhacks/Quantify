"use client";

import { useState } from "react";
import {
  GlassCard,
  SectionHeading,
  TickerChip,
  ChangePill,
  Sparkline,
} from "@/components/quantifi/Cards";
import {
  holdings,
  holdingValue,
  portfolioTotal,
  stockByTicker,
  fmtPrice,
  fmtPct,
  dirOf,
} from "@/data/demo";

export default function PortfolioStocks({
  limit,
  heading = true,
}: {
  limit?: number;
  heading?: boolean;
}) {
  const list = limit ? holdings.slice(0, limit) : holdings;
  const [selectedTicker, setSelectedTicker] = useState(list[0].ticker);
  const selected = holdings.find((h) => h.ticker === selectedTicker) ?? holdings[0];

  const selValue = holdingValue(selected);
  const selWeight = (selValue / portfolioTotal) * 100;
  const selPL = ((selected.price - selected.avgCost) / selected.avgCost) * 100;
  const spark = stockByTicker[selected.ticker]?.spark ?? [1, 2, 3];

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Portfolio Command Center"
          title="Inside your portfolio"
          subtitle="Select a holding to see its weight, unrealized move and recent trend. Demo positions for the prototype."
          href="/portfolio"
          cta="Open command center"
        />
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        {/* Holdings list */}
        <GlassCard className="overflow-hidden">
          <div className="hidden grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] gap-3 border-b border-white/[0.06] px-5 py-3 text-[0.62rem] uppercase tracking-[0.16em] text-slate-500 sm:grid">
            <span>Holding</span>
            <span className="text-right">Weight</span>
            <span className="text-right">Day</span>
            <span className="text-right">Unrealized</span>
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {list.map((h) => {
              const weight = (holdingValue(h) / portfolioTotal) * 100;
              const pl = ((h.price - h.avgCost) / h.avgCost) * 100;
              const isActive = h.ticker === selectedTicker;
              return (
                <li key={h.ticker}>
                  <button
                    type="button"
                    onClick={() => setSelectedTicker(h.ticker)}
                    className={`grid w-full grid-cols-2 gap-3 px-5 py-3.5 text-left transition sm:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] sm:items-center ${
                      isActive ? "bg-gold/[0.06]" : "hover:bg-white/[0.03]"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <TickerChip ticker={h.ticker} active={isActive} />
                      <span className="hidden text-sm text-slate-300 sm:inline">{h.name}</span>
                    </div>
                    <div className="text-right font-mono text-sm tnum text-slate-200">
                      {weight.toFixed(0)}%
                    </div>
                    <div className="flex justify-end">
                      <ChangePill value={stockByTicker[h.ticker]?.changePct ?? 0} size="xs" />
                    </div>
                    <div
                      className={`text-right font-mono text-sm tnum ${
                        pl >= 0 ? "text-up" : "text-down"
                      }`}
                    >
                      {fmtPct(pl)}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </GlassCard>

        {/* Selected detail */}
        <GlassCard className="p-5 sm:p-6">
          <div className="flex items-start justify-between">
            <div>
              <TickerChip ticker={selected.ticker} active />
              <h3 className="mt-2 font-display text-lg font-semibold text-white">{selected.name}</h3>
              <p className="text-xs text-slate-500">
                {selected.sector} · {selected.geo}
              </p>
            </div>
            <div className="text-right">
              <div className="font-mono text-xl tnum text-white">{fmtPrice(selected.price)}</div>
              <div className="mt-1 flex justify-end">
                <ChangePill value={stockByTicker[selected.ticker]?.changePct ?? 0} />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <Sparkline data={spark} dir={dirOf(stockByTicker[selected.ticker]?.changePct ?? 0)} className="h-12 w-full" />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4">
            {[
              { k: "Shares", v: selected.shares.toLocaleString() },
              { k: "Avg cost", v: fmtPrice(selected.avgCost) },
              { k: "Weight", v: `${selWeight.toFixed(1)}%` },
              { k: "Unrealized", v: fmtPct(selPL) },
            ].map((s) => (
              <div key={s.k}>
                <div className="text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">{s.k}</div>
                <div
                  className={`mt-0.5 font-mono text-sm tnum ${
                    s.k === "Unrealized" ? (selPL >= 0 ? "text-up" : "text-down") : "text-white"
                  }`}
                >
                  {s.v}
                </div>
              </div>
            ))}
          </div>

          <p className="mt-4 text-[0.7rem] leading-relaxed text-slate-600">
            Position detail is illustrative. Quantifi highlights weight and risk context — it does
            not recommend buying, selling or holding.
          </p>
        </GlassCard>
      </div>
    </section>
  );
}
