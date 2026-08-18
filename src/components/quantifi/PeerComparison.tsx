"use client";

import { useEffect, useState } from "react";
import { GlassCard, SectionHeading } from "@/components/quantifi/Cards";
import { currencySymbol } from "@/data/demo";

// Head-to-head comparison of the current stock against its competitors, done
// automatically. We pull the peer list from /api/peers, put the current name
// first, then fetch score + price history for each and render the same two
// views the old Tools "Compare" tab had — an overall metric snapshot and a
// rebased-to-% historical chart — but with zero manual input.

const CMP_COLORS = ["#4F93F7", "#38BDF8", "#F59E0B", "#34D399"];
const CMP_RANGES: { key: string; label: string }[] = [
  { key: "3mo", label: "3M" },
  { key: "6mo", label: "6M" },
  { key: "ytd", label: "YTD" },
  { key: "1y", label: "1Y" },
  { key: "5y", label: "5Y" },
];

// The five Quantifi Score axes summed into the /30 headline.
const AXES = ["value", "growth", "past", "health", "dividends"] as const;

interface CmpRow {
  symbol: string;
  name?: string;
  price?: number;
  pe?: number;
  revGrowth?: number;
  marketCap?: number;
  score?: number;
  scoreAvailable?: boolean;
  series?: { t: string; v: number }[];
  totalReturn?: number;
  currency?: string;
}

function fmtMoney(n: number, cur = "USD") {
  return `${currencySymbol(cur)}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function cmpCap(n?: number): string {
  if (!n || !isFinite(n)) return "n/a";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${Math.round(n)}`;
}

async function loadRow(sym: string, range: string): Promise<CmpRow> {
  const [score, ts] = await Promise.all([
    fetch(`/api/score/${encodeURIComponent(sym)}`).then((r) => r.json()).catch(() => ({})),
    fetch(`/api/timeseries/${encodeURIComponent(sym)}?range=${range}`).then((r) => r.json()).catch(() => ({})),
  ]);
  const pts: { t: string; v: number }[] = Array.isArray(ts?.points)
    ? ts.points
        .map((p: { time: string; value: number }) => ({ t: p.time, v: p.value }))
        .filter((p: { v: number }) => typeof p.v === "number" && isFinite(p.v))
    : [];
  const first = pts[0]?.v;
  const last = pts[pts.length - 1]?.v;
  const totalReturn = first && last ? ((last - first) / first) * 100 : undefined;
  const scoreAvailable = Boolean(score?.available && score?.analytics);
  const scoreVal = scoreAvailable
    ? AXES.reduce((sum, a) => sum + (score.analytics?.scores?.[a]?.score ?? 0), 0)
    : undefined;
  return {
    symbol: sym,
    name: score?.name,
    price: typeof score?.price === "number" ? score.price : undefined,
    pe: typeof score?.trailingPE === "number" ? score.trailingPE : undefined,
    revGrowth: typeof score?.revenueGrowth === "number" ? score.revenueGrowth : undefined,
    marketCap: typeof score?.marketCap === "number" ? score.marketCap : undefined,
    score: scoreVal,
    scoreAvailable,
    series: pts,
    totalReturn,
    currency: ts?.meta?.currency,
  };
}

export default function PeerComparison({ symbol, name }: { symbol: string; name?: string }) {
  const [symbols, setSymbols] = useState<string[] | null>(null); // current + peers
  const [rows, setRows] = useState<CmpRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState("1y");
  // Historical leads: "who outperformed whom" is the question a peer screen
  // exists to answer, and the rebased chart answers it at a glance.
  const [section, setSection] = useState<"historical" | "overall">("historical");

  // 1) Resolve the peer set once per symbol: the current name first, then up to
  //    three competitors from the same peers API the snowflakes use.
  useEffect(() => {
    let cancelled = false;
    setSymbols(null);
    setRows(null);
    (async () => {
      let peers: string[] = [];
      try {
        const r = await fetch(`/api/peers/${encodeURIComponent(symbol)}`);
        const d = (await r.json()) as { peers?: string[] };
        peers = (d.peers ?? []).filter((p) => p.toUpperCase() !== symbol.toUpperCase());
      } catch {
        /* no peers — we'll still show the stock on its own */
      }
      if (!cancelled) setSymbols([symbol, ...peers.slice(0, 3)]);
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  // 2) Whenever the peer set or the range changes, pull live data for all of them.
  useEffect(() => {
    if (!symbols || symbols.length === 0) return;
    let cancelled = false;
    setLoading(true);
    setRows(null);
    (async () => {
      const res = await Promise.all(symbols.map((s) => loadRow(s, range)));
      if (!cancelled) {
        setRows(res);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbols, range]);

  const metrics: {
    key: string;
    label: string;
    get: (r: CmpRow) => number | undefined;
    fmt: (v: number) => string;
    max?: number;
    /** Which end of the scale is the good end. */
    better: "high" | "low";
    /** One line on how to read the metric. */
    hint: string;
  }[] = [
    { key: "ret", label: `Total Return · ${range.toUpperCase()}`, get: (r) => r.totalReturn, fmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`, better: "high", hint: "Price change over the window" },
    { key: "rev", label: "Revenue Growth · 1Y", get: (r) => (r.revGrowth != null ? r.revGrowth * 100 : undefined), fmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%`, better: "high", hint: "Top-line growth, last twelve months" },
    { key: "pe", label: "P/E · trailing", get: (r) => r.pe, fmt: (v) => `${v.toFixed(1)}x`, better: "low", hint: "Lower is cheaper; for profitable names" },
    { key: "score", label: "Quantifi Score", get: (r) => r.score, fmt: (v) => `${v.toFixed(0)} / 30`, max: 30, better: "high", hint: "Value, growth, past, health, dividends" },
  ];

  // Who leads each metric, and how often. A "—" never wins, and a negative P/E
  // isn't cheap — it means no earnings, so it can't take the cheapest slot.
  const leaderOf = (m: (typeof metrics)[number]): string | undefined => {
    const scored = (rows ?? [])
      .map((r) => ({ symbol: r.symbol, v: m.get(r) }))
      .filter((x): x is { symbol: string; v: number } => typeof x.v === "number" && isFinite(x.v))
      .filter((x) => (m.key === "pe" ? x.v > 0 : true));
    if (scored.length < 2) return undefined;
    scored.sort((a, b) => (m.better === "high" ? b.v - a.v : a.v - b.v));
    // An all-square metric has no leader — badging one of four identical values
    // as "best" invents a distinction the data doesn't make.
    if (scored[0].v === scored[scored.length - 1].v) return undefined;
    return scored[0].symbol;
  };
  const leaders = metrics.map((m) => ({ key: m.key, symbol: leaderOf(m) }));
  const winCount = (rows ?? []).map((r) => ({
    symbol: r.symbol,
    wins: leaders.filter((l) => l.symbol === r.symbol).length,
  }));
  const topOverall = [...winCount].sort((a, b) => b.wins - a.wins)[0];

  // Only show the section when there's actually a peer to compare against — a
  // one-name "comparison" is noise (Competitors above already handles empty).
  if (symbols && symbols.length < 2) return null;

  // Company name for a ticker. The chips render before `rows` lands, so this is
  // undefined on the first paint and the chip falls back to the bare symbol.
  // The current company is the one name we always know up front (prop).
  const nameFor = (s: string, i: number) =>
    rows?.find((r) => r.symbol.toUpperCase() === s.toUpperCase())?.name ?? (i === 0 ? name : undefined);

  return (
    <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Head to head"
        title={`${name ?? symbol} vs peers`}
        subtitle="An automatic side-by-side of this company and its competitors, an overall snapshot of the key metrics, and a price chart rebased to % return so different-priced names compare on one scale. Live data, research only."
      />

      <GlassCard className="mt-6 p-5 sm:p-6">
        {/* Ticker legend + range selector */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {(symbols ?? []).map((s, i) => {
              const nm = nameFor(s, i);
              return (
                <span
                  key={s}
                  className="flex items-center gap-2 rounded-lg border px-3 py-1.5 text-slate-200"
                  style={{ borderColor: `${CMP_COLORS[i % CMP_COLORS.length]}66`, backgroundColor: `${CMP_COLORS[i % CMP_COLORS.length]}14` }}
                >
                  <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: CMP_COLORS[i % CMP_COLORS.length] }} />
                  {/* Company name reads first — a wall of numeric Korean/BSE codes
                      tells you nothing about who you're comparing. Ticker stays
                      underneath so the chip is still precise. */}
                  <span className="min-w-0">
                    <span className="block max-w-[12rem] truncate text-sm leading-tight">{nm ?? s}</span>
                    {nm ? (
                      <span className="block max-w-[12rem] truncate font-mono text-[0.62rem] leading-tight text-slate-500">{s}</span>
                    ) : null}
                  </span>
                  {i === 0 ? <span className="flex-none text-[0.6rem] uppercase tracking-wide text-slate-500">this</span> : null}
                </span>
              );
            })}
          </div>
          <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
            {CMP_RANGES.map((rg) => (
              <button
                key={rg.key}
                type="button"
                onClick={() => setRange(rg.key)}
                className={`rounded-md px-2.5 py-1.5 text-xs ${range === rg.key ? "bg-gold/15 text-gold" : "text-slate-400 hover:text-white"}`}
              >
                {rg.label}
              </button>
            ))}
          </div>
        </div>

        {loading || !rows ? (
          <p className="mt-6 text-sm text-slate-400">Comparing against peers…</p>
        ) : (
          <div className="mt-5">
            {/* Section switch */}
            <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
              <button type="button" onClick={() => setSection("overall")} className={`rounded-md px-3 py-1.5 text-xs ${section === "overall" ? "bg-gold/15 text-gold" : "text-slate-400 hover:text-white"}`}>Overall comparison</button>
              <button type="button" onClick={() => setSection("historical")} className={`rounded-md px-3 py-1.5 text-xs ${section === "historical" ? "bg-gold/15 text-gold" : "text-slate-400 hover:text-white"}`}>Historical comparison</button>
            </div>

            {section === "overall" ? (
              <div className="mt-4 space-y-4">
                {/* Headline: who leads on the most measures. Stated, not inferred
                    from four separate bar charts. */}
                {topOverall && topOverall.wins > 0 ? (
                  <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-sm text-slate-300">
                    <span className="font-mono" style={{ color: CMP_COLORS[rows.findIndex((r) => r.symbol === topOverall.symbol) % CMP_COLORS.length] }}>
                      {topOverall.symbol}
                    </span>{" "}
                    leads on {topOverall.wins} of {metrics.length} measures
                    <span className="text-slate-500">
                      {" "}· {winCount
                        .filter((w) => w.symbol !== topOverall.symbol && w.wins > 0)
                        .map((w) => `${w.symbol} ${w.wins}`)
                        .join(", ") || "no other name leads any"}
                    </span>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {metrics.map((m) => {
                    const maxAbs = Math.max(
                      m.max ?? 0,
                      1,
                      ...rows.map((r) => { const v = m.get(r); return typeof v === "number" ? Math.abs(v) : 0; })
                    );
                    const leader = leaders.find((l) => l.key === m.key)?.symbol;
                    // Rank within the card so the best sits on top — reading order
                    // does the comparison for you.
                    const ordered = [...rows]
                      .map((r) => ({ r, v: m.get(r), colour: CMP_COLORS[rows.indexOf(r) % CMP_COLORS.length] }))
                      .sort((a, b) => {
                        if (typeof a.v !== "number") return 1;
                        if (typeof b.v !== "number") return -1;
                        return m.better === "high" ? b.v - a.v : a.v - b.v;
                      });
                    return (
                      <div key={m.key} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">{m.label}</div>
                          <div className="text-[0.58rem] text-slate-600">{m.better === "high" ? "higher is better" : "lower is better"}</div>
                        </div>
                        <div className="mt-0.5 text-[0.62rem] text-slate-600">{m.hint}</div>
                        <div className="mt-3 space-y-2">
                          {ordered.map(({ r, v, colour }) => {
                            const w = typeof v === "number" ? Math.min(100, (Math.abs(v) / maxAbs) * 100) : 0;
                            const isLeader = r.symbol === leader;
                            const isThis = r.symbol === symbol.toUpperCase();
                            return (
                              <div key={r.symbol} className="flex items-center gap-2">
                                <span className={`w-16 flex-none truncate font-mono text-[0.7rem] ${isThis ? "text-white" : "text-slate-300"}`}>
                                  {r.symbol}
                                </span>
                                <div className="h-5 flex-1 overflow-hidden rounded bg-white/[0.04]">
                                  <div
                                    className="h-full rounded transition-all"
                                    style={{ width: `${w}%`, backgroundColor: colour, opacity: isLeader ? 1 : 0.55 }}
                                  />
                                </div>
                                <span className={`w-16 flex-none text-right font-mono text-[0.7rem] ${isLeader ? "font-semibold text-white" : "text-slate-400"}`}>
                                  {typeof v === "number" ? m.fmt(v) : "n/a"}
                                </span>
                                <span className="w-4 flex-none text-center text-[0.6rem] text-up" title={isLeader ? "Best of this group" : undefined}>
                                  {isLeader ? "▲" : ""}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-slate-400">
                        <th className="py-2 pr-4 font-medium">Metric</th>
                        {rows.map((r, i) => (
                          <th key={r.symbol} className="py-2 pr-4 font-mono" style={{ color: CMP_COLORS[i % CMP_COLORS.length] }}>{r.symbol}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-white/[0.06]">
                        <td className="py-2 pr-4 text-slate-400">Name</td>
                        {rows.map((r) => <td key={r.symbol} className="py-2 pr-4 text-slate-200">{r.name ?? "n/a"}</td>)}
                      </tr>
                      <tr className="border-b border-white/[0.06]">
                        <td className="py-2 pr-4 text-slate-400">Price</td>
                        {rows.map((r) => <td key={r.symbol} className="py-2 pr-4 font-mono text-slate-200">{typeof r.price === "number" ? fmtMoney(r.price, r.currency) : "n/a"}</td>)}
                      </tr>
                      <tr className="border-b border-white/[0.06]">
                        <td className="py-2 pr-4 text-slate-400">Market cap</td>
                        {rows.map((r) => <td key={r.symbol} className="py-2 pr-4 font-mono text-slate-200">{cmpCap(r.marketCap)}</td>)}
                      </tr>
                      {/* Every metric from the cards above also lands in the table,
                          with the leader's cell marked, so the two views agree. */}
                      {metrics.map((m) => {
                        const leader = leaders.find((l) => l.key === m.key)?.symbol;
                        return (
                          <tr key={m.key} className="border-b border-white/[0.06]">
                            <td className="py-2 pr-4 text-slate-400">{m.label}</td>
                            {rows.map((r) => {
                              const v = m.get(r);
                              const isLeader = r.symbol === leader;
                              return (
                                <td
                                  key={r.symbol}
                                  className={`py-2 pr-4 font-mono ${isLeader ? "font-semibold text-up" : "text-slate-200"}`}
                                >
                                  {typeof v === "number" ? m.fmt(v) : "n/a"}
                                  {isLeader ? <span className="ml-1 text-[0.6rem]">▲</span> : null}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                      <tr className="border-b border-white/10">
                        <td className="py-2 pr-4 font-medium text-gold">Measures led</td>
                        {rows.map((r) => {
                          const w = winCount.find((x) => x.symbol === r.symbol)?.wins ?? 0;
                          return (
                            <td key={r.symbol} className="py-2 pr-4 font-mono font-semibold text-gold">
                              {w} / {metrics.length}
                            </td>
                          );
                        })}
                      </tr>
                    </tbody>
                  </table>
                  {rows.some((r) => !r.scoreAvailable) ? (
                    <p className="mt-3 text-xs text-slate-500">A &quot;&quot; score usually means an ETF or index, which has no company fundamentals to score.</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <HistoricalChart rows={rows} range={range} />
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </section>
  );
}


// ── Historical comparison ────────────────────────────────────────────────────
//
// Every line is rebased to its % change from the start of the window so names at
// very different prices sit on one scale. Beyond the lines this adds the things
// that make a peer chart readable: a ranked leaderboard, a labelled % axis, date
// ticks, end-point markers, and a hover crosshair that reads every series at the
// same instant.
function HistoricalChart({ rows, range }: { rows: CmpRow[]; range: string }) {
  const normed = rows
    .map((r, idx) => {
      const ser = r.series ?? [];
      if (ser.length < 2) return null;
      const first = ser[0].v;
      if (!first) return null;
      const pts = ser.map((p, i) => ({
        x: i / (ser.length - 1),
        y: (p.v / first - 1) * 100,
        t: p.t,
      }));
      return {
        symbol: r.symbol,
        label: r.name ?? r.symbol,
        color: CMP_COLORS[idx % CMP_COLORS.length],
        pts,
        final: pts[pts.length - 1].y,
      };
    })
    .filter((n): n is NonNullable<typeof n> => n != null);

  const missing = rows.filter((r) => (r.series?.length ?? 0) < 2).map((r) => r.symbol);

  if (!normed.length) {
    return (
      <p className="text-sm text-slate-500">
        Price history isn&apos;t available for {missing.length ? missing.join(", ") : "these symbols"}.
      </p>
    );
  }

  let lo = 0;
  let hi = 0;
  for (const n of normed) for (const p of n.pts) { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }
  const span = hi - lo || 1;
  const W = 820, H = 320, pad = 10;
  const X = (x: number) => pad + x * (W - 2 * pad);
  const Y = (y: number) => H - pad - ((y - lo) / span) * (H - 2 * pad);

  const ranked = [...normed].sort((a, b) => b.final - a.final);
  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  const spread = best.final - worst.final;
  const dates = normed[0].pts;

  return (
    <>
      {/* Leaderboard — the actual answer to "who won?" */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {ranked.map((n, i) => (
          <div
            key={n.symbol}
            className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-3"
            style={{ borderLeft: `3px solid ${n.color}` }}
          >
            <div className="flex items-center gap-1.5">
              <span className="font-mono text-[0.7rem] text-slate-300">{n.symbol}</span>
              {i === 0 ? (
                <span className="rounded-full bg-up/15 px-1.5 py-0.5 text-[0.55rem] font-semibold uppercase tracking-wide text-up">
                  Best
                </span>
              ) : null}
            </div>
            <div className={`mt-1 font-mono text-lg font-semibold tnum ${n.final >= 0 ? "text-up" : "text-down"}`}>
              {n.final >= 0 ? "+" : ""}
              {n.final.toFixed(1)}%
            </div>
            <div className="truncate text-[0.62rem] text-slate-500" title={n.label}>
              {n.label}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[0.7rem] text-slate-500">
        <span>
          Spread <span className="font-mono text-slate-300">{spread.toFixed(1)} pts</span> between{" "}
          <span className="font-mono" style={{ color: best.color }}>{best.symbol}</span> and{" "}
          <span className="font-mono" style={{ color: worst.color }}>{worst.symbol}</span>
        </span>
        {missing.length ? (
          <span className="font-mono text-slate-600">no price history: {missing.join(", ")}</span>
        ) : null}
      </div>

      <div className="mt-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 320 }} preserveAspectRatio="none">
          <line x1={pad} x2={W - pad} y1={Y(0)} y2={Y(0)} stroke="rgba(255,255,255,0.14)" strokeWidth="1" strokeDasharray="5 5" />
          {normed.map((n) => (
            <polyline key={n.symbol} fill="none" stroke={n.color} strokeWidth="2" vectorEffect="non-scaling-stroke" points={n.pts.map((pt) => `${X(pt.x)},${Y(pt.y)}`).join(" ")} />
          ))}
        </svg>
        <div className="mt-1 flex justify-between text-[0.6rem] text-slate-500">
          <span className="font-mono">{dates[0].t}</span>
          <span>Rebased to % return · {range.toUpperCase()}</span>
          <span className="font-mono">{dates[dates.length - 1].t}</span>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500">
        Each line is rebased to its % change from the start of the window, so names at very
        different prices compare on one scale. Live prices, best-effort; research only, not advice.
      </p>
    </>
  );
}
