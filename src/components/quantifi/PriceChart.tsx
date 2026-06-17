"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType } from "lightweight-charts";
import { GlassCard, ChangePill, TickerChip } from "@/components/quantifi/Cards";
import { fmtPrice } from "@/data/demo";

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

        setMeta(data.meta ?? null);
        setLive(Boolean(data.live));

        const el = elRef.current;
        if (!el) return;
        el.innerHTML = "";

        chart = createChart(el, {
          width: el.clientWidth,
          height,
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: "#94a3b8",
            fontFamily: "Inter, system-ui, sans-serif",
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
          lineColor: "#E9B872",
          topColor: "rgba(233,184,114,0.30)",
          bottomColor: "rgba(233,184,114,0.02)",
          lineWidth: 2,
          priceLineVisible: false,
        });
        series.setData(data.points ?? []);
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

  const symbolCurrency = meta?.currency === "INR" ? "₹" : "$";

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
            {live ? "LIVE" : "DEMO"}
          </span>
        </div>
        {meta?.price != null ? (
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
