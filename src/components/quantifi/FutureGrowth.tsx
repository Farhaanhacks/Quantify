"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/quantifi/Cards";
import { currencySymbol } from "@/data/demo";
import type { GrowthCheck, GrowthForecast, TrendPoint } from "@/lib/futureGrowth";

// The Future Growth section: what analysts expect, and how far that is worth
// trusting.
//
// Everything here is a forecast, so the section is built to keep that visible.
// Three rules run through it:
//
//   1. The horizon travels with the rate. A number derived from one estimated
//      year is labelled "per year, 1 year out"; only where a long-term rate
//      exists does it say three. Stretching one year of consensus across three
//      and calling it a 3-year rate is the easiest lie to tell on this page.
//   2. A comparison we cannot make is grey, not red. "Slower than its peers"
//      and "we could not find peer forecasts" are different claims.
//   3. Analyst estimates are drawn as their own region of the chart, separated
//      from reported history by a marked line, never as one continuous series.

interface PeerAgg {
  symbols: string[];
  epsGrowth?: number;
  revenueGrowth?: number;
  futureRoe?: number;
}

interface PastRow {
  date: string;
  revenue?: number;
  earnings?: number;
}

interface Payload {
  available: boolean;
  reason?: string;
  message?: string;
  name?: string;
  currency?: string;
  forecast?: GrowthForecast;
  checks?: GrowthCheck[];
  tally?: { passed: number; assessed: number; total: number };
  peers?: PeerAgg;
  riskFreeRate?: number;
  past?: PastRow[];
  estimates?: TrendPoint[];
}

const pct = (x?: number, digits = 1) =>
  x == null || !isFinite(x) ? "n/a" : `${(x * 100).toFixed(digits)}%`;

function compact(n?: number, symbol = ""): string {
  if (n == null || !isFinite(n)) return "n/a";
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e12) return `${s}${symbol}${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${s}${symbol}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}${symbol}${(a / 1e6).toFixed(1)}M`;
  return `${s}${symbol}${Math.round(a).toLocaleString()}`;
}

function Tick({ passed }: { passed?: boolean }) {
  if (passed == null) {
    return (
      <span
        title="Not enough data to assess"
        className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border border-white/15 text-[0.6rem] text-slate-500"
      >
        ?
      </span>
    );
  }
  return passed ? (
    <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border border-up/50 text-up">
      <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
        <path d="M3 8.5l3.2 3.2L13 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  ) : (
    <span className="inline-flex h-5 w-5 flex-none items-center justify-center rounded-full border border-down/50 text-down">
      <svg viewBox="0 0 16 16" className="h-3 w-3" aria-hidden="true">
        <path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

/** Company / peers bars, in the order and proportion of the numbers themselves. */
function CompareBars({
  title,
  company,
  peers,
  peerCount,
}: {
  title: string;
  company?: number;
  peers?: number;
  peerCount: number;
}) {
  const rows = [
    { label: "Company", value: company, color: "#4F93F7" },
    { label: `Peer median${peerCount ? ` (${peerCount})` : ""}`, value: peers, color: "#4FD1C5" },
  ].filter((r) => r.value != null) as { label: string; value: number; color: string }[];

  if (!rows.length) {
    return (
      <div>
        <p className="text-xs text-slate-500">{title}: no forecasts to compare.</p>
      </div>
    );
  }
  // Scale to the largest bar, with a floor so a small positive rate is still a
  // visible bar rather than a hairline.
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 0.01);

  return (
    <div>
      <div className="flex h-40 items-end gap-4">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-1 flex-col items-center justify-end">
            <span className="mb-1 font-display text-base font-semibold text-white">{pct(r.value)}</span>
            <div
              className="w-full rounded-t"
              style={{
                height: `${Math.max(6, (Math.abs(r.value) / max) * 120)}px`,
                backgroundColor: r.color,
                opacity: r.value < 0 ? 0.45 : 1,
              }}
            >
              <span className="block px-2 pt-1 text-[0.6rem] font-medium text-ink">{r.label}</span>
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 border-t border-white/[0.06] pt-2 text-xs text-slate-400">{title}</p>
    </div>
  );
}

/** Reported history and analyst estimates, kept visibly apart. */
function ForecastChart({
  past,
  estimates,
  currency,
}: {
  past: PastRow[];
  estimates: TrendPoint[];
  currency?: string;
}) {
  const sym = currencySymbol(currency);
  const est = estimates.filter((e) => e.revAvg != null || e.epsAvg != null);
  const series = [
    ...past.map((p) => ({
      label: p.date.slice(0, 4),
      revenue: p.revenue,
      earnings: p.earnings,
      forecast: false,
    })),
    ...est.map((e) => ({
      label: e.period === "0y" ? "This yr" : "Next yr",
      revenue: e.revAvg,
      earnings: undefined as number | undefined,
      forecast: true,
    })),
  ];
  const values = series.flatMap((s) => [s.revenue, s.earnings].filter((v): v is number => v != null));
  if (values.length < 2) return null;
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;
  const h = (v?: number) => (v == null ? 0 : ((v - min) / span) * 150);
  const firstForecast = series.findIndex((s) => s.forecast);

  return (
    <div>
      <p className="mb-1 text-[0.6rem] text-slate-500">
        top of scale {compact(max, sym)}
      </p>
      <div className="flex items-end gap-1 sm:gap-2" style={{ height: 170 }}>
        {series.map((s, i) => (
          <div key={`${s.label}-${i}`} className="relative flex flex-1 flex-col justify-end">
            {i === firstForecast && firstForecast > 0 ? (
              <span className="absolute -top-1 bottom-0 -left-1 w-px bg-white/20" aria-hidden="true" />
            ) : null}
            <div className="flex items-end justify-center gap-[3px]">
              <div
                className="w-1/2 max-w-[18px] rounded-t bg-[#4F93F7]"
                style={{ height: `${h(s.revenue)}px`, opacity: s.forecast ? 0.55 : 1 }}
                title={`Revenue ${compact(s.revenue, sym)}${s.forecast ? " (estimate)" : ""}`}
              />
              <div
                className="w-1/2 max-w-[18px] rounded-t bg-[#4FD1C5]"
                style={{ height: `${h(s.earnings)}px`, opacity: s.forecast ? 0.55 : 1 }}
                title={`Earnings ${compact(s.earnings, sym)}${s.forecast ? " (estimate)" : ""}`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-1 border-t border-white/[0.08] pt-1 sm:gap-2">
        {series.map((s, i) => (
          <span key={`${s.label}-lbl-${i}`} className="flex-1 text-center text-[0.55rem] text-slate-500">
            {s.label}
          </span>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.65rem] text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-[#4F93F7]" /> Revenue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-sm bg-[#4FD1C5]" /> Earnings
        </span>
        <span className="text-slate-500">
          Paler bars right of the line are analyst estimates, not results. Analysts publish revenue in
          currency but earnings per share, so the forecast side carries revenue only; the per-share
          estimates are in the card below.
        </span>
      </div>
    </div>
  );
}

/** EPS this year and next, with the spread between the lowest and highest analyst. */
function EpsRange({ estimates, currency }: { estimates: TrendPoint[]; currency?: string }) {
  const sym = currencySymbol(currency);
  const rows = estimates.filter((e) => e.epsAvg != null);
  if (!rows.length) return null;
  const all = rows.flatMap((r) => [r.epsLow, r.epsAvg, r.epsHigh].filter((v): v is number => v != null));
  const max = Math.max(...all);
  const min = Math.min(...all, 0);
  const span = max - min || 1;
  const posOf = (v: number) => ((v - min) / span) * 100;

  return (
    <div className="space-y-4">
      {rows.map((r) => {
        const lo = r.epsLow ?? r.epsAvg!;
        const hi = r.epsHigh ?? r.epsAvg!;
        return (
          <div key={r.period}>
            <div className="flex items-baseline justify-between text-xs">
              <span className="text-slate-400">{r.period === "0y" ? "This year" : "Next year"}</span>
              <span className="font-mono tnum text-white">
                {sym}
                {r.epsAvg!.toFixed(2)}
              </span>
            </div>
            <div className="relative mt-2 h-2 rounded-full bg-white/[0.05]">
              <span
                className="absolute h-2 rounded-full bg-[#4FD1C5]/30"
                style={{ left: `${posOf(lo)}%`, width: `${Math.max(1, posOf(hi) - posOf(lo))}%` }}
              />
              <span
                className="absolute -top-0.5 h-3 w-[3px] rounded bg-[#4FD1C5]"
                style={{ left: `${posOf(r.epsAvg!)}%` }}
              />
            </div>
            <div className="mt-1 flex justify-between text-[0.6rem] text-slate-500">
              <span>
                low {sym}
                {lo.toFixed(2)}
              </span>
              {r.epsAnalysts ? <span>{r.epsAnalysts} analysts</span> : null}
              <span>
                high {sym}
                {hi.toFixed(2)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Return-on-equity dial. 0 to 40%, which is where the interesting range sits. */
function RoeGauge({ value, peer }: { value?: number; peer?: number }) {
  if (value == null) return null;
  const capped = Math.max(0, Math.min(0.4, value));
  const angle = -90 + (capped / 0.4) * 180;
  const peerAngle = peer != null ? -90 + (Math.max(0, Math.min(0.4, peer)) / 0.4) * 180 : null;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 116" className="w-full max-w-[220px]" role="img" aria-label="Projected return on equity">
        <path d="M20 100 A80 80 0 0 1 60 31" fill="none" stroke="#DC2626" strokeWidth="12" strokeLinecap="butt" />
        <path d="M60 31 A80 80 0 0 1 100 20" fill="none" stroke="#F59E0B" strokeWidth="12" strokeLinecap="butt" />
        <path d="M100 20 A80 80 0 0 1 180 100" fill="none" stroke="#34D399" strokeWidth="12" strokeLinecap="butt" />
        {peerAngle != null ? (
          <line
            x1="100"
            y1="100"
            x2={100 + 62 * Math.sin((peerAngle * Math.PI) / 180)}
            y2={100 - 62 * Math.cos((peerAngle * Math.PI) / 180)}
            stroke="#7DD3FC"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        ) : null}
        <line
          x1="100"
          y1="100"
          x2={100 + 70 * Math.sin((angle * Math.PI) / 180)}
          y2={100 - 70 * Math.cos((angle * Math.PI) / 180)}
          stroke="#4F93F7"
          strokeWidth="3.5"
          strokeLinecap="round"
        />
        <circle cx="100" cy="100" r="5" fill="#94A3B8" />
        <text x="18" y="112" className="fill-slate-500" style={{ fontSize: 9 }}>0%</text>
        <text x="164" y="112" className="fill-slate-500" style={{ fontSize: 9 }}>40%</text>
      </svg>
      <div className="mt-2 w-full max-w-[220px] space-y-1 text-xs">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-slate-300">
            <span className="h-2 w-2 rounded-sm bg-[#4F93F7]" /> Company
          </span>
          <span className="font-mono tnum text-white">{pct(value)}</span>
        </div>
        {peer != null ? (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-slate-400">
              <span className="h-2 w-2 rounded-sm bg-[#7DD3FC]" /> Peer median
            </span>
            <span className="font-mono tnum text-slate-400">{pct(peer)}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function FutureGrowth({ symbol, name }: { symbol: string; name?: string }) {
  const [data, setData] = useState<Payload | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    (async () => {
      try {
        // Peers first, from the cached route the comparison section already
        // uses, then the forecasts for the company and those peers in one call.
        let peers: string[] = [];
        try {
          const pr = await fetch(`/api/peers/${encodeURIComponent(symbol)}`).then((r) => r.json());
          if (Array.isArray(pr?.peers)) peers = pr.peers.slice(0, 4);
        } catch {
          /* peers are a comparison, not a prerequisite */
        }
        const qs = peers.length ? `?peers=${encodeURIComponent(peers.join(","))}` : "";
        const res = await fetch(`/api/future-growth/${encodeURIComponent(symbol)}${qs}`);
        const json = (await res.json()) as Payload;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (data === undefined) {
    return (
      <section id="sec-future" className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="h-64 animate-pulse rounded-lg border border-white/[0.06] bg-white/[0.02]" />
      </section>
    );
  }
  if (!data || !data.available) {
    // Worth saying out loud rather than rendering nothing: an absent section
    // reads as an oversight, while "nobody publishes forecasts for this name" is
    // a fact about the company's coverage that a reader should have.
    return (
      <section id="sec-future" className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <h3 className="font-display text-lg font-semibold text-white">Future Growth</h3>
        <GlassCard className="mt-3 p-5 text-sm text-slate-400">
          {data?.message ?? "Analyst forecasts aren't available for this listing right now."}
        </GlassCard>
      </section>
    );
  }

  const f = data.forecast!;
  const checks = data.checks ?? [];
  const tally = data.tally ?? { passed: 0, assessed: 0, total: checks.length };
  const peers = data.peers;
  const who = data.name ?? name ?? symbol;
  const horizon = (years: number) => (years === 1 ? "1 year out" : `${years} years out`);

  return (
    <section id="sec-future" className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
      <h3 className="font-display text-lg font-semibold text-white">Future Growth</h3>
      <p className="mt-1 text-xs text-slate-500">
        Analyst consensus, and what it implies. Forecasts are opinions with error bars, not results.
      </p>

      {/* Header: the tally and the plain-language summary */}
      <GlassCard className="mt-4 p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-slate-300">
            Future criteria checks{" "}
            <span className="font-mono text-white">
              {tally.passed}/{tally.total}
            </span>
          </span>
          <span className="flex gap-1.5">
            {checks.map((c) => (
              <Tick key={c.id} passed={c.passed} />
            ))}
          </span>
          {tally.assessed < tally.total ? (
            <span className="text-[0.65rem] text-slate-500">
              {tally.total - tally.assessed} could not be assessed
            </span>
          ) : null}
        </div>
        <p className="mt-3 max-w-4xl text-sm leading-relaxed text-slate-300">
          {f.epsGrowth != null ? (
            <>
              {who} is forecast to grow earnings per share by{" "}
              <span className="font-medium text-white">{pct(f.epsGrowth)}</span> per year ({horizon(f.epsHorizonYears)}).{" "}
            </>
          ) : null}
          {f.revenueGrowth != null ? (
            <>
              Revenue is forecast to grow{" "}
              <span className="font-medium text-white">{pct(f.revenueGrowth)}</span> per year ({horizon(f.revenueHorizonYears)}).{" "}
            </>
          ) : null}
          {f.futureRoe != null ? (
            <>
              Return on equity is projected at{" "}
              <span className="font-medium text-white">{pct(f.futureRoe)}</span> in 3 years.
            </>
          ) : null}
        </p>
      </GlassCard>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Key information */}
        <GlassCard className="p-5">
          <h4 className="font-display text-base font-semibold text-white">Key information</h4>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="border-l-2 border-[#4F93F7] pl-3">
              <p className="font-display text-2xl font-semibold text-white">{pct(f.epsGrowth)}</p>
              <p className="text-[0.65rem] text-slate-500">EPS growth rate</p>
            </div>
            <div className="border-l-2 border-[#4FD1C5] pl-3">
              <p className="font-display text-2xl font-semibold text-white">{pct(f.revenueGrowth)}</p>
              <p className="text-[0.65rem] text-slate-500">Revenue growth rate</p>
            </div>
          </div>
          <dl className="mt-4 divide-y divide-white/[0.06] text-sm">
            {[
              { k: "Peer median EPS growth", v: pct(peers?.epsGrowth) },
              { k: "Peer median revenue growth", v: pct(peers?.revenueGrowth) },
              { k: "Projected return on equity", v: f.futureRoe != null ? pct(f.futureRoe) : "not projected" },
              { k: "10-year government bond", v: pct(data.riskFreeRate) },
              { k: "Analyst coverage", v: f.analysts != null ? `${f.analysts} analysts` : "not disclosed" },
            ].map((row) => (
              <div key={row.k} className="flex items-center justify-between py-2">
                <dt className="text-slate-400">{row.k}</dt>
                <dd className="font-mono tnum text-slate-200">{row.v}</dd>
              </div>
            ))}
          </dl>
          {peers?.symbols?.length ? (
            <p className="mt-3 text-[0.65rem] text-slate-500">
              Peers: {peers.symbols.join(", ")}. Medians, so one extreme forecast cannot drag the comparison.
            </p>
          ) : (
            <p className="mt-3 text-[0.65rem] text-slate-500">
              No peer forecasts were available, so the peer comparisons are unassessed rather than failed.
            </p>
          )}
        </GlassCard>

        {/* Earnings and revenue */}
        <GlassCard className="p-5">
          <h4 className="font-display text-base font-semibold text-white">Earnings and revenue</h4>
          <p className="mt-1 text-xs text-slate-500">Reported years, then analyst estimates.</p>
          <div className="mt-4">
            {data.past?.length ? (
              <ForecastChart past={data.past} estimates={data.estimates ?? []} currency={data.currency} />
            ) : (
              <p className="text-sm text-slate-500">No reported history to chart against the estimates.</p>
            )}
          </div>
        </GlassCard>
      </div>

      {/* Growth vs peers */}
      <GlassCard className="mt-4 p-5">
        <h4 className="font-display text-base font-semibold text-white">Forecast growth against peers</h4>
        <div className="mt-4 grid grid-cols-1 gap-6 sm:grid-cols-2">
          <CompareBars
            title="Forecast annual EPS growth"
            company={f.epsGrowth}
            peers={peers?.epsGrowth}
            peerCount={peers?.symbols?.length ?? 0}
          />
          <CompareBars
            title="Forecast annual revenue growth"
            company={f.revenueGrowth}
            peers={peers?.revenueGrowth}
            peerCount={peers?.symbols?.length ?? 0}
          />
        </div>

        <ul className="mt-6 space-y-3 border-t border-white/[0.06] pt-5">
          {checks.map((c) => (
            <li key={c.id} className="flex gap-3 text-sm">
              <Tick passed={c.passed} />
              <p className="text-slate-400">
                <span
                  className={
                    c.passed == null ? "text-slate-400" : c.passed ? "text-up" : "text-down"
                  }
                >
                  {c.label}:
                </span>{" "}
                {c.detail}
              </p>
            </li>
          ))}
        </ul>
      </GlassCard>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* EPS estimates and their spread */}
        <GlassCard className="p-5">
          <h4 className="font-display text-base font-semibold text-white">Earnings per share estimates</h4>
          <p className="mt-1 text-xs text-slate-500">
            The bar is the range from the lowest to the highest analyst; the mark is the consensus.
          </p>
          <div className="mt-4">
            {data.estimates?.length ? (
              <EpsRange estimates={data.estimates} currency={data.currency} />
            ) : (
              <p className="text-sm text-slate-500">No per-share estimates published.</p>
            )}
          </div>
        </GlassCard>

        {/* Future ROE */}
        <GlassCard className="p-5">
          <h4 className="font-display text-base font-semibold text-white">Return on equity in 3 years</h4>
          {f.futureRoe != null ? (
            <>
              <div className="mt-4">
                <RoeGauge value={f.futureRoe} peer={peers?.futureRoe} />
              </div>
              <p className="mt-4 text-[0.65rem] leading-relaxed text-slate-500">
                Projected, not forecast by analysts: earnings are compounded at the rate above and
                equity is rolled forward by the share of those earnings that is retained rather than
                paid out. Buybacks, share issues and write-downs all move book value and none of them
                are forecast anywhere, so treat this as the arithmetic of the assumptions rather than
                a prediction.
              </p>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">
              Not projected: {f.futureRoeReason ?? "the inputs are missing"}.
            </p>
          )}
        </GlassCard>
      </div>

      <p className="mt-4 text-[0.65rem] leading-relaxed text-slate-500">
        Consensus estimates from public analyst data. Forecasts are frequently wrong, most of all for
        fast-growing companies, and a growth rate is not a reason to buy. Research and education only,
        not investment advice.
      </p>
    </section>
  );
}
