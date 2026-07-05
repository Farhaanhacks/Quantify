"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard, SectionHeading, Tag } from "@/components/quantifi/Cards";
import { popularTickers } from "@/data/popularTickers";

type Tab = "compare" | "cagr" | "dividend" | "lookup";

const TABS: { key: Tab; label: string }[] = [
  { key: "compare", label: "Compare" },
  { key: "cagr", label: "CAGR Calculator" },
  { key: "dividend", label: "Dividend Calculator" },
  { key: "lookup", label: "Symbol Lookup" },
];

const AXES: { key: string; label: string }[] = [
  { key: "value", label: "Value" },
  { key: "growth", label: "Growth" },
  { key: "past", label: "Past" },
  { key: "health", label: "Health" },
  { key: "dividends", label: "Dividends" },
];


function fmtMoney(n: number, cur = "USD") {
  const sym = cur === "INR" ? "₹" : cur === "USD" ? "$" : "";
  return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

// ── Comparison ───────────────────────────────────────────────────────────────
const CMP_COLORS = ["#818CF8", "#38BDF8", "#F59E0B", "#34D399"];
const CMP_RANGES: { key: string; label: string }[] = [
  { key: "6mo", label: "6M" },
  { key: "1y", label: "1Y" },
  { key: "5y", label: "5Y" },
];

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

function cmpCap(n?: number): string {
  if (!n || !isFinite(n)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${Math.round(n)}`;
}

function Compare() {
  const [input, setInput] = useState("");
  const [symbols, setSymbols] = useState<string[]>(["NVDA", "MSFT", "GOOGL"]);
  const [rows, setRows] = useState<CmpRow[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [range, setRange] = useState("1y");
  const [section, setSection] = useState<"overall" | "historical">("overall");

  const add = () => {
    const s = input.trim().toUpperCase();
    if (s && symbols.length < 4 && !symbols.includes(s)) setSymbols([...symbols, s]);
    setInput("");
  };

  const run = async () => {
    if (!symbols.length) return;
    setLoading(true);
    setRows(null);
    const res = await Promise.all(
      symbols.map(async (s): Promise<CmpRow> => {
        let sym = s;
        try {
          const rr = await fetch(`/api/resolve?q=${encodeURIComponent(s)}`);
          const rd = await rr.json();
          if (rd.symbol) sym = String(rd.symbol).toUpperCase();
        } catch {
          /* keep typed symbol */
        }
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
          ? AXES.reduce((sum, a) => sum + (score.analytics?.scores?.[a.key]?.score ?? 0), 0)
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
      })
    );
    setRows(res);
    setLoading(false);
  };

  const metrics: { key: string; label: string; get: (r: CmpRow) => number | undefined; fmt: (v: number) => string; max?: number }[] = [
    { key: "ret", label: `Total Return · ${range.toUpperCase()}`, get: (r) => r.totalReturn, fmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` },
    { key: "rev", label: "Revenue Growth · 1Y", get: (r) => (r.revGrowth != null ? r.revGrowth * 100 : undefined), fmt: (v) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}%` },
    { key: "pe", label: "P/E · trailing", get: (r) => r.pe, fmt: (v) => `${v.toFixed(1)}x` },
    { key: "score", label: "Quantifi Score", get: (r) => r.score, fmt: (v) => `${v.toFixed(0)} / 30`, max: 30 },
  ];

  return (
    <div>
      <p className="text-sm text-slate-400">
        Add up to four stocks or ETFs, then compare them two ways: an{" "}
        <span className="text-slate-200">overall</span> snapshot of the key metrics, and a{" "}
        <span className="text-slate-200">historical</span> price chart rebased to % return so you can compare performance on one scale.
      </p>

      {/* Ticker chips (each keeps a colour, used across both sections) */}
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {symbols.map((s, i) => (
          <span
            key={s}
            className="flex items-center gap-1.5 rounded-full border px-3 py-1.5 font-mono text-sm text-slate-200"
            style={{ borderColor: `${CMP_COLORS[i % CMP_COLORS.length]}66`, backgroundColor: `${CMP_COLORS[i % CMP_COLORS.length]}14` }}
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: CMP_COLORS[i % CMP_COLORS.length] }} />
            {s}
            <button type="button" onClick={() => setSymbols(symbols.filter((x) => x !== s))} className="text-slate-500 hover:text-white" aria-label={`Remove ${s}`}>✕</button>
          </span>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add symbol e.g. NFLX"
          className="w-40 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm uppercase text-white outline-none focus:border-gold/40"
        />
        <button type="button" onClick={add} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:text-white">Add</button>
        <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
          {CMP_RANGES.map((rg) => (
            <button key={rg.key} type="button" onClick={() => setRange(rg.key)} className={`rounded-md px-2.5 py-1.5 text-xs ${range === rg.key ? "bg-gold/15 text-gold" : "text-slate-400 hover:text-white"}`}>{rg.label}</button>
          ))}
        </div>
        <button type="button" onClick={run} className="rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-4 py-2 text-sm font-semibold text-ink hover:opacity-90">Compare</button>
      </div>

      {loading ? <p className="mt-6 text-sm text-slate-400">Pulling live data…</p> : null}

      {rows ? (
        <div className="mt-6">
          {/* Section switch */}
          <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
            <button type="button" onClick={() => setSection("overall")} className={`rounded-md px-3 py-1.5 text-xs ${section === "overall" ? "bg-gold/15 text-gold" : "text-slate-400 hover:text-white"}`}>Overall comparison</button>
            <button type="button" onClick={() => setSection("historical")} className={`rounded-md px-3 py-1.5 text-xs ${section === "historical" ? "bg-gold/15 text-gold" : "text-slate-400 hover:text-white"}`}>Historical comparison</button>
          </div>

          {section === "overall" ? (
            <div className="mt-4 space-y-4">
              {/* Metric bars — each ticker keeps its colour */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {metrics.map((m) => {
                  const maxAbs = Math.max(
                    m.max ?? 0,
                    1,
                    ...rows.map((r) => { const v = m.get(r); return typeof v === "number" ? Math.abs(v) : 0; })
                  );
                  return (
                    <div key={m.key} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-4">
                      <div className="text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">{m.label}</div>
                      <div className="mt-3 space-y-2">
                        {rows.map((r, i) => {
                          const v = m.get(r);
                          const w = typeof v === "number" ? Math.min(100, (Math.abs(v) / maxAbs) * 100) : 0;
                          return (
                            <div key={r.symbol} className="flex items-center gap-2">
                              <span className="w-12 flex-none font-mono text-[0.7rem] text-slate-300">{r.symbol}</span>
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

              {/* Detail table */}
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
                    return { symbol: r.symbol, color: CMP_COLORS[idx % CMP_COLORS.length], pts, final: pts[pts.length - 1].y };
                  })
                  .filter((n): n is { symbol: string; color: string; pts: { x: number; y: number }[]; final: number } => n != null);
                if (!normed.length) return <p className="text-sm text-slate-500">Price history isn&apos;t available for these symbols.</p>;
                let lo = 0, hi = 0;
                normed.forEach((n) => n.pts.forEach((p) => { lo = Math.min(lo, p.y); hi = Math.max(hi, p.y); }));
                const span = hi - lo || 1;
                const W = 820, H = 320, pad = 10;
                const X = (x: number) => pad + x * (W - 2 * pad);
                const Y = (y: number) => H - pad - ((y - lo) / span) * (H - 2 * pad);
                const dated = rows.find((r) => (r.series?.length ?? 0) > 1)?.series;
                return (
                  <>
                    <div className="flex flex-wrap gap-4 text-xs">
                      {normed.map((n) => (
                        <span key={n.symbol} className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: n.color }} />
                          <span className="font-mono text-slate-200">{n.symbol}</span>
                          <span className="font-mono font-semibold" style={{ color: n.color }}>{n.final >= 0 ? "+" : ""}{n.final.toFixed(1)}%</span>
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3">
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
      ) : null}
    </div>
  );
}

// ── CAGR ─────────────────────────────────────────────────────────────────────
function Cagr() {
  const [begin, setBegin] = useState("1000");
  const [end, setEnd] = useState("2500");
  const [years, setYears] = useState("5");

  const result = useMemo(() => {
    const b = parseFloat(begin), e = parseFloat(end), y = parseFloat(years);
    if (!(b > 0) || !(e > 0) || !(y > 0)) return null;
    const cagr = (Math.pow(e / b, 1 / y) - 1) * 100;
    const total = (e / b - 1) * 100;
    return { cagr, total };
  }, [begin, end, years]);

  const field = (label: string, val: string, set: (s: string) => void) => (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <input value={val} onChange={(e) => set(e.target.value)} inputMode="decimal"
        className="mt-1 w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-gold/40" />
    </label>
  );

  return (
    <div>
      <p className="text-sm text-slate-400">Compound annual growth rate — the smoothed yearly return that takes a starting value to an ending value.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {field("Beginning value", begin, setBegin)}
        {field("Ending value", end, setEnd)}
        {field("Number of years", years, setYears)}
      </div>
      {result ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <GlassCard className="px-5 py-4">
            <div className="text-xs text-slate-400">CAGR</div>
            <div className="mt-1 font-display text-2xl font-semibold text-gold">{result.cagr.toFixed(2)}%</div>
          </GlassCard>
          <GlassCard className="px-5 py-4">
            <div className="text-xs text-slate-400">Total return</div>
            <div className="mt-1 font-display text-2xl font-semibold text-white">{result.total.toFixed(2)}%</div>
          </GlassCard>
        </div>
      ) : (
        <p className="mt-5 text-sm text-slate-500">Enter positive numbers for all three fields.</p>
      )}
    </div>
  );
}

// ── Dividend ──────────────────────────────────────────────────────────────────
function Dividend() {
  const [amount, setAmount] = useState("10000");
  const [yieldPct, setYieldPct] = useState("3.5");
  const [years, setYears] = useState("10");
  const [growth, setGrowth] = useState("5");
  const [reinvest, setReinvest] = useState(true);

  const rows = useMemo(() => {
    const P = parseFloat(amount), y = parseFloat(yieldPct) / 100, g = parseFloat(growth) / 100, n = parseInt(years);
    if (!(P > 0) || !(y >= 0) || !(n > 0)) return null;
    const out: { year: number; income: number; value: number; cumulative: number }[] = [];
    let value = P, cumulative = 0;
    for (let i = 1; i <= n; i++) {
      const yieldThisYear = y * Math.pow(1 + (g || 0), i - 1);
      const income = value * yieldThisYear;
      cumulative += income;
      if (reinvest) value += income;
      out.push({ year: i, income, value, cumulative });
    }
    return out;
  }, [amount, yieldPct, years, growth, reinvest]);

  const field = (label: string, val: string, set: (s: string) => void) => (
    <label className="block">
      <span className="text-xs text-slate-400">{label}</span>
      <input value={val} onChange={(e) => set(e.target.value)} inputMode="decimal"
        className="mt-1 w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-gold/40" />
    </label>
  );

  const last = rows ? rows[rows.length - 1] : null;

  return (
    <div>
      <p className="text-sm text-slate-400">Estimate dividend income over time, with optional annual dividend growth and reinvestment. An estimate — it assumes a steady yield and flat share price.</p>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {field("Investment", amount, setAmount)}
        {field("Dividend yield %", yieldPct, setYieldPct)}
        {field("Dividend growth %/yr", growth, setGrowth)}
        {field("Years", years, setYears)}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
        <input type="checkbox" checked={reinvest} onChange={(e) => setReinvest(e.target.checked)} className="h-4 w-4 accent-gold" />
        Reinvest dividends
      </label>

      {rows && last ? (
        <>
          <div className="mt-5 flex flex-wrap gap-3">
            <GlassCard className="px-5 py-4">
              <div className="text-xs text-slate-400">Total dividends ({years}y)</div>
              <div className="mt-1 font-display text-2xl font-semibold text-gold">{fmtMoney(last.cumulative)}</div>
            </GlassCard>
            {reinvest ? (
              <GlassCard className="px-5 py-4">
                <div className="text-xs text-slate-400">Ending value</div>
                <div className="mt-1 font-display text-2xl font-semibold text-white">{fmtMoney(last.value)}</div>
              </GlassCard>
            ) : null}
            <GlassCard className="px-5 py-4">
              <div className="text-xs text-slate-400">Final-year income</div>
              <div className="mt-1 font-display text-2xl font-semibold text-teal">{fmtMoney(last.income)}</div>
            </GlassCard>
          </div>
          <div className="mt-5 max-h-64 overflow-y-auto rounded-lg border border-white/[0.06]">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-ink-900 text-left text-slate-400">
                <tr><th className="px-3 py-2 font-medium">Year</th><th className="px-3 py-2 font-medium">Income</th>{reinvest ? <th className="px-3 py-2 font-medium">Value</th> : null}<th className="px-3 py-2 font-medium">Cumulative</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.year} className="border-t border-white/[0.05]">
                    <td className="px-3 py-1.5 text-slate-400">{r.year}</td>
                    <td className="px-3 py-1.5 text-slate-200">{fmtMoney(r.income)}</td>
                    {reinvest ? <td className="px-3 py-1.5 text-slate-200">{fmtMoney(r.value)}</td> : null}
                    <td className="px-3 py-1.5 text-slate-200">{fmtMoney(r.cumulative)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <p className="mt-5 text-sm text-slate-500">Enter an investment amount, yield and number of years.</p>
      )}
    </div>
  );
}

// ── Symbol lookup ─────────────────────────────────────────────────────────────
function Lookup() {
  const [q, setQ] = useState("");
  const matches = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return [];
    return popularTickers
      .filter((p) => p.s.toLowerCase().includes(needle) || p.n.toLowerCase().includes(needle))
      .slice(0, 14);
  }, [q]);
  const upper = q.trim().toUpperCase();

  return (
    <div>
      <p className="text-sm text-slate-400">Search a ticker or company name, then open it for the full analysis.</p>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search e.g. Apple, NVDA, Reliance…"
        className="mt-4 w-full max-w-md rounded-lg border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-white outline-none focus:border-gold/40"
      />
      <div className="mt-4 flex flex-col gap-1.5">
        {matches.map((p) => (
          <Link key={p.s} href={`/stock-analysis?symbol=${p.s}`}
            className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 transition hover:border-gold/40">
            <span className="text-sm text-slate-200">{p.n}</span>
            <span className="font-mono text-sm text-slate-400">{p.s}</span>
          </Link>
        ))}
        {q.trim() && matches.length === 0 ? (
          <Link href={`/stock-analysis?symbol=${upper}`}
            className="rounded-lg border border-gold/30 bg-gold/[0.06] px-4 py-2.5 text-sm text-gold transition hover:bg-gold/10">
            Analyze “{upper}” →
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export default function ToolsSuite() {
  const [tab, setTab] = useState<Tab>("compare");

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading eyebrow="Tools" title="Quantifi tools" subtitle="Compare names, run the numbers, and look up any symbol." />

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              tab === t.key ? "border-gold/50 bg-gold/15 text-gold" : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <GlassCard className="mt-5 p-6 sm:p-8">
        {tab === "compare" ? <Compare /> : null}
        {tab === "cagr" ? <Cagr /> : null}
        {tab === "dividend" ? <Dividend /> : null}
        {tab === "lookup" ? <Lookup /> : null}
      </GlassCard>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Tag tone="teal">More</Tag>
        <Link href="/screener" className="text-sm text-slate-300 underline-offset-2 hover:text-white hover:underline">Stock Screener</Link>
        <span className="text-sm text-slate-600">·</span>
        <span className="text-sm text-slate-500">IPO calendar &amp; screener — coming next</span>
      </div>
    </section>
  );
}
