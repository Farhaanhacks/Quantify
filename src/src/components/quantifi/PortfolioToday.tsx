"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard, SectionHeading, TickerChip, ChangePill } from "@/components/quantifi/Cards";
import { usePortfolios, resolveName } from "@/lib/usePortfolios";

interface Q {
  price: number;
  prevClose: number;
  changePct: number;
  currency: string;
  name?: string;
}

interface Line {
  ticker: string;
  name: string;
  currency: string;
  value: number;
  dayChange: number;
  dayPct: number;
}

const curSym = (c: string) => (c === "INR" ? "₹" : c === "EUR" ? "€" : c === "GBP" ? "£" : "$");

function money(amt: number, cur: string): string {
  const sign = amt > 0 ? "+" : amt < 0 ? "−" : "";
  return `${sign}${curSym(cur)}${Math.abs(amt).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export default function PortfolioToday({ heading = true }: { heading?: boolean }) {
  const { portfolios, ready } = usePortfolios();
  const saved = ready ? portfolios[0]?.holdings ?? [] : [];
  const hasHoldings = saved.length > 0;
  const savedKey = saved.map((h) => h.ticker).join(",");

  const [quotes, setQuotes] = useState<Record<string, Q>>({});
  const [usdinr, setUsdinr] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!savedKey) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      await Promise.all(
        saved.map(async (h) => {
          try {
            const r = await fetch(`/api/quote/${encodeURIComponent(h.ticker)}`);
            const d = await r.json();
            if (!cancelled && d.valid && typeof d.price === "number") {
              setQuotes((q) => ({
                ...q,
                [h.ticker]: {
                  price: d.price,
                  prevClose: typeof d.prevClose === "number" ? d.prevClose : d.price,
                  changePct: typeof d.changePct === "number" ? d.changePct : 0,
                  currency: d.currency || "USD",
                  name: d.name,
                },
              }));
            }
          } catch {
            /* ignore */
          }
        })
      );
      try {
        const r = await fetch(`/api/quote/${encodeURIComponent("USDINR=X")}`);
        const d = await r.json();
        if (!cancelled && d.valid && typeof d.price === "number") setUsdinr(d.price);
      } catch {
        /* FX optional */
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const lines: Line[] = useMemo(
    () =>
      saved.map((h) => {
        const q = quotes[h.ticker];
        const price = q?.price ?? h.price;
        const prev = q?.prevClose ?? price;
        const currency = q?.currency ?? (/\.(NS|BO)$/i.test(h.ticker) ? "INR" : "USD");
        return {
          ticker: h.ticker,
          name: q?.name ?? resolveName(h.ticker) ?? h.ticker,
          currency,
          value: h.shares * price,
          dayChange: h.shares * (price - prev),
          dayPct: q?.changePct ?? 0,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [savedKey, quotes]
  );

  const toUsd = (amt: number, cur: string) => (cur === "INR" ? (usdinr ? amt / usdinr : amt) : amt);
  const totalValueUsd = lines.reduce((s, l) => s + toUsd(l.value, l.currency), 0);
  const totalDayUsd = lines.reduce((s, l) => s + toUsd(l.dayChange, l.currency), 0);
  const yesterdayUsd = totalValueUsd - totalDayUsd;
  const portfolioPct = yesterdayUsd ? (totalDayUsd / yesterdayUsd) * 100 : 0;

  const byCurrency = useMemo(() => {
    const m: Record<string, { value: number; dayChange: number }> = {};
    for (const l of lines) {
      const b = m[l.currency] ?? { value: 0, dayChange: 0 };
      b.value += l.value;
      b.dayChange += l.dayChange;
      m[l.currency] = b;
    }
    return m;
  }, [lines]);

  const movers = useMemo(() => [...lines].sort((a, b) => b.dayPct - a.dayPct), [lines]);

  const up = portfolioPct >= 0;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Daily Snapshot"
          title="How your portfolio did today"
          subtitle="Today's move across your holdings, from live prices vs the previous close. Educational only — not advice."
          href="/portfolio"
          cta="Open command center"
        />
      ) : null}

      {!ready || loading ? (
        <GlassCard className="mt-6 p-8 text-center text-sm text-slate-500">Loading today&apos;s move…</GlassCard>
      ) : !hasHoldings ? (
        <GlassCard className="mt-6 p-10 text-center">
          <p className="text-sm text-slate-300">No holdings yet — add some to see your daily move.</p>
          <Link
            href="/portfolio"
            className="mt-5 inline-flex rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-5 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Build your portfolio →
          </Link>
        </GlassCard>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          {/* Headline */}
          <GlassCard className="flex flex-col justify-center p-6">
            <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Today&apos;s change</div>
            <div className={`mt-2 font-mono text-4xl font-semibold tnum ${up ? "text-up" : "text-down"}`}>
              {up ? "▲" : "▼"} {Math.abs(portfolioPct).toFixed(2)}%
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {Object.entries(byCurrency).map(([cur, b]) => (
                <span
                  key={cur}
                  className={`rounded-full border px-2.5 py-1 font-mono text-xs tnum ${
                    b.dayChange >= 0 ? "border-up/30 bg-up/10 text-up" : "border-down/30 bg-down/10 text-down"
                  }`}
                >
                  {money(b.dayChange, cur)}
                </span>
              ))}
            </div>
            <p className="mt-3 text-[0.7rem] leading-relaxed text-slate-600">
              Weighted across {lines.length} holding{lines.length === 1 ? "" : "s"}
              {usdinr ? " · mixed currencies normalized via live USD/INR" : ""}.
            </p>
          </GlassCard>

          {/* Per-holding today moves */}
          <GlassCard className="overflow-hidden">
            <div className="hidden grid-cols-[1.4fr_0.8fr_1fr] gap-3 border-b border-white/[0.06] px-5 py-3 text-[0.62rem] uppercase tracking-[0.16em] text-slate-500 sm:grid">
              <span>Holding</span>
              <span className="text-right">Today</span>
              <span className="text-right">Day P/L</span>
            </div>
            <ul className="divide-y divide-white/[0.05]">
              {movers.map((l) => (
                <li
                  key={l.ticker}
                  className="grid grid-cols-2 items-center gap-3 px-5 py-3.5 sm:grid-cols-[1.4fr_0.8fr_1fr]"
                >
                  <div className="flex items-center gap-2.5">
                    <TickerChip ticker={l.ticker} />
                    <span className="hidden truncate text-sm text-slate-300 sm:inline">{l.name}</span>
                  </div>
                  <div className="flex justify-end">
                    <ChangePill value={l.dayPct} size="xs" />
                  </div>
                  <div
                    className={`text-right font-mono text-sm tnum ${
                      l.dayChange >= 0 ? "text-up" : "text-down"
                    }`}
                  >
                    {money(l.dayChange, l.currency)}
                  </div>
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      )}
    </section>
  );
}
