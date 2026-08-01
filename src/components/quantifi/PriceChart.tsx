"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, LineStyle } from "lightweight-charts";
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

type ChartStyle = "area" | "candles";

export default function PriceChart({
  symbol,
  height = 440,
}: {
  symbol: string;
  height?: number;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState("1y");
  const [style, setStyle] = useState<ChartStyle>("area");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  // Set when the user wants candles but the source only gave us closes (Stooq).
  const [noCandles, setNoCandles] = useState(false);

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
        }
      } catch {
        /* leave the price badge blank */
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
        const candles = Array.isArray(data.candles) ? data.candles : [];
        // No genuine series for this range (e.g. Yahoo unreachable and no valid
        // fallback for an Indian symbol). Show an honest message rather than an
        // empty box or a misleading stub line.
        if (points.length === 0) {
          setErr("Live chart data isn’t available for this symbol right now.");
          return;
        }

        // Candles need OHLC. The Stooq fallback is closes-only, so rather than
        // faking bars we render the line and say why.
        const wantCandles = style === "candles";
        const useCandles = wantCandles && candles.length > 1;
        setNoCandles(wantCandles && !useCandles);

        // Canvas text can't read CSS variables, so resolve the site font (Inter)
        // from the computed style and pass the literal family to the chart.
        const loraFamily =
          getComputedStyle(document.documentElement).getPropertyValue("--font-inter").trim() ||
          "ui-sans-serif, system-ui, sans-serif";
        chart = createChart(el, {
          width: el.clientWidth,
          height,
          layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: "#94a3b8",
            fontFamily: `${loraFamily}, ui-sans-serif, system-ui, sans-serif`,
          },
          grid: {
            // Horizontal rules only — vertical gridlines fight with candle bodies
            // and made the chart look busier than it is.
            vertLines: { visible: false },
            horzLines: { color: "rgba(255,255,255,0.045)", style: LineStyle.Dotted },
          },
          rightPriceScale: {
            borderVisible: false,
            scaleMargins: { top: 0.12, bottom: 0.1 },
          },
          timeScale: {
            borderVisible: false,
            fixLeftEdge: true,
            fixRightEdge: true,
          },
          crosshair: {
            mode: 1,
            vertLine: { color: "rgba(212,175,55,0.45)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#A67F22" },
            horzLine: { color: "rgba(212,175,55,0.45)", width: 1, style: LineStyle.Dashed, labelBackgroundColor: "#A67F22" },
          },
          handleScale: { axisPressedMouseMove: false },
        });

        // A price can never be negative, but lightweight-charts' auto-scale pads
        // the range and — on a wide Max view spanning ₹5 → ₹4000 — drops the axis
        // floor below zero (the "-400" artefact). Clamp the visible minimum to 0
        // so the axis always reads as real prices.
        const clampToZero = (original: () => unknown) => {
          const res = original() as { priceRange?: { minValue: number; maxValue: number } } | null;
          if (res?.priceRange && res.priceRange.minValue < 0) res.priceRange.minValue = 0;
          return res;
        };

        if (useCandles) {
          const series = chart.addCandlestickSeries({
            upColor: "#34D399",
            downColor: "#FB7185",
            borderUpColor: "#34D399",
            borderDownColor: "#FB7185",
            wickUpColor: "rgba(52,211,153,0.75)",
            wickDownColor: "rgba(251,113,133,0.75)",
            priceLineVisible: false,
            autoscaleInfoProvider: clampToZero,
          });
          series.setData(candles);
        } else {
          // Gold gradient to match the brand rather than the stock blue.
          const series = chart.addAreaSeries({
            lineColor: "#D4AF37",
            topColor: "rgba(212,175,55,0.28)",
            bottomColor: "rgba(212,175,55,0.01)",
            lineWidth: 2,
            priceLineVisible: false,
            crosshairMarkerRadius: 4,
            crosshairMarkerBorderColor: "#05070D",
            crosshairMarkerBackgroundColor: "#E7C873",
            autoscaleInfoProvider: clampToZero,
          });
          series.setData(points);
        }
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
  }, [symbol, height, range, style]);

  const symbolCurrency = currencySymbol(meta?.currency, symbol);

  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <TickerChip ticker={symbol} active />
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

      {/* Timeframe + chart style */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-1">
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

        <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
          {([
            { key: "area", label: "Line" },
            { key: "candles", label: "Candles" },
          ] as const).map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => setStyle(s.key)}
              aria-pressed={style === s.key}
              className={
                style === s.key
                  ? "rounded-md bg-gold/15 px-2.5 py-1 font-medium text-gold"
                  : "rounded-md px-2.5 py-1 text-slate-400 transition hover:text-white"
              }
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div ref={elRef} style={{ height }} />

      {loading ? <p className="mt-2 text-xs text-slate-500">Loading chart…</p> : null}
      {err ? <p className="mt-2 text-xs text-down">{err}</p> : null}
      {noCandles && !err ? (
        <p className="mt-2 text-xs text-slate-500">
          Candles need open/high/low data, which our backup price source doesn&apos;t publish for this
          symbol — showing the closing line instead.
        </p>
      ) : null}
    </GlassCard>
  );
}
