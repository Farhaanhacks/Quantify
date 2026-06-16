"use client";

import { useState } from "react";
import TradingViewWidget from "@/components/quantifi/TradingViewWidget";
import CompanySnapshot from "@/components/quantifi/CompanySnapshot";
import { GlassCard, TickerChip } from "@/components/quantifi/Cards";
import { tvSymbol } from "@/lib/tvSymbol";
import { stockByTicker, companyAnalytics } from "@/data/demo";
import { popularTickers } from "@/data/popularTickers";

const QUICK = ["NVDA", "AAPL", "MSFT", "TSLA", "AMZN", "GOOGL", "INFY.NS", "RELIANCE.NS"];

// Build a TradingView symbol from whatever the user typed.
function toTvSymbol(raw: string): string {
  const t = raw.trim().toUpperCase();
  if (!t) return "NASDAQ:NVDA";
  if (t.includes(":")) return t; // user supplied EXCHANGE:SYMBOL
  const known = stockByTicker[t];
  if (known) return tvSymbol(t, known.exchange);
  if (t.endsWith(".NS")) return `NSE:${t.replace(".NS", "")}`;
  return t; // let TradingView resolve the exchange
}

export default function StockExplorer({ initial = "NVDA" }: { initial?: string }) {
  const [input, setInput] = useState(initial);
  const [ticker, setTicker] = useState(initial.toUpperCase());

  const commit = () => {
    const t = input.trim().toUpperCase();
    if (t) setTicker(t);
  };

  const tvSym = toTvSymbol(ticker);
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
              placeholder="e.g. AAPL, TSLA, NSE:INFY, QQQ"
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
            Live chart and key stats work for virtually any symbol on global
            exchanges. You can also change the symbol directly inside the chart.
          </p>
        </GlassCard>

        {/* Live chart */}
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-2">
            <TickerChip ticker={ticker} active />
            <span className="text-xs text-slate-500">Live chart · TradingView</span>
          </div>
          <TradingViewWidget
            symbol={tvSym}
            kind="advanced-chart"
            height={660}
            range="12M"
            allowSymbolChange
          />
        </div>

        {/* Key stats */}
        <div className="mt-4">
          <TradingViewWidget symbol={tvSym} kind="symbol-info" height={250} />
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
              The live chart and key stats above work for any symbol. The Quantifi
              Score is computed from fundamentals, which in this prototype we hold
              for a demo set of names. Connect a fundamentals source (or the EDGAR
              ingestion layer for US filers) to score any stock.
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
