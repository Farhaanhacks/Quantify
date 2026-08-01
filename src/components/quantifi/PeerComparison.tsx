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
  if (!n || !isFinite(n)) return "—";
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
  const [section, setSection] = useState<"overall" | "historical">("overall");

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
  }[] = [
    { key: "ret", label: `Total Return · ${range.toUpperCase()}`, get: (r) => r.totalReturn, fmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` },
    { key: "rev", label: "Revenue Growth · 1Y", get: (r) => (r.revGrowth != null ? r.revGrowth * 100 : undefined), fmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` },
    { key: "pe", label: "P/E · trailing", get: (r) => r.pe, fmt: (v) => `${v.toFixed(1)}x` },
    { key: "score", label: "Quantifi Score", get: (r) => r.score, fmt: (v) => `${v.toFixed(0)} / 30`, max: 30 },
  ];

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
        subtitle="An automatic side-by-side of this company and its competitors — an overall snapshot of the key metrics, and a price chart rebased to % return so different-priced names compare on one scale. Live data, research only."
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
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {metrics.map((m) => {
                    const maxAbs = Math.max(
                      m.max ?? 0,
                      1,
                      ...rows.map((r) => { const v = m.get(r); return typeof v === "number" ? Math.abs(v) : 0; })
                    );
                    return (
                      <div key={m.key} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
                        <div className="text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">{m.label}</div>
                        <div className="mt-3 space-y-2">
                          {rows.map((r, i) => {
                            const v = m.get(r);
                            const w = typeof v === "number" ? Math.min(100, (Math.abs(v) / maxAbs) * 100) : 0;
                            return (
                              <div key={r.symbol} className="flex items-center gap-2">
                                <span className="w-16 flex-none truncate font-mono text-[0.7rem] text-slate-300">{r.symbol}</span>
                                <div className="h-5 flex-1 overflow-hidden rounded bg-white/[0.04]">
                                  <div className="h-full rounded" style={{ width: `${w}%`, backgroundColor: CMP_COLORS[i % CMP_COLORS.length] }} />
                                </div>
                                <span className="w-16 flex-none text-right font-mono text-[0.7rem] text-white">{typeof v === "number" ? m.fmt(v) : "—"}</span>
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
                        {rows.map((r) => <td key={r.symbol} className="py-2 pr-4 text-slate-200">{r.name ?? "—"}</td>)}
                      </tr>
                      <tr className="border-b border-white/[0.06]">
                        <td className="py-2 pr-4 text-slate-400">Price</td>
                        {rows.map((r) => <td key={r.symbol} className="py-2 pr-4 text-slate-200">{typeof r.price === "number" ? fmtMoney(r.price, r.currency) : "—"}</td>)}
                      </tr>
                      <tr className="border-b border-white/[0.06]">
                        <td className="py-2 pr-4 text-slate-400">Market cap</td>
                        {rows.map((r) => <td key={r.symbol} className="py-2 pr-4 text-slate-200">{cmpCap(r.marketCap)}</td>)}
                      </tr>
                      <tr className="border-b border-white/10">
                        <td className="py-2 pr-4 font-medium text-gold">Quantifi Score</td>
                        {rows.map((r) => <td key={r.symbol} className="py-2 pr-4 font-semibold text-gold">{r.scoreAvailable && typeof r.score === "number" ? `${r.score} / 30` : "—"}</td>)}
                      </tr>
                    </tbody>
                  </table>
                  {rows.some((r) => !r.scoreAvailable) ? (
                    <p className="mt-3 text-xs text-slate-500">A &quot;—&quot; score usually means an ETF or index, which has no company fundamentals to score.</p>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="mt-4">
                {(() => {
                  const normed = rows
                    .map((r, idx) => {
                      const s = r.series ?? [];
                      if (s.length < 2) return null;
                      const first = s[0].v;
                      const pts = s.map((p, i) => ({ x: i / (s.length - 1), y: (p.v / first - 1) * 100 }));
                      return { symbol: r.symbol, label: r.name ?? r.symbol, color: CMP_COLORS[idx % CMP_COLORS.length], pts, final: pts[pts.length - 1].y };
                    })
                    .filter((n): n is { symbol: string; label: string; color: string; pts: { x: number; y: number }[]; final: number } => n != null);
                  // Symbols we couldn't chart (no live price history for the ticker —
                  // common for some Korean/OTC listings). Call them out explicitly so
                  // "4 peers but 2 lines" never reads as a broken chart.
                  const missing = rows.filter((r) => (r.series?.length ?? 0) < 2).map((r) => r.symbol);
                  if (!normed.length)
                    return (
                      <p className="text-sm text-slate-500">
                        Price history isn&apos;t available for {missing.length ? missing.join(", ") : "these symbols"}.
                      </p>
                    );
                  let lo = 0, hi = 0;
                  normed.forEach((n) => n.pts.forEach((p) => { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }));
                  const span = hi - lo || 1;
                  const W = 820, H = 320, pad = 10;
                  const X = (x: number) => pad + x * (W - 2 * pad);
                  const Y = (y: number) => H - pad - ((y - lo) / span) * (H - 2 * pad);
                  const dated = rows.find((r) => (r.series?.length ?? 0) > 1)?.series;
                  return (
                    <>
                      <div className="flex flex-wrap items-center gap-4 text-xs">
                        {normed.map((n) => (
                          <span key={n.symbol} className="flex items-center gap-1.5">
                            <span className="h-2 w-2 flex-none rounded-full" style={{ backgroundColor: n.color }} />
                            <span className="max-w-[13rem] truncate text-slate-200" title={n.symbol}>{n.label}</span>
                            {n.label !== n.symbol ? (
                              <span className="font-mono text-[0.68rem] text-slate-500">{n.symbol}</span>
                            ) : null}
                            <span className="font-mono font-semibold" style={{ color: n.color }}>{n.final >= 0 ? "+" : ""}{n.final.toFixed(1)}%</span>
                          </span>
                        ))}
                        {missing.length ? (
                          <span className="font-mono text-slate-600">no price history: {missing.join(", ")}</span>
                        ) : null}
                      </div>
                      <div className="mt-3 rounded-lg border border-white/[0.08] bg-white/[0.02] p-3">
                        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 320 }} preserveAspectRatio="none">
                          <line x1={pad} x2={W - pad} y1={Y(0)} y2={Y(0)} stroke="rgba(255,255,255,0.14)" strokeWidth="1" strokeDasharray="5 5" />
                          {normed.map((n) => (
                            <polyline key={n.symbol} fill="none" stroke={n.color} strokeWidth="2" vectorEffect="non-scaling-stroke" points={n.pts.map((p) => `${X(p.x)},${Y(p.y)}`).join(" ")} />
                          ))}
                        </svg>
                        <div className="mt-1 flex justify-between text-[0.6rem] text-slate-500">
                          <span className="font-mono">{dated?.[0]?.t ?? ""}</span>
                          <span>Rebased to % return · {range.toUpperCase()}</span>
                          <span className="font-mono">{dated?.[dated.length - 1]?.t ?? ""}</span>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        Each line is rebased to its % change from the start of the window, so names at very different prices compare on one scale. Live prices, best-effort — research only, not advice.
                      </p>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}
      </GlassCard>
    </section>
  );
}
