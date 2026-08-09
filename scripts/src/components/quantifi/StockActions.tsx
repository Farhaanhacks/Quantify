"use client";

import { useState } from "react";
import { useWatchlist } from "@/lib/useWatchlist";
import { usePortfolios } from "@/lib/usePortfolios";

// Two visible one-tap actions on the stock page: add to Watchlist (no inputs) and
// add to a Portfolio (asks only for shares + avg cost, prefilled with the live
// price). Mirrors the "+ Portfolio / ★" affordances users expect from research
// tools, wired to the same localStorage stores the Watchlist/Portfolio pages use.
export default function StockActions({ ticker, price }: { ticker: string; price?: number }) {
  const t = ticker.toUpperCase();
  const { data, ready, addStock, removeStock } = useWatchlist();
  const { portfolios, ready: pReady, createPortfolio, addHolding } = usePortfolios();

  const onWatch = ready && data.stocks.includes(t);
  const [showPf, setShowPf] = useState(false);
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState(price ? String(price) : "");
  const [added, setAdded] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const toggleWatch = () => {
    if (onWatch) removeStock(t);
    else addStock(t);
  };

  const confirmPortfolio = () => {
    setErr(null);
    const sh = Number(shares);
    const ac = Number(cost);
    if (!sh || sh <= 0) return setErr("Enter a valid number of shares.");
    if (!ac || ac <= 0) return setErr("Enter a valid average cost.");
    let pid = portfolios[0]?.id;
    if (!pid) pid = createPortfolio("My Portfolio");
    addHolding(pid, { ticker: t, shares: sh, avgCost: ac, price: price ?? ac });
    setAdded(true);
    setShowPf(false);
    setShares("");
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Watchlist toggle */}
      <button
        type="button"
        onClick={toggleWatch}
        disabled={!ready}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
          onWatch
            ? "border-gold/50 bg-gold/15 text-gold"
            : "border-white/15 bg-white/[0.04] text-slate-200 hover:border-gold/40 hover:text-white"
        }`}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill={onWatch ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2">
          <path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.7l6.9-.7Z" strokeLinejoin="round" />
        </svg>
        {onWatch ? "On watchlist" : "Watchlist"}
      </button>

      {/* Portfolio add */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setShowPf((v) => !v);
            setAdded(false);
          }}
          disabled={!pReady}
          className="inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-3 py-1.5 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M12 5v14M5 12h14" strokeLinecap="round" />
          </svg>
          Portfolio
        </button>

        {added ? (
          <span className="ml-2 text-xs text-up">Added to portfolio ✓</span>
        ) : null}

        {showPf ? (
          <div className="absolute left-0 top-full z-30 mt-2 w-64 rounded-lg border border-white/12 bg-ink-900/95 p-3 shadow-2xl backdrop-blur-xl">
            <p className="mb-2 text-xs text-slate-400">
              Add <span className="font-mono text-slate-200">{t}</span> to your portfolio
            </p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="mb-1 block text-[0.6rem] uppercase tracking-wide text-slate-500">Shares</label>
                <input
                  type="number"
                  autoFocus
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmPortfolio()}
                  placeholder="0"
                  className="w-full rounded-md border border-white/10 bg-ink-800 px-2 py-1.5 text-sm text-white outline-none focus:border-gold/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.6rem] uppercase tracking-wide text-slate-500">Avg cost</label>
                <input
                  type="number"
                  value={cost}
                  onChange={(e) => setCost(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && confirmPortfolio()}
                  placeholder="0.00"
                  className="w-full rounded-md border border-white/10 bg-ink-800 px-2 py-1.5 text-sm text-white outline-none focus:border-gold/40"
                />
              </div>
            </div>
            {err ? <p className="mt-2 text-xs text-down">{err}</p> : null}
            <div className="mt-3 flex items-center justify-end gap-2">
              <button type="button" onClick={() => setShowPf(false)} className="text-xs text-slate-400 hover:text-white">
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmPortfolio}
                className="rounded-md bg-gradient-to-r from-gold-400 to-gold-600 px-3 py-1 text-xs font-semibold text-ink"
              >
                Add holding
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
