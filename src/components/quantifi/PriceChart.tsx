"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType } from "lightweight-charts";
import { GlassCard, ChangePill, TickerChip } from "@/components/quantifi/Cards";
import { fmtPrice, currencySymbol } from "@/data/demo";

interface Meta {
  price?: number;
  change?: number;
  changePct?: number;
  currency?: string;
}

const RANGES: { key: string; label: string }[] = [
  { key: "1mo", label: "1M" },
  { key: "6mo", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "5y", label: "5Y" },
  { key: "max", label: "Max" },
];

export default function PriceChart({
  symbol,
  height = 440,
}: {
  symbol: string;
  height?: number;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState("1y");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [live, setLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Price badge comes from the authoritative live quote (/api/quote) — the SAME
  // source the valuation cards, watchlist and portfolio use — so the number and
  // today's move always match the rest of the site (and your broker/Google). We
  // deliberately do NOT read price/change from the timeseries meta: on a wide
  // range that meta's "previous close" is the close at the START of the window,
  // which turns the whole-period return into a bogus "today" figure.
  useEffect(() => {
    let cancelled = false;
    // Clear the previous symbol's price immediately so a slow/failed quote never
    // leaves the OLD stock's number showing on the new symbol (the "Tata Motors
    // shows Tata Steel's ₹186.53" bug).
    setMeta(null);
    setLive(false);
    (async () => {
      try {
        const r = await fetch(`/api/quote/${encodeURIComponent(symbol)}`);
        const q = (await r.json()) as {
          valid?: boolean;
          price?: number;
          changePct?: number;
          currency?: string;
        };
        if (cancelled) return;
        if (q.valid && typeof q.price === "number") {
          setMeta({ price: q.price, changePct: q.changePct, currency: q.currency });
          setLive(true);
        } else {
          setLive(false);
        }
      } catch {
        if (!cancelled) setLive(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  useEffect(() => {
    let chart: ReturnType<typeof createChart> | undefined;
    let ro: ResizeObserver | undefined;
    let cancelled = false;

    async function run() {
      setLoading(true);
      setErr(null);
      try {
        const res = await fetch(
          `/api/timeseries/${encodeURIComponent(symbol)}?range=${range}`
        );
        const data = await res.json();
        if (cancelled) return;

        // Chart LINE only — the price badge is driven by /api/quote above.
        const el = elRef.current;
        if (!el) return;
        el.innerHTML = "";

        const points = Array.isArray(data.points) ? data.points : [];
        // No genuine series for this range (e.g. Yahoo unreachable and no valid
        // fallback for an Indian symbol). Show an honest message rather than an
        // empty box or a misleading stub line.
        if (points.length === 0) {
          setErr("Live chart data isn’t available for this symbol right now — try the TradingView engine above.");
          return;
        }

        // Canvas text can't read CSS variables, so resolve the site font (Lora)
        // from the computed style and pass the literal family to the chart.
        const loraFamily =
          getComputedStyle(document.documentElement).getPropertyValue("--font-lora").trim() ||
          "Georgia, serif";
        chart = createChart(el, {
          width: el.clientWidth,
          height,
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: "#94a3b8",
            fontFamily: `${loraFamily}, Georgia, serif`,
          },
          grid: {
            vertLines: { color: "rgba(255,255,255,0.04)" },
            horzLines: { color: "rgba(255,255,255,0.04)" },
          },
          rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
          timeScale: { borderColor: "rgba(255,255,255,0.08)" },
          crosshair: { mode: 1 },
        });

        const series = chart.addAreaSeries({
          lineColor: "#4F93F7",
          topColor: "rgba(79, 147, 247,0.30)",
          bottomColor: "rgba(79, 147, 247,0.02)",
          lineWidth: 2,
          priceLineVisible: false,
          // A price can never be negative, but lightweight-charts' auto-scale pads
          // the range and — on a wide Max view spanning ₹5 → ₹4000 — drops the
          // axis floor below zero (the "-400" artefact). Clamp the visible minimum
          // to 0 so the axis always reads as real prices.
          autoscaleInfoProvider: (original: () => unknown) => {
            const res = original() as { priceRange?: { minValue: number; maxValue: number } } | null;
            if (res?.priceRange && res.priceRange.minValue < 0) res.priceRange.minValue = 0;
            return res;
          },
        });
        series.setData(points);
        chart.timeScale().fitContent();

        ro = new ResizeObserver((entries) => {
          if (chart && entries[0]) chart.applyOptions({ width: entries[0].contentRect.width });
        });
        ro.observe(el);
      } catch {
        if (!cancelled) setErr("Could not load chart data.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
      if (chart) chart.remove();
    };
  }, [symbol, height, range]);

  const symbolCurrency = currencySymbol(meta?.currency, symbol);

  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TickerChip ticker={symbol} active />
          <span
            className={`rounded-full border px-1.5 py-0.5 text-[0.6rem] tracking-[0.12em] ${
              live
                ? "border-up/30 bg-up/10 text-up"
                : "border-white/10 bg-white/[0.03] text-slate-500"
            }`}
          >
            {live ? "LIVE" : "No data"}
          </span>
        </div>
        {meta?.price ? (
          <div className="flex items-center gap-2">
            <span className="font-mono text-lg font-semibold tnum text-white">
              {symbolCurrency}
              {fmtPrice(meta.price)}
            </span>
            {meta.changePct != null ? <ChangePill value={meta.changePct} /> : null}
          </div>
        ) : null}
      </div>

      {/* Timeframe buttons */}
      <div className="mb-3 flex items-center gap-1 text-xs">
        {RANGES.map((r) => (
          <button
            key={r.key}
            type="button"
            onClick={() => setRange(r.key)}
            className={
              range === r.key
                ? "rounded-md bg-gold/20 px-2.5 py-1 font-medium text-gold"
                : "rounded-md px-2.5 py-1 text-slate-400 transition hover:text-white"
            }
          >
            {r.label}
          </button>
        ))}
      </div>

      <div ref={elRef} style={{ height }} />

      {loading ? <p className="mt-2 text-xs text-slate-500">Loading chart…</p> : null}
      {err ? <p className="mt-2 text-xs text-down">{err}</p> : null}
    </GlassCard>
  );
}
