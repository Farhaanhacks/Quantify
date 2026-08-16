"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard, tickerHref } from "@/components/quantifi/Cards";
import { REGIONS } from "@/data/heatmapUniverse";
import { fmtCompactCur, isIndianCurrency } from "@/data/demo";
import { returnOver, ytdReturn, type Point } from "@/lib/marketMath";

// The market as a whole: what it costs, what it has done, which sectors moved it
// and which companies drove that.
//
// Everything on this page is aggregated from live company quotes (see
// lib/marketsOverview) or read from the index's own price history. Where a
// figure cannot be computed from those two things it is left out and said to be
// left out — the market's P/E over the last decade is the obvious example, since
// that needs a decade of the whole market's earnings and we hold today's.

interface SectorRow {
  sector: string;
  companies: number;
  weight: number;
  day: number;
  pe?: number;
}

interface MoverRow {
  symbol: string;
  name: string;
  price: number;
  currency: string;
  day: number;
  year?: number;
  pe?: number;
  sector: string;
  marketCap: number;
}

interface Overview {
  ok: boolean;
  region: string;
  regionLabel: string;
  demonym: string;
  indexSymbol: string;
  indexLabel: string;
  currency: string;
  companies: number;
  totalMarketCap: number;
  day: number;
  year?: number;
  pe?: number;
  sectors: SectorRow[];
  gainers: MoverRow[];
  losers: MoverRow[];
  asOf: string;
  live: boolean;
}

/** The sector windows offered. "day" comes from the quote feed; the rest need
 *  price history, so they are fetched only when chosen. */
const WINDOWS = [
  { key: "day", label: "Today" },
  { key: "1mo", label: "1M" },
  { key: "6mo", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "5y", label: "5Y" },
] as const;
type WindowKey = (typeof WINDOWS)[number]["key"];
const WINDOW_LABEL: Record<WindowKey, string> = {
  day: "Today",
  "1mo": "A month",
  "6mo": "Six months",
  "1y": "A year",
  "5y": "Five years",
};

/** What a bar row needs, whichever source it came from. */
interface BarRow {
  sector: string;
  companies: number;
  change?: number;
  pe?: number;
}

/** A fetched window, with the coverage it was built from. */
interface WindowResult {
  sectors: BarRow[];
  /** Companies with usable history, and companies asked for. */
  companies: number;
  requested: number;
}

const RANGES = [
  { key: "1y", label: "1Y" },
  { key: "5y", label: "5Y" },
  { key: "10y", label: "10Y" },
  { key: "max", label: "Max" },
];

const pct = (n: number, dp = 1) => `${n >= 0 ? "+" : ""}${n.toFixed(dp)}%`;
const tone = (n: number) => (n > 0 ? "text-up" : n < 0 ? "text-down" : "text-slate-400");

// ── The index chart ─────────────────────────────────────────────────────────

function IndexChart({ points, label }: { points: Point[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const w = 900;
  const h = 240;
  const padY = 16;

  const { min, max, path, area, xs } = useMemo(() => {
    const vals = points.map((p) => p.value);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const span = hi - lo || 1;
    const x = (i: number) => (i / Math.max(1, points.length - 1)) * w;
    const y = (v: number) => h - padY - ((v - lo) / span) * (h - padY * 2);
    const d = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
    return {
      min: lo,
      max: hi,
      path: d,
      area: `${d} L ${w},${h} L 0,${h} Z`,
      xs: points.map((_, i) => x(i)),
    };
  }, [points]);

  if (points.length < 2) return null;
  const first = points[0].value;
  const last = points[points.length - 1].value;
  const up = last >= first;
  const stroke = up ? "#34D399" : "#FB7185";
  const active = hover != null ? points[hover] : null;

  return (
    <div>
      <div className="relative">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full"
        style={{ height: 240 }}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label} price history`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const rel = ((e.clientX - rect.left) / rect.width) * w;
          let best = 0;
          for (let i = 1; i < xs.length; i++) {
            if (Math.abs(xs[i] - rel) < Math.abs(xs[best] - rel)) best = i;
          }
          setHover(best);
        }}
      >
        <defs>
          <linearGradient id="idxfill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill="url(#idxfill)" />
        <path d={path} fill="none" stroke={stroke} strokeWidth="2" vectorEffect="non-scaling-stroke" />
        {active ? (
          <line
            x1={xs[hover!]}
            x2={xs[hover!]}
            y1="0"
            y2={h}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="1"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
      </svg>
      {/* Values sit outside the SVG so they don't stretch with
          preserveAspectRatio="none" — and inside a wrapper that spans the CHART
          only, or the bottom label lands on top of the date row below it. */}
      <div className="pointer-events-none absolute inset-y-0 right-0 flex flex-col justify-between py-1 text-right font-mono text-[0.62rem] tnum text-slate-500">
        <span className="rounded bg-ink-900/70 px-1">
          {max.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
        <span className="rounded bg-ink-900/70 px-1">
          {min.toLocaleString(undefined, { maximumFractionDigits: 0 })}
        </span>
      </div>
      </div>
      <div className="mt-1 flex justify-between font-mono text-[0.62rem] tnum text-slate-500">
        <span>{points[0].time}</span>
        <span>
          {active ? (
            <span className="text-slate-300">
              {active.time} · {active.value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </span>
          ) : null}
        </span>
        <span>{points[points.length - 1].time}</span>
      </div>
    </div>
  );
}

// ── Sector bars ─────────────────────────────────────────────────────────────

function SectorBars({
  rows,
  value,
  format,
  emptyNote,
  signed,
}: {
  rows: BarRow[];
  value: (r: BarRow) => number | undefined;
  format: (n: number) => string;
  emptyNote: string;
  /**
   * True for a quantity that can be negative (a return), which is drawn either
   * side of a zero line. False for one that cannot (a P/E), which grows from
   * the left across the full width — centring those would spend half the row on
   * a negative side that can never be used, and colour them green as though a
   * high multiple were good news.
   */
  signed: boolean;
}) {
  const usable = rows.filter((r) => value(r) != null);
  if (!usable.length) return <p className="py-6 text-sm text-slate-500">{emptyNote}</p>;
  // One scale for every bar, anchored at zero, so the bars are comparable with
  // each other rather than each being scaled to itself.
  const span = Math.max(...usable.map((r) => Math.abs(value(r)!))) || 1;
  const sorted = [...usable].sort((a, b) => value(b)! - value(a)!);

  return (
    <ul className="mt-3 space-y-1">
      {sorted.map((r) => {
        const v = value(r)!;
        const width = (Math.abs(v) / span) * (signed ? 50 : 100);
        const positive = v >= 0;
        return (
          <li key={r.sector} className="flex items-center gap-3 py-1">
            <span
              className="w-44 flex-none truncate text-xs text-slate-300"
              title={`${r.sector} — ${r.companies} companies`}
            >
              {r.sector}
            </span>
            <span className="relative h-4 flex-1">
              {/* The zero line is drawn, not implied: a chart of positive and
                  negative moves that starts every bar at the left edge makes a
                  small loss look like a gain. */}
              {signed ? <span className="absolute inset-y-0 left-1/2 w-px bg-slate-400/50" /> : null}
              <span
                className={`absolute inset-y-0 rounded-sm ${
                  !signed ? "bg-slate-400/40" : positive ? "bg-up/70" : "bg-down/70"
                }`}
                style={
                  !signed
                    ? { left: 0, width: `${width}%` }
                    : positive
                    ? { left: "50%", width: `${width}%` }
                    : { right: "50%", width: `${width}%` }
                }
              />
            </span>
            <span
              className={`w-16 flex-none text-right font-mono text-xs tnum ${
                signed ? tone(v) : "text-slate-300"
              }`}
            >
              {format(v)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function Markets() {
  const [region, setRegion] = useState("in");
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState("1y");
  const [series, setSeries] = useState<Point[]>([]);
  const [yearSeries, setYearSeries] = useState<Point[]>([]);
  const [sectorTab, setSectorTab] = useState<"returns" | "valuation">("returns");
  const [returnWindow, setReturnWindow] = useState<WindowKey>("day");
  // Fetched windows, kept per region+window so switching back is instant and
  // does not re-run a request that reads history for a few hundred companies.
  const [windows, setWindows] = useState<Record<string, WindowResult | null>>({});
  const [windowState, setWindowState] = useState<"idle" | "loading">("idle");
  const [moverTab, setMoverTab] = useState<"gainers" | "losers">("gainers");

  useEffect(() => {
    let off = false;
    setLoading(true);
    setData(null);
    fetch(`/api/markets?region=${encodeURIComponent(region)}`)
      .then((r) => r.json())
      .then((d: Overview) => {
        if (!off) setData(d?.ok ? d : null);
      })
      .catch(() => {})
      .finally(() => {
        if (!off) setLoading(false);
      });
    return () => {
      off = true;
    };
  }, [region]);

  const indexSymbol = data?.indexSymbol;

  useEffect(() => {
    if (!indexSymbol) return;
    let off = false;
    fetch(`/api/timeseries/${encodeURIComponent(indexSymbol)}?range=${range}`)
      .then((r) => r.json())
      .then((d: { points?: Point[] }) => {
        if (!off) setSeries(Array.isArray(d?.points) ? d.points : []);
      })
      .catch(() => {
        if (!off) setSeries([]);
      });
    return () => {
      off = true;
    };
  }, [indexSymbol, range]);

  // The return strip always reads a one-year series, whatever the chart shows —
  // otherwise switching the chart to 10Y would silently change what "7 days"
  // was measured from.
  useEffect(() => {
    if (!indexSymbol) return;
    let off = false;
    fetch(`/api/timeseries/${encodeURIComponent(indexSymbol)}?range=1y`)
      .then((r) => r.json())
      .then((d: { points?: Point[] }) => {
        if (!off) setYearSeries(Array.isArray(d?.points) ? d.points : []);
      })
      .catch(() => {
        if (!off) setYearSeries([]);
      });
    return () => {
      off = true;
    };
  }, [indexSymbol]);

  // Sector returns for anything longer than today. Fetched on demand, once per
  // region and window: the request reads price history for every company in the
  // market, so loading all four up front would pay that cost four times for the
  // three nobody asked for.
  const windowCacheKey = `${region}:${returnWindow}`;
  useEffect(() => {
    if (returnWindow === "day") return;
    if (windows[windowCacheKey] !== undefined) return; // already fetched, or known empty
    let off = false;
    setWindowState("loading");
    fetch(`/api/markets/returns?region=${encodeURIComponent(region)}&window=${encodeURIComponent(returnWindow)}`)
      .then((r) => r.json())
      .then((d: { ok?: boolean; sectors?: BarRow[]; companies?: number; requested?: number }) => {
        if (off) return;
        setWindows((w) => ({
          ...w,
          [windowCacheKey]:
            d?.ok && d.sectors?.length
              ? { sectors: d.sectors, companies: d.companies ?? 0, requested: d.requested ?? 0 }
              : null,
        }));
      })
      .catch(() => {
        if (!off) setWindows((w) => ({ ...w, [windowCacheKey]: null }));
      })
      .finally(() => {
        if (!off) setWindowState("idle");
      });
    return () => {
      off = true;
    };
  }, [region, returnWindow, windowCacheKey, windows]);

  // `undefined` means "not asked yet", which is a loading state; `null` means
  // "asked, nothing came back". Collapsing the two flashes "not available" for a
  // frame every time a window is clicked.
  const fetched = returnWindow === "day" ? undefined : windows[windowCacheKey];
  const windowRows = fetched ?? null;
  // Coverage, stated whenever it is not effectively complete. The bug this
  // replaces was invisible precisely because a 12%-coverage answer rendered
  // exactly like a full one — two sectors, drawn confidently, labelled as the
  // Indian market.
  const coverageNote =
    returnWindow !== "day" && windowRows && windowRows.requested > 0 &&
    windowRows.companies < windowRows.requested * 0.9
      ? `Built from ${windowRows.companies} of the ${windowRows.requested} companies we track in this market — the rest had no usable price history for this window.`
      : null;
  const windowPending = returnWindow !== "day" && (fetched === undefined || windowState === "loading");

  const returns = useMemo(
    () => ({
      "7D": returnOver(yearSeries, 7),
      "3M": returnOver(yearSeries, 91),
      "1Y": returnOver(yearSeries, 365),
      YTD: ytdReturn(yearSeries),
    }),
    [yearSeries]
  );

  const indian = isIndianCurrency(data?.currency);
  const updated = data?.asOf
    ? new Date(data.asOf).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
    : "—";

  // The one-line read at the top, built from the windows that actually resolved.
  const week = returns["7D"];
  const year = returns["1Y"];
  const summary = [
    week == null
      ? null
      : Math.abs(week) < 1
      ? "The market has been flat over the last week."
      : `The market is ${week > 0 ? "up" : "down"} ${Math.abs(week).toFixed(1)}% over the last week.`,
    year == null
      ? null
      : `Over the past year it is ${year > 0 ? "up" : "down"} ${Math.abs(year).toFixed(1)}%.`,
    data?.pe == null
      ? null
      : `Its companies trade on an aggregate ${data.pe.toFixed(1)}x earnings.`,
  ]
    .filter(Boolean)
    .join(" ");

  const leading = (data?.sectors ?? []).filter((s) => s.day > 0).slice(0, 4);
  const cheapest = [...(data?.sectors ?? [])]
    .filter((s) => s.pe != null)
    .sort((a, b) => a.pe! - b.pe!);

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <GlassCard className="overflow-hidden p-0">
        <div className="border-b border-white/[0.06] p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="font-display text-2xl font-semibold text-white sm:text-3xl">
                {data ? `${data.demonym} (${data.indexLabel}) Market Analysis & Valuation` : "Market Analysis & Valuation"}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-1 text-[0.7rem] uppercase tracking-[0.12em] text-slate-500">
                <span>
                  Updated <span className="text-slate-300">{updated}</span>
                </span>
                <span>
                  Data <span className="text-slate-300">Aggregated company quotes</span>
                </span>
                <span>
                  Companies <span className="font-mono tnum text-slate-300">{data?.companies ?? "—"}</span>
                </span>
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-slate-400">
              <span className="sr-only">Market</span>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 outline-none focus:border-gold/40"
              >
                {REGIONS.map((r) => (
                  <option key={r.key} value={r.key} className="bg-ink-900">
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap gap-x-10 gap-y-3">
            {(["7D", "3M", "1Y", "YTD"] as const).map((k) => {
              const v = returns[k];
              return (
                <div key={k}>
                  <div className="text-[0.68rem] uppercase tracking-[0.14em] text-slate-500">{k}</div>
                  <div className={`font-mono text-lg tnum ${v == null ? "text-slate-600" : tone(v)}`}>
                    {v == null ? "—" : pct(v)}
                  </div>
                </div>
              );
            })}
          </div>
          {summary ? <p className="mt-4 max-w-3xl text-sm leading-relaxed text-slate-300">{summary}</p> : null}
          {leading.length ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-[0.68rem] uppercase tracking-[0.14em] text-slate-500">
                Leading sectors today
              </span>
              {leading.map((s) => (
                <span
                  key={s.sector}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-xs text-slate-300"
                >
                  {s.sector} <span className="font-mono tnum text-up">{pct(s.day)}</span>
                </span>
              ))}
            </div>
          ) : null}
          {loading ? <p className="mt-4 text-sm text-slate-500">Aggregating live quotes…</p> : null}
          {!loading && !data ? (
            <p className="mt-4 text-sm text-slate-400">
              Live market data isn&apos;t available right now — the quote source may be rate-limiting.
              Nothing is shown rather than a stale picture of the market.
            </p>
          ) : null}
        </div>
      </GlassCard>

      {/* ── Valuation & performance ────────────────────────────────────── */}
      <GlassCard className="mt-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">Market valuation and performance</h2>
            <p className="mt-1 text-xs text-slate-500">
              How has the {data ? `${data.demonym} market` : "market"} traded, and what does it cost today?
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {RANGES.map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setRange(r.key)}
                className={`rounded-md px-2.5 py-1 text-xs transition ${
                  range === r.key ? "bg-white/10 font-semibold text-white" : "text-slate-400 hover:text-white"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-6">
          <div>
            <div className="text-[0.68rem] uppercase tracking-[0.14em] text-slate-500">
              Aggregate price to earnings
            </div>
            <div className="font-mono text-3xl tnum text-white">
              {data?.pe != null ? `${data.pe.toFixed(1)}x` : "—"}
            </div>
          </div>
          <div>
            <div className="text-[0.68rem] uppercase tracking-[0.14em] text-slate-500">Total market value</div>
            <div className="font-mono text-xl tnum text-slate-300">
              {data ? fmtCompactCur(data.totalMarketCap, indian, "—") : "—"}
            </div>
          </div>
        </div>

        <div className="mt-4">
          {series.length >= 2 ? (
            <IndexChart points={series} label={data?.indexLabel ?? "Index"} />
          ) : (
            <p className="py-10 text-sm text-slate-500">
              Price history for {data?.indexLabel ?? "this index"} isn&apos;t available right now.
            </p>
          )}
        </div>

        <ul className="mt-4 space-y-1.5 text-sm text-slate-300">
          {data?.pe != null ? (
            <li>
              • The {data.demonym} market trades on an aggregate{" "}
              <span className="font-mono tnum text-white">{data.pe.toFixed(1)}x</span> earnings — total market
              value over total earnings across {data.companies} companies, not an average of their individual
              ratios.
            </li>
          ) : null}
          {data?.year != null ? (
            <li>
              • Its companies are{" "}
              <span className={`font-mono tnum ${tone(data.year)}`}>{pct(data.year)}</span> over the last 52
              weeks, weighted by size. (The sector bars below measure a window of price history instead, so the
              two are close rather than identical.)
            </li>
          ) : null}
          <li className="text-slate-500">
            • The chart is the {data?.indexLabel ?? "index"} itself. A P/E line over the same years would need a
            decade of the whole market&apos;s earnings; we hold today&apos;s, so it isn&apos;t drawn rather than
            estimated.
          </li>
        </ul>
      </GlassCard>

      {/* ── Sector trends ──────────────────────────────────────────────── */}
      <GlassCard className="mt-4 p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-white">Sector trends</h2>
        <p className="mt-1 text-xs text-slate-500">
          Which sectors have driven the {data ? `${data.demonym} market` : "market"}, and what do they cost?
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-4 border-b border-white/[0.07]">
            {([
              ["returns", "Returns"],
              ["valuation", "Valuation"],
            ] as const).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSectorTab(k)}
                className={`border-b-2 pb-2 text-sm transition ${
                  sectorTab === k
                    ? "border-gold font-semibold text-white"
                    : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          {sectorTab === "returns" ? (
            <div className="flex flex-wrap gap-1 rounded-lg border border-white/10 bg-white/[0.03] p-1">
              {WINDOWS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setReturnWindow(key)}
                  className={`rounded-md px-2.5 py-1 text-xs transition ${
                    returnWindow === key
                      ? "bg-white/10 font-semibold text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {sectorTab === "returns" ? (
          returnWindow !== "day" && windowRows == null ? (
            <p className="py-6 text-sm text-slate-500">
              {windowPending
                ? `Reading ${WINDOW_LABEL[returnWindow]} of price history for every company…`
                : `${WINDOW_LABEL[returnWindow]} of history isn't available for this market right now.`}
            </p>
          ) : (
            <>
              <SectorBars
                rows={
                  returnWindow === "day"
                    ? (data?.sectors ?? []).map((r) => ({ ...r, change: r.day }))
                    : windowRows?.sectors ?? []
                }
                value={(r) => r.change}
                format={(v) => pct(v)}
                signed
                emptyNote="No sector has enough companies with usable history for this window."
              />
              {/* Say what this was built from when it wasn't built from the
                  market. A partial answer that looks complete is how two
                  sectors got presented as the whole of India. */}
              {coverageNote ? (
                <p className="mt-3 border-t border-white/[0.06] pt-3 text-[0.7rem] leading-relaxed text-slate-500">
                  {coverageNote}
                </p>
              ) : null}
            </>
          )
        ) : (
          <SectorBars
            rows={data?.sectors ?? []}
            value={(r) => r.pe}
            format={(v) => `${v.toFixed(1)}x`}
            signed={false}
            emptyNote="No sector carries enough profitable companies to aggregate a P/E."
          />
        )}

        {sectorTab === "valuation" && cheapest.length >= 2 ? (
          <ul className="mt-4 space-y-1.5 text-sm text-slate-300">
            <li>
              • <span className="text-white">{cheapest[0].sector}</span> is the least expensive sector at{" "}
              <span className="font-mono tnum">{cheapest[0].pe!.toFixed(1)}x</span> earnings, across{" "}
              {cheapest[0].companies} companies.
            </li>
            <li>
              • <span className="text-white">{cheapest[cheapest.length - 1].sector}</span> is the most expensive
              at <span className="font-mono tnum">{cheapest[cheapest.length - 1].pe!.toFixed(1)}x</span>.
            </li>
            <li className="text-slate-500">
              • A sector P/E is total value over total earnings for its companies here — loss-makers are left
              out rather than counted as zero earnings, which would make the ratio infinite.
            </li>
          </ul>
        ) : null}
      </GlassCard>

      {/* ── Movers ─────────────────────────────────────────────────────── */}
      <GlassCard className="mt-4 p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-white">Top gainers and losers</h2>
        <p className="mt-1 text-xs text-slate-500">Which companies have driven the market today?</p>

        <div className="mt-4 flex gap-4 border-b border-white/[0.07]">
          {([
            ["gainers", "Top gainers"],
            ["losers", "Top losers"],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMoverTab(k)}
              className={`border-b-2 pb-2 text-sm transition ${
                moverTab === k
                  ? "border-gold font-semibold text-white"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead>
              <tr className="text-left text-[0.65rem] uppercase tracking-[0.12em] text-slate-500">
                <th className="py-2 font-normal">Company</th>
                <th className="py-2 text-right font-normal">Last price</th>
                <th className="py-2 text-right font-normal">Today</th>
                <th className="py-2 text-right font-normal">1 Year</th>
                <th className="py-2 text-right font-normal">P/E</th>
                <th className="py-2 text-right font-normal">Sector</th>
              </tr>
            </thead>
            <tbody>
              {(moverTab === "gainers" ? data?.gainers : data?.losers)?.map((m) => (
                <tr key={m.symbol} className="border-t border-white/[0.05]">
                  <td className="py-2.5">
                    <Link href={tickerHref(m.symbol)} className="group flex min-w-0 flex-col">
                      <span className="truncate font-medium text-white group-hover:text-gold">{m.name}</span>
                      <span className="font-mono text-[0.68rem] text-slate-500">{m.symbol}</span>
                    </Link>
                  </td>
                  <td className="py-2.5 text-right font-mono tnum text-slate-300">
                    {m.price ? m.price.toLocaleString(undefined, { maximumFractionDigits: 2 }) : "—"}
                  </td>
                  <td className={`py-2.5 text-right font-mono tnum ${tone(m.day)}`}>{pct(m.day)}</td>
                  <td className={`py-2.5 text-right font-mono tnum ${m.year == null ? "text-slate-600" : tone(m.year)}`}>
                    {m.year == null ? "—" : pct(m.year)}
                  </td>
                  <td className="py-2.5 text-right font-mono tnum text-slate-400">
                    {m.pe != null && m.pe > 0 ? `${m.pe.toFixed(1)}x` : "—"}
                  </td>
                  <td className="py-2.5 text-right text-xs text-slate-400">{m.sector}</td>
                </tr>
              ))}
              {!loading && !(moverTab === "gainers" ? data?.gainers : data?.losers)?.length ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                    No live movers right now.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <p className="mt-4 text-[0.7rem] leading-relaxed text-slate-500">
        Aggregated from live quotes for the {data?.companies ?? 0} largest listings we track in this market —
        not every listed company. Research only, not advice.
      </p>
    </section>
  );
}
