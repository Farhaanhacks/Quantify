"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard, SectionHeading, Tag } from "@/components/quantifi/Cards";

type Tab = "xirr" | "dividend";

const TABS: { key: Tab; label: string }[] = [
  { key: "xirr", label: "XIRR Calculator" },
  { key: "dividend", label: "Dividend Calculator" },
];

function fmtMoney(n: number, cur = "USD") {
  const sym = cur === "INR" ? "₹" : cur === "USD" ? "$" : "";
  return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

// The Compare feature moved into the Stock Analysis page, where it now runs
// automatically against a company's competitors (see PeerComparison).
// ── XIRR ──────────────────────────────────────────────────────────────────────
// Money-weighted annualised return across irregular cash flows. Solve for the
// rate r where the net present value of all flows (invested = negative, returned
// = positive) is zero. Bisection is used when there's a sign change (robust);
// Newton as a fallback.
function xirrOf(flows: { amount: number; date: Date }[]): number | null {
  const valid = flows.filter((f) => isFinite(f.amount) && f.date instanceof Date && !isNaN(f.date.getTime()));
  if (valid.length < 2) return null;
  if (!valid.some((f) => f.amount > 0) || !valid.some((f) => f.amount < 0)) return null;
  const t0 = Math.min(...valid.map((f) => f.date.getTime()));
  const yrs = (t: number) => (t - t0) / (365 * 24 * 3600 * 1000);
  const npv = (r: number) => valid.reduce((s, f) => s + f.amount / Math.pow(1 + r, yrs(f.date.getTime())), 0);

  const lo = -0.9999;
  const hi = 100;
  const flo = npv(lo);
  const fhi = npv(hi);
  if (flo * fhi <= 0) {
    let a = lo;
    let b = hi;
    let fa = flo;
    for (let i = 0; i < 200; i++) {
      const mid = (a + b) / 2;
      const fmid = npv(mid);
      if (Math.abs(fmid) < 1e-8 || (b - a) / 2 < 1e-10) return mid;
      if (fa * fmid < 0) b = mid;
      else {
        a = mid;
        fa = fmid;
      }
    }
    return (a + b) / 2;
  }
  // Newton fallback.
  let r = 0.1;
  for (let i = 0; i < 100; i++) {
    const f = npv(r);
    const d = (npv(r + 1e-6) - f) / 1e-6;
    if (!isFinite(d) || Math.abs(d) < 1e-12) break;
    const rn = r - f / d;
    if (!isFinite(rn)) break;
    if (Math.abs(rn - r) < 1e-9) return rn > -0.9999 ? rn : null;
    r = rn;
  }
  return isFinite(r) && r > -0.9999 && Math.abs(npv(r)) < 1 ? r : null;
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const yearsAgoISO = (n: number) => new Date(Date.now() - n * 365 * 864e5).toISOString().slice(0, 10);

function Xirr() {
  const [rows, setRows] = useState<{ amount: string; date: string }[]>([
    { amount: "-10000", date: yearsAgoISO(2) },
    { amount: "-5000", date: yearsAgoISO(1) },
    { amount: "18000", date: todayISO() },
  ]);

  const result = useMemo(() => {
    const flows = rows.map((r) => ({ amount: parseFloat(r.amount), date: new Date(r.date) }));
    const rate = xirrOf(flows);
    if (rate == null) return null;
    const invested = flows.filter((f) => f.amount < 0).reduce((s, f) => s - f.amount, 0);
    const returned = flows.filter((f) => f.amount > 0).reduce((s, f) => s + f.amount, 0);
    return { rate: rate * 100, invested, returned, net: returned - invested };
  }, [rows]);

  const setRow = (i: number, patch: Partial<{ amount: string; date: string }>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div>
      <p className="text-sm text-slate-400">
        XIRR — the annualised return of your actual cash flows, whenever they happened. Enter each
        contribution as a <span className="text-down">negative</span> amount and each withdrawal /
        current value as a <span className="text-up">positive</span> amount, with its date.
      </p>

      <div className="mt-4 space-y-2">
        {rows.map((r, i) => (
          <div key={i} className="flex items-center gap-2">
            <input
              value={r.amount}
              onChange={(e) => setRow(i, { amount: e.target.value })}
              inputMode="decimal"
              placeholder="Amount (– invest / + return)"
              className="w-40 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
            />
            <input
              type="date"
              value={r.date}
              onChange={(e) => setRow(i, { date: e.target.value })}
              className="rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
            />
            {rows.length > 2 ? (
              <button
                type="button"
                onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                className="rounded-lg border border-white/10 px-2.5 py-2 text-xs text-slate-400 hover:text-white"
                aria-label="Remove row"
              >
                ✕
              </button>
            ) : null}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows((rs) => [...rs, { amount: "", date: todayISO() }])}
        className="mt-3 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 hover:text-white"
      >
        + Add cash flow
      </button>

      {result ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <GlassCard className="px-5 py-4">
            <div className="text-xs text-slate-400">XIRR (annualised)</div>
            <div className={`mt-1 font-display text-2xl font-semibold ${result.rate >= 0 ? "text-up" : "text-down"}`}>
              {result.rate >= 0 ? "+" : ""}
              {result.rate.toFixed(2)}%
            </div>
          </GlassCard>
          <GlassCard className="px-5 py-4">
            <div className="text-xs text-slate-400">Invested</div>
            <div className="mt-1 font-display text-2xl font-semibold text-white">{result.invested.toLocaleString()}</div>
          </GlassCard>
          <GlassCard className="px-5 py-4">
            <div className="text-xs text-slate-400">Net gain</div>
            <div className={`mt-1 font-display text-2xl font-semibold ${result.net >= 0 ? "text-up" : "text-down"}`}>
              {result.net >= 0 ? "+" : ""}
              {result.net.toLocaleString()}
            </div>
          </GlassCard>
        </div>
      ) : (
        <p className="mt-5 text-sm text-slate-500">
          Add at least one negative (invested) and one positive (returned) cash flow with valid dates.
        </p>
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

export default function ToolsSuite() {
  const [tab, setTab] = useState<Tab>("xirr");

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading eyebrow="Tools" title="Quantifi tools" subtitle="Run the numbers on your own cash flows and dividends. Head-to-head stock comparison now lives on each company's analysis page." />

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
        {tab === "xirr" ? <Xirr /> : null}
        {tab === "dividend" ? <Dividend /> : null}
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
