"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GlassCard,
  SectionHeading,
  TickerChip,
  ChangePill,
  Sparkline,
  Skeleton,
  SkeletonTable,
  SamplePreview,
} from "@/components/quantifi/Cards";
import { fmtPrice, fmtPct, dirOf, currencySymbol } from "@/data/demo";
import { usePortfolios, resolveName } from "@/lib/usePortfolios";
import { SAMPLE_HOLDINGS } from "@/data/samplePortfolio";

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

const curSym = (c: string) => currencySymbol(c);

// The holdings table + selected-position detail. Owns its own selection so the
// sample preview renders the identical component real holdings get.
function HoldingsBody({ rows }: { rows: Row[] }) {
  const total = rows.reduce((s, r) => s + r.shares * r.price, 0) || 1;
  const listKey = rows.map((r) => r.ticker).join(",");

  const [selectedTicker, setSelectedTicker] = useState("");
  useEffect(() => {
    if (rows.length && !rows.find((r) => r.ticker === selectedTicker)) {
      setSelectedTicker(rows[0].ticker);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listKey]);

  const selected = rows.find((r) => r.ticker === selectedTicker) ?? rows[0];
  if (!selected) return null;

  const selValue = selected.shares * selected.price;
  const selWeight = (selValue / total) * 100;
  const selPL = ((selected.price - selected.avgCost) / selected.avgCost) * 100;
  const spark = selected.spark ?? [1, 1, 1];

  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      {/* Holdings list */}
      <GlassCard className="overflow-hidden">
        <div className="hidden grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr] gap-3 border-b border-white/[0.06] px-5 py-3 text-[0.62rem] uppercase tracking-[0.16em] text-slate-500 sm:grid">
          <span>Holding</span>
          <span className="text-right">Weight</span>
          <span className="text-right">Day</span>
          <span className="text-right">Unrealized</span>
        </div>
        <ul className="divide-y divide-white/[0.05]">
          {rows.map((h) => {
            const weight = ((h.shares * h.price) / total) * 100;
            const pl = ((h.price - h.avgCost) / h.avgCost) * 100;
            const isActive = h.ticker === selected.ticker;
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
                    {h.dayPct != null ? (
                      <ChangePill value={h.dayPct} size="xs" />
                    ) : (
                      <span className="text-xs text-slate-600">—</span>
                    )}
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
            <div className="font-mono text-xl tnum text-white">
              {curSym(selected.currency)}
              {fmtPrice(selected.price)}
            </div>
            <div className="mt-1 flex justify-end">
              {selected.dayPct != null ? (
                <ChangePill value={selected.dayPct} />
              ) : (
                <span className="text-xs text-slate-600">—</span>
              )}
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
  );
}

// Mirrors the two-column layout above while localStorage is being read.
function HoldingsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
      <SkeletonTable
        rows={4}
        cols={["1.4fr", "0.8fr", "0.8fr", "0.8fr"]}
        headers={["Holding", "Weight", "Day", "Unrealized"]}
      />
      <GlassCard className="p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="w-1/2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="mt-2.5 h-4 w-32" />
            <Skeleton className="mt-2 h-2.5 w-24" />
          </div>
          <div className="flex w-1/3 flex-col items-end">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="mt-2 h-4 w-14 rounded-md" />
          </div>
        </div>
        <Skeleton className="mt-5 h-12 w-full" />
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i}>
              <Skeleton className="h-2.5 w-16" />
              <Skeleton className="mt-1.5 h-3.5 w-20" />
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}

const SAMPLE_ROWS: Row[] = SAMPLE_HOLDINGS.map((h) => ({
  ticker: h.ticker,
  name: h.name,
  sector: h.sector,
  geo: h.region,
  shares: h.shares,
  avgCost: h.avgCost,
  price: h.price,
  currency: h.currency,
  dayPct: h.dayPct,
  spark: h.spark,
}));

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

  type Quote = { price: number; currency?: string; name?: string; changePct?: number; spark?: number[] };
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const savedKey = saved.map((h) => h.ticker).join(",");

  useEffect(() => {
    if (!savedKey) return;
    let cancelled = false;
    saved.forEach(async (h) => {
      try {
        // Live quote (price + day change) and history (sparkline) — so custom
        // holdings that aren't in the static demo set still show a chart + move.
        const [qr, tr] = await Promise.allSettled([
          fetch(`/api/quote/${encodeURIComponent(h.ticker)}`).then((x) => x.json()),
          fetch(`/api/timeseries/${encodeURIComponent(h.ticker)}?range=3mo`).then((x) => x.json()),
        ]);
        if (cancelled) return;
        const patch: Quote = { price: h.price };
        if (qr.status === "fulfilled" && qr.value?.valid && typeof qr.value.price === "number") {
          patch.price = qr.value.price;
          patch.currency = qr.value.currency;
          patch.name = qr.value.name;
          if (typeof qr.value.changePct === "number") patch.changePct = qr.value.changePct;
        }
        if (tr.status === "fulfilled" && Array.isArray(tr.value?.points)) {
          const vals = (tr.value.points as { value: number }[])
            .map((p) => p.value)
            .filter((v) => typeof v === "number" && isFinite(v));
          if (vals.length >= 2) {
            const step = Math.max(1, Math.floor(vals.length / 40));
            patch.spark = vals.filter((_, i) => i % step === 0).slice(-44);
          }
        }
        setQuotes((q) => ({ ...q, [h.ticker]: patch }));
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
        return {
          ticker: h.ticker,
          name: q?.name ?? resolveName(h.ticker) ?? h.ticker,
          shares: h.shares,
          avgCost: h.avgCost,
          price: q?.price ?? h.price,
          currency: q?.currency ?? (/\.(NS|BO)$/i.test(h.ticker) ? "INR" : "USD"),
          dayPct: q?.changePct ?? null,
          spark: q?.spark ?? null,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savedKey, quotes]
  );

  const list = limit ? rows.slice(0, limit) : rows;
  const sample = limit ? SAMPLE_ROWS.slice(0, limit) : SAMPLE_ROWS;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Portfolio Command Center"
          title="Inside your portfolio"
          subtitle={
            hasHoldings
              ? "Your saved holdings, live. Edit them in the command center and they update here."
              : "Weight, day move and unrealized gain/loss for every position — here's how it looks with a portfolio in it."
          }
          href="/portfolio"
          cta="Open command center"
        />
      ) : null}

      {!ready ? (
        <div className="mt-6">
          <HoldingsSkeleton />
        </div>
      ) : !hasHoldings || !list.length ? (
        <SamplePreview
          className="mt-6"
          note="Example holdings. Add real tickers and Quantifi tracks weight, unrealized gain/loss and live moves on your own book."
          cta="Build your portfolio →"
          href="/portfolio"
        >
          <HoldingsBody rows={sample} />
        </SamplePreview>
      ) : (
        <div className="mt-6">
          <HoldingsBody rows={list} />
        </div>
      )}
    </section>
  );
}
