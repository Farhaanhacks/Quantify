"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  GlassCard,
  SectionHeading,
  TickerChip,
  ChangePill,
  Sparkline,
} from "@/components/quantifi/Cards";
import { stockByTicker, fmtPrice, fmtPct, dirOf } from "@/data/demo";
import { usePortfolios, resolveName } from "@/lib/usePortfolios";

interface Row {
  ticker: string;
  name: string;
  sector?: string;
  geo?: string;
  shares: number;
  avgCost: number;
  price: number;
  currency: string;
  dayPct: number | null;
  spark: number[] | null;
}

const curSym = (c: string) => (c === "INR" ? "₹" : "$");

export default function PortfolioStocks({
  limit,
  heading = true,
}: {
  limit?: number;
  heading?: boolean;
}) {
  const { portfolios, ready } = usePortfolios();
  const saved = ready ? portfolios[0]?.holdings ?? [] : [];
  const hasHoldings = saved.length > 0;

  const [quotes, setQuotes] = useState<Record<string, { price: number; currency?: string; name?: string }>>({});
  const savedKey = saved.map((h) => h.ticker).join(",");

  useEffect(() => {
    if (!savedKey) return;
    let cancelled = false;
    saved.forEach(async (h) => {
      try {
        const r = await fetch(`/api/quote/${encodeURIComponent(h.ticker)}`);
        const d = await r.json();
        if (!cancelled && d.valid && typeof d.price === "number") {
          setQuotes((q) => ({ ...q, [h.ticker]: { price: d.price, currency: d.currency, name: d.name } }));
        }
      } catch {
        /* keep stored price */
      }
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const rows: Row[] = useMemo(
    () =>
      saved.map((h) => {
        const q = quotes[h.ticker];
        const sd = stockByTicker[h.ticker.toUpperCase()];
        return {
          ticker: h.ticker,
          name: q?.name ?? resolveName(h.ticker) ?? h.ticker,
          sector: sd?.sector,
          geo: sd?.region,
          shares: h.shares,
          avgCost: h.avgCost,
          price: q?.price ?? h.price,
          currency: q?.currency ?? (/\.(NS|BO)$/i.test(h.ticker) ? "INR" : "USD"),
          dayPct: sd?.changePct ?? null,
          spark: sd?.spark ?? null,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savedKey, quotes]
  );

  const total = rows.reduce((s, r) => s + r.shares * r.price, 0) || 1;
  const list = limit ? rows.slice(0, limit) : rows;
  const listKey = list.map((r) => r.ticker).join(",");

  const [selectedTicker, setSelectedTicker] = useState("");
  useEffect(() => {
    if (list.length && !list.find((r) => r.ticker === selectedTicker)) {
      setSelectedTicker(list[0].ticker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  const selected = list.find((r) => r.ticker === selectedTicker) ?? list[0];
  const selValue = selected ? selected.shares * selected.price : 0;
  const selWeight = (selValue / total) * 100;
  const selPL = selected ? ((selected.price - selected.avgCost) / selected.avgCost) * 100 : 0;
  const spark = selected?.spark ?? [1, 1, 1];

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Portfolio Command Center"
          title="Inside your portfolio"
          subtitle={
            hasHoldings
              ? "Your saved holdings, live. Edit them in the command center and they update here."
              : "You haven't added any holdings yet. Build a portfolio and it shows up here, live."
          }
          href="/portfolio"
          cta="Open command center"
        />
      ) : null}

      {!ready ? (
        <GlassCard className="mt-6 p-8 text-center text-sm text-slate-500">Loading…</GlassCard>
      ) : !hasHoldings || !selected ? (
        <GlassCard className="mt-6 p-10 text-center">
          <p className="text-sm text-slate-300">No holdings yet — start your own portfolio.</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
            Add real tickers and Quantifi tracks weight, unrealized gain/loss and live moves for you.
            Nothing is here until you add it.
          </p>
          <Link
            href="/portfolio"
            className="mt-5 inline-flex rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-5 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Build your portfolio →
          </Link>
        </GlassCard>
      ) : (
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
                const weight = ((h.shares * h.price) / total) * 100;
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
                        {h.dayPct != null ? <ChangePill value={h.dayPct} size="xs" /> : <span className="text-xs text-slate-600">—</span>}
                      </div>
                      <div className={`text-right font-mono text-sm tnum ${pl >= 0 ? "text-up" : "text-down"}`}>
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
                  {[selected.sector, selected.geo].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <div className="text-right">
                <div className="font-mono text-xl tnum text-white">{curSym(selected.currency)}{fmtPrice(selected.price)}</div>
                <div className="mt-1 flex justify-end">
                  {selected.dayPct != null ? <ChangePill value={selected.dayPct} /> : <span className="text-xs text-slate-600">—</span>}
                </div>
              </div>
            </div>

            <div className="mt-4">
              <Sparkline data={spark} dir={dirOf(selected.dayPct ?? 0)} className="h-12 w-full" />
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4">
              {[
                { k: "Shares", v: selected.shares.toLocaleString() },
                { k: "Avg cost", v: `${curSym(selected.currency)}${fmtPrice(selected.avgCost)}` },
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
      )}
    </section>
  );
}
