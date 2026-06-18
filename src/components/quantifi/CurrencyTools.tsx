"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassCard, SectionHeading } from "@/components/quantifi/Cards";

const CURRENCIES = [
  "USD", "EUR", "GBP", "JPY", "INR", "AUD", "CAD",
  "CHF", "CNY", "SGD", "AED", "HKD", "ZAR", "BRL",
];

async function fetchRate(from: string, to: string): Promise<number | null> {
  if (from === to) return 1;
  try {
    const r = await fetch(`/api/fx?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`);
    const d = await r.json();
    return d.valid && typeof d.rate === "number" ? d.rate : null;
  } catch {
    return null;
  }
}

const selectCls =
  "rounded-lg border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-white outline-none focus:border-gold/40";

export default function CurrencyTools() {
  // ── Converter ───────────────────────────────────────────────
  const [amount, setAmount] = useState("100");
  const [from, setFrom] = useState("USD");
  const [to, setTo] = useState("INR");
  const [rate, setRate] = useState<number | null>(null);
  const [converting, setConverting] = useState(false);

  const convert = useCallback(async () => {
    setConverting(true);
    setRate(await fetchRate(from, to));
    setConverting(false);
  }, [from, to]);

  useEffect(() => {
    convert();
  }, [convert]);

  const amt = Number(amount) || 0;
  const converted = rate != null ? amt * rate : null;

  // ── Rates board ─────────────────────────────────────────────
  const [base, setBase] = useState("INR");
  const [list, setList] = useState<string[]>(["USD", "EUR", "GBP", "JPY"]);
  const [rates, setRates] = useState<Record<string, number | null>>({});
  const [addCur, setAddCur] = useState("AED");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const code of list) {
        const r = await fetchRate(code, base);
        if (!cancelled) setRates((prev) => ({ ...prev, [`${code}_${base}`]: r }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [list, base]);

  const addCurrency = () => {
    if (addCur && !list.includes(addCur)) setList((l) => [...l, addCur]);
  };
  const removeCurrency = (code: string) => setList((l) => l.filter((x) => x !== code));

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Currencies"
        title="Multi-currency tools"
        subtitle="Live FX rates from Yahoo. Convert between currencies and track several at once against a base — handy when your holdings span markets."
      />

      <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        {/* Converter */}
        <GlassCard className="p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold text-white">Converter</h3>
          <div className="mt-4 space-y-3">
            <div>
              <label className="mb-1 block text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                Amount
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className={`${selectCls} w-full`}
              />
            </div>
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                  From
                </label>
                <select value={from} onChange={(e) => setFrom(e.target.value)} className={`${selectCls} w-full`}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFrom(to);
                  setTo(from);
                }}
                aria-label="Swap currencies"
                className="mb-0.5 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 text-slate-300 transition hover:border-gold/40 hover:text-white"
              >
                ⇄
              </button>
              <div className="flex-1">
                <label className="mb-1 block text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                  To
                </label>
                <select value={to} onChange={(e) => setTo(e.target.value)} className={`${selectCls} w-full`}>
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
            {converting ? (
              <p className="text-sm text-slate-500">Fetching rate…</p>
            ) : converted != null && rate != null ? (
              <>
                <div className="font-display text-2xl font-semibold tnum text-white">
                  {converted.toLocaleString(undefined, { maximumFractionDigits: 2 })} {to}
                </div>
                <div className="mt-1 text-xs text-slate-500">
                  {amt.toLocaleString()} {from} · 1 {from} = {rate.toLocaleString(undefined, { maximumFractionDigits: 4 })} {to}
                </div>
              </>
            ) : (
              <p className="text-sm text-down">Couldn&apos;t fetch that rate right now.</p>
            )}
          </div>
        </GlassCard>

        {/* Rates board */}
        <GlassCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-lg font-semibold text-white">Rates board</h3>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span>Base</span>
              <select value={base} onChange={(e) => setBase(e.target.value)} className={`${selectCls} py-1.5`}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <ul className="mt-4 divide-y divide-white/[0.05]">
            {list.map((code) => {
              const r = rates[`${code}_${base}`];
              return (
                <li key={code} className="flex items-center justify-between py-3">
                  <span className="font-mono text-sm text-slate-200">
                    1 {code} = {" "}
                    {r == null ? (
                      <span className="text-slate-500">…</span>
                    ) : (
                      <span className="text-white">
                        {r.toLocaleString(undefined, { maximumFractionDigits: 4 })} {base}
                      </span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeCurrency(code)}
                    aria-label={`Remove ${code}`}
                    className="rounded-md px-2 py-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-down"
                  >
                    ✕
                  </button>
                </li>
              );
            })}
            {list.length === 0 ? (
              <li className="py-6 text-center text-sm text-slate-500">
                No currencies tracked. Add one below.
              </li>
            ) : null}
          </ul>

          <div className="mt-4 flex items-center gap-2">
            <select value={addCur} onChange={(e) => setAddCur(e.target.value)} className={`${selectCls} flex-1`}>
              {CURRENCIES.filter((c) => !list.includes(c)).map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={addCurrency}
              className="rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-5 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
            >
              Add
            </button>
          </div>
        </GlassCard>
      </div>

      <p className="mt-4 text-xs text-slate-500">
        Rates are live from Yahoo and refresh when you change the base or list. For
        reference only, not advice.
      </p>
    </section>
  );
}
