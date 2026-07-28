"use client";

import { useEffect, useRef, useState } from "react";
import { createChart, ColorType, LineStyle } from "lightweight-charts";
import { GlassCard } from "@/components/quantifi/Cards";
import { usePortfolios } from "@/lib/usePortfolios";
import { fmtPrice, currencyForTicker } from "@/data/demo";

interface Pt {
  time: string; // YYYY-MM-DD
  value: number;
}

const RANGES: { key: string; label: string }[] = [
  { key: "1mo", label: "1M" },
  { key: "6mo", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "5y", label: "5Y" },
  { key: "max", label: "Max" },
];

// Cumulative value of the WHOLE portfolio over time: for each held name we pull
// its daily close series, multiply by the shares held, align everything on a
// shared date axis (forward-filling gaps so a missing day doesn't drop a name to
// zero) and sum across holdings. The dashed line is today's cost basis for
// reference. Prices are summed in native currency — mixed-currency books get a
// no-FX note, mirroring the portfolio summary.
export default function PortfolioValueChart() {
  const { portfolios, ready } = usePortfolios();
  const holdings = ready ? portfolios[0]?.holdings ?? [] : [];
  const holdingsKey = holdings
    .map((h) => `${h.ticker}:${h.shares}`)
    .sort()
    .join(",");
  const mixedCurrency =
    new Set(holdings.map((h) => currencyForTicker(h.ticker) ?? "USD")).size > 1;

  const [range, setRange] = useState("1y");
  const elRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [stats, setStats] = useState<{ value: number; cost: number } | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (holdings.length === 0) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    let chart: ReturnType<typeof createChart> | undefined;
    let ro: ResizeObserver | undefined;

    (async () => {
      setLoading(true);
      setErr(null);
      try {
        const per = await Promise.all(
          holdings.map(async (h) => {
            try {
              const r = await fetch(`/api/timeseries/${encodeURIComponent(h.ticker)}?range=${range}`);
              const d = await r.json();
              const pts: Pt[] = Array.isArray(d.points) ? d.points : [];
              const currency = (typeof d?.meta?.currency === "string" && d.meta.currency) ||
                currencyForTicker(h.ticker) || "USD";
              return { shares: h.shares, avgCost: h.avgCost, pts, currency };
            } catch {
              return { shares: h.shares, avgCost: h.avgCost, pts: [] as Pt[], currency: currencyForTicker(h.ticker) || "USD" };
            }
          })
        );
        if (cancelled) return;

        // Convert every holding into ONE base currency (USD) before summing — a
        // ₹ position and a $ position can't be added raw. We use the current spot
        // rate across the whole window: an approximation (it ignores FX drift over
        // time), but a correct order-of-magnitude total instead of a nonsensical one.
        const BASE = "USD";
        const rates: Record<string, number> = { [BASE]: 1 };
        await Promise.all(
          Array.from(new Set(per.map((s) => s.currency))).map(async (cur) => {
            if (cur === BASE) return;
            try {
              const r = await fetch(`/api/fx?from=${encodeURIComponent(cur)}&to=${BASE}`);
              const d = await r.json();
              rates[cur] = d?.valid && typeof d.rate === "number" ? d.rate : 1;
            } catch {
              rates[cur] = 1;
            }
          })
        );
        if (cancelled) return;
        const fx = (cur: string) => rates[cur] ?? 1;

        // Union of every trading date any holding reported.
        const dateSet = new Set<string>();
        per.forEach((s) => s.pts.forEach((p) => dateSet.add(p.time)));
        const dates = Array.from(dateSet).sort();
        if (dates.length < 2) {
          setErr("Not enough price history to chart this portfolio yet.");
          setLoading(false);
          return;
        }

        // Sum shares × close × FX per date, forward-filling each name's last close
        // so a name only starts contributing once it has a price (no phantom zeros).
        const totals = new Array(dates.length).fill(0);
        for (const s of per) {
          const map = new Map(s.pts.map((p) => [p.time, p.value]));
          const rate = fx(s.currency);
          let last = 0;
          let seen = false;
          dates.forEach((dt, idx) => {
            const v = map.get(dt);
            if (v != null) {
              last = v;
              seen = true;
            }
            if (seen) totals[idx] += last * s.shares * rate;
          });
        }

        const valuePoints: Pt[] = dates
          .map((dt, idx) => ({ time: dt, value: Number(totals[idx].toFixed(2)) }))
          .filter((p) => p.value > 0);
        if (valuePoints.length < 2) {
          setErr("Not enough price history to chart this portfolio yet.");
          setLoading(false);
          return;
        }

        // Cost basis in the same base currency.
        const totalCost = per.reduce((acc, s) => acc + s.shares * s.avgCost * fx(s.currency), 0);
        const costPoints: Pt[] = valuePoints.map((p) => ({
          time: p.time,
          value: Number(totalCost.toFixed(2)),
        }));

        const el = elRef.current;
        if (!el) return;
        el.innerHTML = "";

        const loraFamily =
          getComputedStyle(document.documentElement).getPropertyValue("--font-lora").trim() ||
          "Georgia, serif";
        chart = createChart(el, {
          width: el.clientWidth,
          height: 320,
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

        const area = chart.addAreaSeries({
          lineColor: "#34D399",
          topColor: "rgba(52,211,153,0.28)",
          bottomColor: "rgba(52,211,153,0.02)",
          lineWidth: 2,
          priceLineVisible: false,
          autoscaleInfoProvider: (original: () => unknown) => {
            const res = original() as { priceRange?: { minValue: number; maxValue: number } } | null;
            if (res?.priceRange && res.priceRange.minValue < 0) res.priceRange.minValue = 0;
            return res;
          },
        });
        area.setData(valuePoints);

        const costLine = chart.addLineSeries({
          color: "rgba(148,163,184,0.85)",
          lineWidth: 1,
          lineStyle: LineStyle.Dashed,
          priceLineVisible: false,
          lastValueVisible: false,
        });
        costLine.setData(costPoints);

        chart.timeScale().fitContent();
        setStats({ value: valuePoints[valuePoints.length - 1].value, cost: totalCost });

        ro = new ResizeObserver((entries) => {
          if (chart && entries[0]) chart.applyOptions({ width: entries[0].contentRect.width });
        });
        ro.observe(el);
      } catch {
        if (!cancelled) setErr("Could not build the portfolio chart right now.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (ro) ro.disconnect();
      if (chart) chart.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdingsKey, range, ready]);

  if (ready && holdings.length === 0) return null; // nothing to chart yet

  const gain = stats ? stats.value - stats.cost : 0;
  const gainPct = stats && stats.cost > 0 ? (gain / stats.cost) * 100 : 0;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-2 pt-4 sm:px-6 lg:px-8">
      <GlassCard className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display text-base font-semibold text-white">Portfolio value over time</h3>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2 w-3 rounded-sm bg-up/80" />
                Portfolio value
                {stats ? <span className="font-mono tnum text-white">${fmtPrice(stats.value)}</span> : null}
              </span>
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="inline-block h-0 w-3 border-t border-dashed border-slate-400" />
                Cost basis
                {stats ? <span className="font-mono tnum text-slate-300">${fmtPrice(stats.cost)}</span> : null}
              </span>
              {stats ? (
                <span className={`font-mono tnum ${gain >= 0 ? "text-up" : "text-down"}`}>
                  {gain >= 0 ? "+" : "-"}${fmtPrice(Math.abs(gain))} ({gainPct >= 0 ? "+" : ""}
                  {gainPct.toFixed(1)}%)
                </span>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-1 text-xs">
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
        </div>

        <div ref={elRef} style={{ height: 320 }} />

        {loading ? <p className="mt-2 text-xs text-slate-500">Building your portfolio history…</p> : null}
        {err ? <p className="mt-2 text-xs text-slate-500">{err}</p> : null}
        {mixedCurrency && !err ? (
          <p className="mt-2 text-[0.7rem] text-slate-500">
            This portfolio mixes currencies — all values are converted to USD at current exchange rates (historical FX drift isn&apos;t modelled).
          </p>
        ) : null}
      </GlassCard>
    </section>
  );
}
