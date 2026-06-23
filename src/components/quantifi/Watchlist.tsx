"use client";

import { useEffect, useState } from "react";
import {
  GlassCard,
  SectionHeading,
  TickerChip,
  Sparkline,
  ScoreRadar,
} from "@/components/quantifi/Cards";
import { fmtPrice, SCORE_AXES } from "@/data/demo";
import type { ScoreAxisKey } from "@/data/demo";
import { useWatchlist } from "@/lib/useWatchlist";

const EMPTY_LABELS = ["", "", "", "", ""];

function ccy(currency: string | undefined, ticker: string): string {
  if (currency === "INR" || /\.(NS|BO)$/i.test(ticker)) return "₹";
  if (currency === "GBP") return "£";
  if (currency === "EUR") return "€";
  return "$";
}

function signed(x: number): string {
  return `${x >= 0 ? "+" : ""}${x.toFixed(1)}%`;
}

interface RowData {
  name?: string;
  price?: number;
  currency?: string;
  target?: number;
  gap?: number; // % to analyst target ((target-price)/price*100); +ve = undervalued
  ps?: number;
  growth?: number; // revenue growth, fraction
  spark?: number[];
  d7?: number;
  d3m?: number;
  dir?: "up" | "down";
  scores?: Record<ScoreAxisKey, number>; // Quantifi Score axes for the snowflake
}

// One rich watchlist row — fetches valuation (score) + history (timeseries) on
// mount, so rows fill in independently.
function WatchRow({ ticker, onRemove }: { ticker: string; onRemove: () => void }) {
  const [row, setRow] = useState<RowData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r: RowData = {};
      const [s, t] = await Promise.allSettled([
        fetch(`/api/score/${encodeURIComponent(ticker)}`).then((x) => x.json()),
        fetch(`/api/timeseries/${encodeURIComponent(ticker)}?range=6mo`).then((x) => x.json()),
      ]);

      if (s.status === "fulfilled" && s.value?.available) {
        const d = s.value;
        if (d.name) r.name = d.name;
        if (typeof d.price === "number") r.price = d.price;
        if (typeof d.target === "number" && d.target > 0) {
          r.target = d.target;
          if (typeof r.price === "number" && r.price > 0) {
            r.gap = ((d.target - r.price) / r.price) * 100;
          }
        }
        if (typeof d.priceToSales === "number") r.ps = d.priceToSales;
        if (typeof d.revenueGrowth === "number") r.growth = d.revenueGrowth;
        const sc = d.analytics?.scores;
        if (sc) {
          r.scores = {
            value: sc.value?.score ?? 0,
            growth: sc.growth?.score ?? 0,
            past: sc.past?.score ?? 0,
            health: sc.health?.score ?? 0,
            dividends: sc.dividends?.score ?? 0,
          };
        }
      }

      if (t.status === "fulfilled" && Array.isArray(t.value?.points)) {
        const vals = (t.value.points as { value: number }[])
          .map((p) => p.value)
          .filter((v) => typeof v === "number" && isFinite(v));
        if (vals.length >= 2) {
          const n = vals.length;
          const last = vals[n - 1];
          if (r.price == null) r.price = t.value.meta?.price ?? last;
          if (!r.currency) r.currency = t.value.meta?.currency;
          const p7 = vals[Math.max(0, n - 6)];
          const p3 = vals[Math.max(0, n - 64)];
          if (p7) r.d7 = ((last - p7) / p7) * 100;
          if (p3) r.d3m = ((last - p3) / p3) * 100;
          r.dir = (r.d3m ?? 0) >= 0 ? "up" : "down";
          const step = Math.max(1, Math.floor(n / 36));
          r.spark = vals.filter((_, i) => i % step === 0).slice(-44);
        }
      }

      if (!cancelled) {
        setRow(r);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const gapLabel =
    row?.gap == null
      ? null
      : row.gap >= 0
      ? `${row.gap.toFixed(1)}% undervalued`
      : `${Math.abs(row.gap).toFixed(1)}% overvalued`;

  return (
    <li className="grid grid-cols-2 gap-y-3 gap-x-4 py-4 lg:grid-cols-[1.5fr_1.7fr_0.8fr_0.9fr_1fr_auto] lg:items-center">
      {/* Company */}
      <div className="col-span-2 flex items-center gap-3 lg:col-span-1">
        {row?.scores ? (
          <span className="h-12 w-14 flex-none" title="Quantifi Score snowflake">
            <ScoreRadar
              values={SCORE_AXES.map((a) => row.scores![a.key])}
              labels={EMPTY_LABELS}
              size={120}
            />
          </span>
        ) : (
          <span className="h-12 w-14 flex-none rounded-full bg-white/[0.03]" />
        )}
        <div className="flex min-w-0 flex-col gap-1">
        <TickerChip ticker={ticker} />
        <span className="truncate text-xs text-slate-400">{row?.name ?? ticker}</span>
        {row?.d7 != null || row?.d3m != null ? (
          <div className="mt-0.5 flex gap-3 text-[0.7rem]">
            {row?.d7 != null ? (
              <span>
                <span className={row.d7 >= 0 ? "text-up" : "text-down"}>{signed(row.d7)}</span>{" "}
                <span className="text-slate-600">7D</span>
              </span>
            ) : null}
            {row?.d3m != null ? (
              <span>
                <span className={row.d3m >= 0 ? "text-up" : "text-down"}>{signed(row.d3m)}</span>{" "}
                <span className="text-slate-600">3M</span>
              </span>
            ) : null}
          </div>
        ) : null}
        </div>
      </div>

      {/* Price & valuation */}
      <div className="flex flex-col gap-1">
        <span className="lg:hidden text-[0.6rem] uppercase tracking-[0.12em] text-slate-500">
          Price &amp; valuation
        </span>
        {loading && row?.price == null ? (
          <span className="text-xs text-slate-500">loading…</span>
        ) : (
          <>
            <span className="font-mono text-sm tnum text-white">
              {ccy(row?.currency, ticker)}
              {row?.price != null ? fmtPrice(row.price) : "—"}
            </span>
            {gapLabel ? (
              <span
                className={`text-xs ${row!.gap! >= 0 ? "text-up" : "text-down"}`}
              >
                {gapLabel}
              </span>
            ) : null}
            {row?.spark && row.spark.length >= 2 ? (
              <Sparkline
                data={row.spark}
                dir={row.dir ?? "up"}
                className="mt-0.5 h-7 w-full max-w-[150px]"
              />
            ) : null}
          </>
        )}
      </div>

      {/* Valuation ratio */}
      <div className="flex items-baseline justify-between lg:block lg:text-right">
        <span className="lg:hidden text-[0.6rem] uppercase tracking-[0.12em] text-slate-500">
          Valuation
        </span>
        <span className="font-mono text-sm tnum text-slate-300">
          {row?.ps != null ? `P/S ${row.ps.toFixed(1)}x` : "—"}
        </span>
      </div>

      {/* Growth */}
      <div className="flex items-baseline justify-between lg:block lg:text-right">
        <span className="lg:hidden text-[0.6rem] uppercase tracking-[0.12em] text-slate-500">
          Rev growth
        </span>
        <span
          className={`font-mono text-sm tnum ${
            row?.growth == null ? "text-slate-300" : row.growth >= 0 ? "text-up" : "text-down"
          }`}
        >
          {row?.growth != null ? signed(row.growth * 100) : "—"}
        </span>
      </div>

      {/* Analyst target */}
      <div className="flex items-baseline justify-between lg:block lg:text-right">
        <span className="lg:hidden text-[0.6rem] uppercase tracking-[0.12em] text-slate-500">
          Analyst target
        </span>
        <span className="font-mono text-sm tnum text-white">
          {row?.target != null ? `${ccy(row?.currency, ticker)}${fmtPrice(row.target)}` : "—"}
        </span>
      </div>

      {/* Remove */}
      <div className="col-span-2 flex justify-end lg:col-span-1">
        <button
          onClick={onRemove}
          aria-label={`Remove ${ticker}`}
          className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-slate-500 transition hover:border-down/40 hover:text-down"
        >
          ×
        </button>
      </div>
    </li>
  );
}

export default function Watchlist({ heading = true }: { heading?: boolean }) {
  const { data, ready, scope, addStock, removeStock } = useWatchlist();

  // --- add-stock form ---
  const [stockInput, setStockInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [stockErr, setStockErr] = useState<string | null>(null);

  const handleAddStock = async () => {
    const t = stockInput.trim().toUpperCase();
    if (!t) return;
    setStockErr(null);
    if (data.stocks.includes(t)) {
      setStockErr("Already on your watchlist.");
      return;
    }
    setChecking(true);
    try {
      const r = await fetch(`/api/quote/${encodeURIComponent(t)}`);
      const d = await r.json();
      if (d?.valid) {
        addStock(t);
        setStockInput("");
      } else {
        setStockErr(`Couldn't find "${t}". Try a symbol like NVDA or INFY.NS`);
      }
    } catch {
      setStockErr("Couldn't check that ticker right now.");
    } finally {
      setChecking(false);
    }
  };

  const inputCls =
    "rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-gold/40";
  const btnCls =
    "rounded-lg border border-gold/40 bg-gold/15 px-3 py-2 text-sm font-medium text-gold transition hover:bg-gold/25 disabled:opacity-40";

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Watchlist"
          title="Everything you're tracking"
          subtitle="Add the stocks you care about. Everything here is yours — edit it any time."
        />
      ) : null}

      {/* scope indicator */}
      {ready ? (
        <p className="mt-3 text-xs text-slate-500">
          {scope === "account"
            ? "✓ Synced to your account — this list follows you on any device you sign in to."
            : "Saved on this device. Sign in (top-right) to sync across devices."}
        </p>
      ) : null}

      {/* Saved stocks */}
      <GlassCard className="mt-6 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-white">Saved stocks</h3>
          <span className="text-xs text-slate-500">{data.stocks.length} tracked</span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Live price, gap to the analysts&apos; fair value, growth and a 6-month trend — at a glance.
        </p>

        {/* add row */}
        <div className="mt-4 flex gap-2">
          <input
            value={stockInput}
            onChange={(e) => setStockInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddStock()}
            placeholder="Add a ticker — e.g. NVDA, INFY.NS"
            className={`${inputCls} flex-1`}
          />
          <button onClick={handleAddStock} disabled={checking} className={btnCls}>
            {checking ? "Checking…" : "Add"}
          </button>
        </div>
        {stockErr ? <p className="mt-2 text-xs text-down">{stockErr}</p> : null}

        {data.stocks.length === 0 ? (
          <p className="mt-6 text-sm text-slate-500">
            Nothing here yet. Add a ticker above to start tracking it with live valuation data.
          </p>
        ) : (
          <>
            {/* column header (desktop) */}
            <div className="mt-5 hidden grid-cols-[1.5fr_1.7fr_0.8fr_0.9fr_1fr_auto] gap-4 border-b border-white/[0.06] pb-2 text-[0.6rem] uppercase tracking-[0.14em] text-slate-500 lg:grid">
              <span>Company</span>
              <span>Price &amp; valuation</span>
              <span className="text-right">Valuation</span>
              <span className="text-right">Growth</span>
              <span className="text-right">Analyst target</span>
              <span />
            </div>
            <ul className="divide-y divide-white/[0.05]">
              {data.stocks.map((ticker) => (
                <WatchRow key={ticker} ticker={ticker} onRemove={() => removeStock(ticker)} />
              ))}
            </ul>
          </>
        )}
      </GlassCard>
    </section>
  );
}
