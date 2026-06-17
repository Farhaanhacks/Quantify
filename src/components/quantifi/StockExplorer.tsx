"use client";

import { useState } from "react";
import PriceChart from "@/components/quantifi/PriceChart";
import CompanySnapshot from "@/components/quantifi/CompanySnapshot";
import { GlassCard, TickerChip } from "@/components/quantifi/Cards";
import { companyAnalytics } from "@/data/demo";
import { popularTickers } from "@/data/popularTickers";

const QUICK = ["NVDA", "AAPL", "MSFT", "TSLA", "AMZN", "GOOGL", "INFY.NS", "RELIANCE.NS"];

export default function StockExplorer({ initial = "NVDA" }: { initial?: string }) {
  const [input, setInput] = useState(initial);
  const [ticker, setTicker] = useState(initial.toUpperCase());

  const commit = () => {
    const t = input.trim().toUpperCase();
    if (t) setTicker(t);
  };

  const hasScore = Boolean(companyAnalytics[ticker]);
  const scoredNames = Object.keys(companyAnalytics);

  return (
    <>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Search */}
        <GlassCard className="p-5">
          <label className="mb-2 block text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
            Search any stock or ETF
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              list="explorer-universe"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && commit()}
              placeholder="e.g. AAPL, TSLA, RELIANCE.NS, QQQ"
              className="min-w-[14rem] flex-1 rounded-lg border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-white outline-none focus:border-gold/40"
            />
            <datalist id="explorer-universe">
              {popularTickers.map((s) => (
                <option key={s.s} value={s.s}>
                  {s.n}
                </option>
              ))}
            </datalist>
            <button
              type="button"
              onClick={commit}
              className="rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-6 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
            >
              Load
            </button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs text-slate-500">Quick:</span>
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => {
                  setInput(q);
                  setTicker(q);
                }}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-xs text-slate-300 transition hover:border-gold/40 hover:text-white"
              >
                {q}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Real price history from Yahoo Finance. For Indian stocks add the
            exchange suffix (e.g. <span className="font-mono">RELIANCE.NS</span>).
          </p>
        </GlassCard>

        {/* Live chart (Lightweight Charts + Yahoo data) */}
        <div className="mt-4">
          <PriceChart symbol={ticker} height={460} />
        </div>
      </section>

      {/* Quantifi Score — only where we have fundamentals */}
      {hasScore ? (
        <CompanySnapshot ticker={ticker} />
      ) : (
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <GlassCard className="p-6">
            <h3 className="font-display text-base font-semibold text-white">
              Quantifi Score not available for {ticker} yet
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              The price chart above works for any symbol. The Quantifi Score is
              computed from fundamentals, which we currently hold for a demo set of
              names. Tap one to see the full score:
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {scoredNames.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setInput(t);
                    setTicker(t);
                  }}
                >
                  <TickerChip ticker={t} />
                </button>
              ))}
            </div>
          </GlassCard>
        </section>
      )}
    </>
  );
}
