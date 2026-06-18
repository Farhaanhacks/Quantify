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

interface ScoreRow {
  symbol: string;
  available?: boolean;
  price?: number;
  name?: string;
  analytics?: { scores?: Record<string, { score?: number }> };
}

function fmtMoney(n: number, cur = "USD") {
  const sym = cur === "INR" ? "₹" : cur === "USD" ? "$" : "";
  return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

// ── Comparison ───────────────────────────────────────────────────────────────
function Compare() {
  const [input, setInput] = useState("");
  const [symbols, setSymbols] = useState<string[]>(["AAPL", "MSFT"]);
  const [rows, setRows] = useState<ScoreRow[] | null>(null);
  const [loading, setLoading] = useState(false);

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
      symbols.map(async (s): Promise<ScoreRow> => {
        let sym = s;
        try {
          const rr = await fetch(`/api/resolve?q=${encodeURIComponent(s)}`);
          const rd = await rr.json();
          if (rd.symbol) sym = String(rd.symbol).toUpperCase();
        } catch {
          /* fall back to typed symbol */
        }
        try {
          const r = await fetch(`/api/score/${encodeURIComponent(sym)}`);
          const d = await r.json();
          return { symbol: sym, ...d };
        } catch {
          return { symbol: sym, available: false };
        }
      })
    );
    setRows(res);
    setLoading(false);
  };

  const overall = (row: ScoreRow) =>
    AXES.reduce((sum, a) => sum + (row.analytics?.scores?.[a.key]?.score ?? 0), 0);

  return (
    <div>
      <p className="text-sm text-slate-400">
        Add up to four symbols (stocks or ETFs) to compare price and the Quantifi Score side by side.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {symbols.map((s) => (
          <span key={s} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 font-mono text-sm text-slate-200">
            {s}
            <button type="button" onClick={() => setSymbols(symbols.filter((x) => x !== s))} className="text-slate-500 hover:text-white" aria-label={`Remove ${s}`}>
              ✕
            </button>
          </span>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="Add symbol e.g. NVDA"
          className="w-44 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm uppercase text-white outline-none focus:border-gold/40"
        />
        <button type="button" onClick={add} className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 hover:text-white">
          Add
        </button>
        <button type="button" onClick={run} className="rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-4 py-2 text-sm font-semibold text-ink hover:opacity-90">
          Compare
        </button>
      </div>

      {loading ? <p className="mt-6 text-sm text-slate-400">Pulling data…</p> : null}

      {rows ? (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-slate-400">
                <th className="py-2 pr-4 font-medium">Metric</th>
                {rows.map((r) => (
                  <th key={r.symbol} className="py-2 pr-4 font-mono text-white">{r.symbol}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-white/[0.06]">
                <td className="py-2 pr-4 text-slate-400">Name</td>
                {rows.map((r) => (
                  <td key={r.symbol} className="py-2 pr-4 text-slate-200">{r.name ?? "—"}</td>
                ))}
              </tr>
              <tr className="border-b border-white/[0.06]">
                <td className="py-2 pr-4 text-slate-400">Price</td>
                {rows.map((r) => (
                  <td key={r.symbol} className="py-2 pr-4 text-slate-200">{typeof r.price === "number" ? fmtMoney(r.price) : "—"}</td>
                ))}
              </tr>
              <tr className="border-b border-white/10">
                <td className="py-2 pr-4 font-medium text-gold">Quantifi Score</td>
                {rows.map((r) => (
                  <td key={r.symbol} className="py-2 pr-4 font-semibold text-gold">
                    {r.available && r.analytics ? `${overall(r)} / 30` : "—"}
                  </td>
                ))}
              </tr>
              {AXES.map((a) => (
                <tr key={a.key} className="border-b border-white/[0.06]">
                  <td className="py-2 pr-4 text-slate-400">{a.label}</td>
                  {rows.map((r) => {
                    const v = r.analytics?.scores?.[a.key]?.score;
                    return <td key={r.symbol} className="py-2 pr-4 text-slate-200">{typeof v === "number" ? `${v} / 6` : "—"}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {rows.some((r) => !r.available) ? (
            <p className="mt-3 text-xs text-slate-500">
              A "—" score usually means an ETF or index, which has no company fundamentals to score.
            </p>
          ) : null}
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
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
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
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
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
