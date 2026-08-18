"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, LineStyle } from "lightweight-charts";
import { GlassCard, ChangePill, TickerChip } from "@/components/quantifi/Cards";
import { fmtPrice, currencySymbol } from "@/data/demo";
import { CATEGORY_COLOR, type CompanyEvent, type EventCategory } from "@/lib/companyEvents";
import EventDetailModal from "@/components/quantifi/EventDetailModal";

interface Meta {
  price?: number;
  change?: number;
  changePct?: number;
  currency?: string;
}

const RANGES: { key: string; label: string }[] = [
  { key: "1mo", label: "1M" },
  { key: "3mo", label: "3M" },
  { key: "6mo", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "3y", label: "3Y" },
  { key: "5y", label: "5Y" },
  { key: "max", label: "Max" },
];

const CATEGORY_ORDER: EventCategory[] = ["Dividend", "Financial", "Management", "Strategy", "Other"];

type ChartStyle = "area" | "candles";

export default function PriceChart({
  symbol,
  height = 440,
}: {
  symbol: string;
  height?: number;
}) {
  const elRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState("1y");
  const [events, setEvents] = useState<CompanyEvent[]>([]);
  const [showEvents, setShowEvents] = useState(true);
  // The date whose events are open in the detail modal, if any.
  const [openDate, setOpenDate] = useState<string | null>(null);
  // Candles by default: this is a research chart, and OHLC bars carry the
  // intraday range the line hides. Sources without OHLC fall back to the line
  // automatically (see `noCandles`).
  const [style, setStyle] = useState<ChartStyle>("candles");
  const [meta, setMeta] = useState<Meta | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  // Set when the user wants candles but the source only gave us closes (Stooq).
  const [noCandles, setNoCandles] = useState(false);
  // The company has less trading history than the selected range — a recent
  // listing. The chart is real; the window just isn't full.
  const [partial, setPartial] = useState(false);

  // Canvas tooltips are built inside the chart effect, so the currency symbol has
  // to be resolvable there — derive it from the ticker plus whatever the quote
  // has told us so far.
  const tipCurrency = currencySymbol(meta?.currency, symbol);

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

  // Corporate events for the marker lane. Public-domain sources only (SEC 8-K
  // item codes, plus dividends/splits), so an empty list is a normal outcome —
  // non-US listings aren't in EDGAR at all.
  useEffect(() => {
    let cancelled = false;
    setEvents([]);
    (async () => {
      try {
        const r = await fetch(
          `/api/events/${encodeURIComponent(symbol)}?range=${encodeURIComponent(range)}`
        );
        const d = await r.json();
        if (!cancelled && Array.isArray(d?.events)) setEvents(d.events as CompanyEvent[]);
      } catch {
        /* markers are optional — the chart stands on its own */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol, range]);

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
        setPartial(Boolean(data.partial));

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

        // One marker per event date. lightweight-charts anchors markers to a bar
        // that exists in the series, so an event filed on a non-trading day is
        // snapped forward to the next session rather than silently dropped.
        const barTimes: string[] = (useCandles ? candles : points).map(
          (p: { time: string }) => p.time
        );
        const snapToBar = (date: string): string | null => {
          if (!barTimes.length) return null;
          if (date < barTimes[0]) return null;
          for (const t of barTimes) if (t >= date) return t;
          return null;
        };

        const visibleEvents = showEvents ? events : [];
        const markers = visibleEvents
          .map((e) => {
            const time = snapToBar(e.date);
            return time
              ? {
                  time,
                  position: "belowBar" as const,
                  color: CATEGORY_COLOR[e.category] ?? "#94a3b8",
                  shape: "circle" as const,
                  text: "",
                  size: 1 as const,
                }
              : null;
          })
          .filter((m): m is NonNullable<typeof m> => m != null)
          // The library requires markers in ascending time order.
          .sort((a, b) => a.time.localeCompare(b.time));

        // Whichever series we build, the price lines and markers attach to it.
        let seriesRef:
          | ReturnType<NonNullable<typeof chart>["addCandlestickSeries"]>
          | ReturnType<NonNullable<typeof chart>["addAreaSeries"]>
          | undefined;

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
          seriesRef = series;
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
          seriesRef = series;
        }

        // Period high/low, drawn the way a research chart shows them: a dashed
        // rule with the actual figure on the axis.
        const series = seriesRef;
        const closes: number[] = useCandles
          ? candles.map((c: { high: number }) => c.high)
          : points.map((p: { value: number }) => p.value);
        const lows: number[] = useCandles
          ? candles.map((c: { low: number }) => c.low)
          : points.map((p: { value: number }) => p.value);
        if (series && closes.length) {
          const hi = Math.max(...closes);
          const lo = Math.min(...lows);
          const lineOpts = {
            lineWidth: 1 as const,
            lineStyle: LineStyle.Dashed,
            axisLabelVisible: true,
          };
          series.createPriceLine({ ...lineOpts, price: hi, color: "rgba(52,211,153,0.45)", title: "high" });
          series.createPriceLine({ ...lineOpts, price: lo, color: "rgba(251,113,133,0.45)", title: "low" });
          series.setMarkers(markers);
        }

        chart.timeScale().fitContent();

        // Floating date + price readout, plus any event filed that day. The
        // library's axis labels stay on for scale; this is the detail box.
        const tip = tipRef.current;
        if (tip && series) {
          const byDate = new Map<string, CompanyEvent[]>();
          for (const e of visibleEvents) {
            const t = snapToBar(e.date);
            if (!t) continue;
            byDate.set(t, [...(byDate.get(t) ?? []), e]);
          }
          chart.subscribeCrosshairMove((param) => {
            const time = param.time as string | undefined;
            const point = param.point;
            if (!time || !point || point.x < 0 || point.y < 0) {
              tip.style.display = "none";
              el.style.cursor = "default";
              return;
            }
            const bar = param.seriesData.get(series) as
              | { value?: number; close?: number }
              | undefined;
            const price = bar?.value ?? bar?.close;
            if (price == null) {
              tip.style.display = "none";
              return;
            }
            const when = new Date(`${time}T00:00:00Z`).toLocaleDateString("en-GB", {
              weekday: "short",
              day: "2-digit",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            });
            const hits = byDate.get(time) ?? [];
            el.style.cursor = hits.length ? "pointer" : "default";
            // Built as DOM nodes rather than an innerHTML string: `label` comes
            // from the events API, and an HTML sink fed by response data is one
            // upstream change away from being an XSS hole. textContent can't be
            // parsed as markup.
            tip.replaceChildren();
            const dateEl = document.createElement("div");
            dateEl.className = "text-[0.62rem] text-slate-400";
            dateEl.textContent = when;
            const priceEl = document.createElement("div");
            priceEl.className = "font-mono text-sm font-semibold tnum text-white";
            priceEl.textContent = `${tipCurrency}${fmtPrice(price)}`;
            tip.append(dateEl, priceEl);
            for (const h of hits) {
              const row = document.createElement("div");
              row.className = "mt-1 flex items-center gap-1.5 text-[0.65rem] text-slate-300";
              const dot = document.createElement("span");
              dot.className = "h-1.5 w-1.5 flex-none rounded-full";
              dot.style.background = CATEGORY_COLOR[h.category] ?? "#94a3b8";
              row.append(dot, document.createTextNode(h.label));
              tip.append(row);
            }
            tip.style.display = "block";
            // Keep the box inside the chart on both edges.
            const w = tip.offsetWidth;
            const left = Math.min(Math.max(point.x - w / 2, 4), el.clientWidth - w - 4);
            tip.style.left = `${left}px`;
            tip.style.top = `8px`;
          });
        }

        if (series) {
          const byDateForClick = new Map<string, string>();
          for (const e of visibleEvents) {
            const t = snapToBar(e.date);
            if (t) byDateForClick.set(t, e.date);
          }
          chart.subscribeClick((param) => {
            const time = param.time as string | undefined;
            if (!time) return;
            const real = byDateForClick.get(time);
            if (real) setOpenDate(real);
          });
        }

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
  }, [symbol, height, range, style, events, showEvents, tipCurrency]);

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

      <div className="relative">
        <div ref={elRef} style={{ height }} />
        <div
          ref={tipRef}
          className="pointer-events-none absolute z-10 hidden rounded-lg border border-white/10 bg-ink-900/95 px-2.5 py-1.5 shadow-panel backdrop-blur"
          style={{ display: "none" }}
        />
      </div>

      {/* Event lane legend — only shown when this symbol actually has events. */}
      {events.length ? (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.06] pt-3">
          <button
            type="button"
            onClick={() => setShowEvents((v) => !v)}
            aria-pressed={showEvents}
            className={`rounded-md px-2 py-1 text-[0.7rem] font-medium transition ${
              showEvents ? "bg-gold/15 text-gold" : "text-slate-400 hover:text-white"
            }`}
          >
            Events
          </button>
          {CATEGORY_ORDER.filter((c) => events.some((e) => e.category === c)).map((c) => (
            <span key={c} className="flex items-center gap-1.5 text-[0.7rem] text-slate-400">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: CATEGORY_COLOR[c] }}
              />
              {c}
            </span>
          ))}
          <span className="text-[0.65rem] text-slate-500">Click a marker for detail</span>
          <span className="ml-auto text-[0.62rem] text-slate-600">
            SEC 8-K item codes · dividends &amp; splits
          </span>
        </div>
      ) : null}

      {loading ? <p className="mt-2 text-xs text-slate-500">Loading chart…</p> : null}
      {err ? <p className="mt-2 text-xs text-down">{err}</p> : null}
      {partial && !err ? (
        <p className="mt-2 text-xs text-slate-500">
          This company hasn&apos;t traded for the full {range.toUpperCase()} window, the chart shows its
          entire price history to date.
        </p>
      ) : null}
      {noCandles && !err ? (
        <p className="mt-2 text-xs text-slate-500">
          Candles need open/high/low data, which our backup price source doesn&apos;t publish for this
          symbol; showing the closing line instead.
        </p>
      ) : null}

      {openDate ? (
        <EventDetailModal
          date={openDate}
          events={events.filter((e) => e.date === openDate)}
          onClose={() => setOpenDate(null)}
        />
      ) : null}
    </GlassCard>
  );
}
