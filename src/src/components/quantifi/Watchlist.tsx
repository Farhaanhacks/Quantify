"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { isAiBubbleStock } from "@/data/aiBubble";
import { useProStatus } from "@/lib/useProStatus";
import { FREE_LIMITS } from "@/data/plans";

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
  cfv?: number; // future cash-flow value (independent DCF), per share
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
        const cfv = d.analytics?.cashflowValue?.estimate;
        if (typeof cfv === "number" && cfv > 0) r.cfv = cfv;
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

  // On the cover, AI-bubble names lead with the future-cash-flow lens; everyone
  // else with the analyst target. Both remain visible when you open the stock.
  const bubble = isAiBubbleStock(ticker);
  const useCashflow = bubble && row?.cfv != null;
  const refValue = useCashflow ? row?.cfv : row?.target;
  const refKind = useCashflow ? "future cash flow" : "analyst target";
  const refGap =
    refValue != null && row?.price != null && row.price > 0
      ? ((refValue - row.price) / row.price) * 100
      : null;

  const gapLabel =
    refGap == null
      ? null
      : refGap >= 0
      ? `${refGap.toFixed(1)}% undervalued`
      : `${Math.abs(refGap).toFixed(1)}% overvalued`;

  // Flag when analyst target and cash-flow value tell different stories.
  const diverge =
    row?.target != null &&
    row?.cfv != null &&
    row?.price != null &&
    row.price > 0 &&
    Math.abs(row.target - row.cfv) / row.price >= 0.3;
  // "Overhyped" only applies in ONE direction: the cash-flow value sits BELOW
  // the analyst target, i.e. the price/analyst optimism runs ahead of what
  // today's cash flows support. If the cash-flow value is ABOVE the target,
  // it's the opposite — cash generation implies more value than analysts credit
  // (a cheap, not hyped, signal), so we never call that "overhyped".
  const overhyped = diverge && row!.cfv! < row!.target!;

  return (
    <li className="grid grid-cols-2 gap-y-3 gap-x-4 py-4 lg:grid-cols-[1.5fr_1.7fr_0.8fr_0.9fr_1fr_auto] lg:items-center">
      {/* Company — tap anywhere to open its analysis page */}
      <div className="col-span-2 lg:col-span-1">
        <Link
          href={`/stock-analysis?symbol=${encodeURIComponent(ticker)}`}
          className="group flex items-center gap-3"
          title={`Open ${ticker} analysis`}
        >
          {row?.scores ? (
            <span
              className="relative flex h-16 w-16 flex-none items-center justify-center rounded-xl border border-gold/30 bg-gold/[0.08] shadow-[0_0_20px_-6px_rgba(233,184,114,0.55)] transition group-hover:border-gold/60"
              title="Quantifi Score snowflake"
            >
              <ScoreRadar
                values={SCORE_AXES.map((a) => row.scores![a.key])}
                labels={EMPTY_LABELS}
                size={120}
              />
            </span>
          ) : (
            <span className="h-16 w-16 flex-none rounded-xl border border-white/[0.06] bg-white/[0.03]" />
          )}
          <div className="flex min-w-0 flex-col gap-1">
            <TickerChip ticker={ticker} />
            <span className="truncate text-xs text-slate-400 transition group-hover:text-white">
              {row?.name ?? ticker}
            </span>
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
        </Link>
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
              <span className="flex flex-wrap items-center gap-1.5">
                <span className={`text-xs ${refGap! >= 0 ? "text-up" : "text-down"}`}>
                  {gapLabel}
                </span>
                <span className="text-[0.6rem] text-slate-600">
                  vs {useCashflow ? "cash-flow value" : "analyst target"}
                </span>
                {overhyped ? (
                  <span
                    className="rounded-full border border-gold/30 bg-gold/10 px-1.5 py-px text-[0.55rem] font-medium tracking-wide text-gold"
                    title="The future cash-flow value sits well below the analyst target — the price runs ahead of what today's cash flows support. Open the stock to see both."
                  >
                    ⚠ Overhyped stock
                  </span>
                ) : diverge ? (
                  <span
                    className="rounded-full border border-up/30 bg-up/10 px-1.5 py-px text-[0.55rem] font-medium tracking-wide text-up"
                    title="The future cash-flow value sits well above the analyst target — today's cash generation implies more value than analysts credit. Open the stock to see both."
                  >
                    ▲ Cash-flow says cheaper
                  </span>
                ) : null}
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

      {/* Fair value — cash-flow value for AI-bubble names, analyst target otherwise */}
      <div className="flex items-baseline justify-between lg:block lg:text-right">
        <span className="lg:hidden text-[0.6rem] uppercase tracking-[0.12em] text-slate-500">
          {useCashflow ? "Cash-flow value" : "Analyst target"}
        </span>
        <span className="lg:flex lg:flex-col lg:items-end">
          <span className="font-mono text-sm tnum text-white">
            {refValue != null ? `${ccy(row?.currency, ticker)}${fmtPrice(refValue)}` : "—"}
          </span>
          {refValue != null ? (
            <span className="hidden text-[0.55rem] uppercase tracking-[0.1em] text-slate-600 lg:block">
              {refKind}
            </span>
          ) : null}
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
  const { pro } = useProStatus();

  // Free accounts can track up to FREE_LIMITS.watchlistStocks; Pro is unlimited.
  const atFreeCap = !pro && data.stocks.length >= FREE_LIMITS.watchlistStocks;

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
    if (atFreeCap) {
      setStockErr(
        `Free plan tracks up to ${FREE_LIMITS.watchlistStocks} stocks. Upgrade to Quantifi Pro for an unlimited watchlist.`
      );
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
          <span className="text-xs text-slate-500">
            {pro ? `${data.stocks.length} tracked` : `${data.stocks.length} / ${FREE_LIMITS.watchlistStocks} tracked`}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Live price, fair value, growth and a 6-month trend — at a glance. AI names lead with their
          future cash-flow value; the rest with the analyst target.
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
          <button onClick={handleAddStock} disabled={checking || atFreeCap} className={btnCls}>
            {checking ? "Checking…" : "Add"}
          </button>
        </div>
        {stockErr ? <p className="mt-2 text-xs text-down">{stockErr}</p> : null}
        {atFreeCap && !stockErr ? (
          <p className="mt-2 text-xs text-slate-500">
            Free plan tracks up to {FREE_LIMITS.watchlistStocks} stocks.{" "}
            <Link href="/pricing" className="text-gold hover:underline">
              Upgrade to Pro
            </Link>{" "}
            for an unlimited watchlist.
          </p>
        ) : null}

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
              <span className="text-right">Fair value</span>
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
