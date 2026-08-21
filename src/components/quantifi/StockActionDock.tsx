"use client";

import { useEffect, useState } from "react";
import { usePortfolios } from "@/lib/usePortfolios";
import { useWatchlist } from "@/lib/useWatchlist";

type IconName = "portfolio" | "watchlist" | "notes" | "ai";

function ActionIcon({ name, active = false }: { name: IconName; active?: boolean }) {
  if (name === "watchlist") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8">
        <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" strokeLinejoin="round" />
      </svg>
    );
  }
  if (name === "notes") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="M5 19h4l10-10a2.1 2.1 0 0 0-3-3L6 16l-1 3Z" strokeLinejoin="round" />
        <path d="m14.5 7.5 3 3M5 22h14" strokeLinecap="round" />
      </svg>
    );
  }
  if (name === "ai") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
        <path d="m11.5 3 1.5 4.5 4.5 1.5-4.5 1.5-1.5 4.5-1.5-4.5L5.5 9 10 7.5 11.5 3Z" strokeLinejoin="round" />
        <path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.9">
      <path d="M12 5v14M5 12h14" strokeLinecap="round" />
    </svg>
  );
}

function ActionRow({
  label,
  icon,
  onClick,
  active,
  disabled,
  accent,
}: {
  label: string;
  icon: IconName;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`group flex items-center justify-end gap-4 text-right transition disabled:cursor-not-allowed disabled:opacity-40 ${
        accent ? "text-gold" : active ? "text-gold" : "text-white"
      }`}
    >
      <span className="text-sm font-semibold drop-shadow-sm sm:text-base">{label}</span>
      <span
        className={`flex h-12 w-12 flex-none items-center justify-center rounded-full border bg-ink-800 shadow-xl transition sm:h-14 sm:w-14 ${
          accent || active
            ? "border-gold/60 text-gold group-hover:bg-gold/10"
            : "border-white/10 text-slate-200 group-hover:border-gold/35 group-hover:text-gold"
        }`}
      >
        <ActionIcon name={icon} active={active} />
      </span>
    </button>
  );
}

export default function StockActionDock({
  ticker,
  name,
  price,
  hidden = false,
  onOpenAi,
}: {
  ticker: string;
  name?: string;
  price?: number;
  hidden?: boolean;
  onOpenAi: () => void;
}) {
  const symbol = ticker.trim().toUpperCase();
  const { data, ready: watchReady, addStock, removeStock } = useWatchlist();
  const { portfolios, ready: portfolioReady, createPortfolio, addHolding } = usePortfolios();
  const onWatchlist = data.stocks.includes(symbol);

  const [open, setOpen] = useState(false);
  const [portfolioOpen, setPortfolioOpen] = useState(false);
  const [portfolioId, setPortfolioId] = useState("");
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState(price ? String(price) : "");
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string>();

  useEffect(() => {
    setOpen(false);
    setPortfolioOpen(false);
    setPortfolioId("");
    setShares("");
    setCost(price ? String(price) : "");
    setError(undefined);
    setStatus(undefined);
  }, [symbol, price]);

  useEffect(() => {
    if (!open && !portfolioOpen) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setPortfolioOpen(false);
      }
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [open, portfolioOpen]);

  const notify = (message: string) => {
    setStatus(message);
    window.setTimeout(() => setStatus(undefined), 2400);
  };

  const toggleWatchlist = () => {
    if (onWatchlist) {
      removeStock(symbol);
      notify(`${symbol} removed from watchlist`);
    } else {
      addStock(symbol);
      notify(`${symbol} added to watchlist`);
    }
    setOpen(false);
  };

  const openPortfolio = () => {
    setPortfolioId(portfolios[0]?.id ?? "");
    setCost(price ? String(price) : "");
    setError(undefined);
    setOpen(false);
    setPortfolioOpen(true);
  };

  const confirmPortfolio = () => {
    setError(undefined);
    const shareCount = Number(shares);
    const averageCost = Number(cost);
    if (!Number.isFinite(shareCount) || shareCount <= 0) {
      setError("Enter a valid number of shares.");
      return;
    }
    if (!Number.isFinite(averageCost) || averageCost <= 0) {
      setError("Enter a valid average cost.");
      return;
    }

    const selected = portfolios.find((portfolio) => portfolio.id === portfolioId);
    const targetId = selected?.id ?? createPortfolio("My Portfolio");
    addHolding(targetId, {
      ticker: symbol,
      shares: shareCount,
      avgCost: averageCost,
      price: price ?? averageCost,
    });
    setPortfolioOpen(false);
    setShares("");
    notify(`${symbol} added to ${selected?.name ?? "My Portfolio"}`);
  };

  const openNotes = () => {
    setOpen(false);
    const section = document.getElementById("sec-notes");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => section?.querySelector<HTMLTextAreaElement>("textarea")?.focus(), 500);
  };

  if (hidden) return null;

  return (
    <>
      {status ? (
        <div className="fixed bottom-24 right-5 z-[70] rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-xs text-slate-200 shadow-2xl" role="status">
          {status}
        </div>
      ) : null}

      {!open && !portfolioOpen ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full border border-gold/55 bg-ink-800 text-slate-100 shadow-2xl shadow-black/40 transition hover:-translate-y-0.5 hover:bg-ink-700 hover:text-gold"
          aria-label={`Open actions for ${name ?? symbol}`}
          aria-expanded="false"
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="1.7">
            <path d="M12 7v10M7 12h10" strokeLinecap="round" />
          </svg>
          <span className="absolute -right-1 -top-1 text-gold" aria-hidden>
            <svg viewBox="0 0 18 18" className="h-5 w-5" fill="currentColor">
              <path d="M9 0c.5 4.5 4.5 8.5 9 9-4.5.5-8.5 4.5-9 9C8.5 13.5 4.5 9.5 0 9 4.5 8.5 8.5 4.5 9 0Z" />
            </svg>
          </span>
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Actions for ${name ?? symbol}`}>
          <button type="button" className="absolute inset-0 bg-black/65 backdrop-blur-[1px]" onClick={() => setOpen(false)} aria-label="Close stock actions" />
          <div className="absolute bottom-5 right-5 flex flex-col items-end gap-3">
            <ActionRow label="Add to portfolio" icon="portfolio" onClick={openPortfolio} disabled={!portfolioReady} />
            <ActionRow
              label={onWatchlist ? "Remove from watchlist" : "Add to watchlist"}
              icon="watchlist"
              onClick={toggleWatchlist}
              disabled={!watchReady}
              active={onWatchlist}
            />
            <ActionRow label="Open notes" icon="notes" onClick={openNotes} />
            <ActionRow
              label="Ask Quantifi AI"
              icon="ai"
              accent
              onClick={() => {
                setOpen(false);
                onOpenAi();
              }}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-1 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-ink-800 text-slate-300 shadow-xl transition hover:border-gold/35 hover:text-white sm:h-14 sm:w-14"
              aria-label="Close stock actions"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
                <path d="m7 7 10 10M17 7 7 17" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}

      {portfolioOpen ? (
        <div className="fixed inset-0 z-[60] flex items-end justify-center p-4 sm:items-center" role="dialog" aria-modal="true" aria-label={`Add ${symbol} to portfolio`}>
          <button type="button" className="absolute inset-0 bg-black/65 backdrop-blur-[1px]" onClick={() => setPortfolioOpen(false)} aria-label="Close portfolio form" />
          <form
            className="relative w-full max-w-md rounded-2xl border border-white/10 bg-ink-900 p-5 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              confirmPortfolio();
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-gold">Portfolio</p>
                <h2 className="mt-1 font-display text-lg font-semibold text-white">Add {symbol}</h2>
              </div>
              <button type="button" onClick={() => setPortfolioOpen(false)} className="rounded-full p-2 text-slate-500 hover:bg-white/[0.05] hover:text-white" aria-label="Close">
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            {portfolios.length ? (
              <label className="mt-4 block text-xs text-slate-400">
                Portfolio
                <select
                  value={portfolioId || portfolios[0].id}
                  onChange={(event) => setPortfolioId(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
                >
                  {portfolios.map((portfolio) => (
                    <option key={portfolio.id} value={portfolio.id}>{portfolio.name}</option>
                  ))}
                </select>
              </label>
            ) : (
              <p className="mt-4 rounded-lg border border-gold/15 bg-gold/[0.05] px-3 py-2 text-xs text-slate-400">
                Your first portfolio will be created automatically.
              </p>
            )}

            <div className="mt-4 grid grid-cols-2 gap-3">
              <label className="text-xs text-slate-400">
                Shares
                <input
                  type="number"
                  min="0"
                  step="any"
                  autoFocus
                  value={shares}
                  onChange={(event) => setShares(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
                  placeholder="0"
                />
              </label>
              <label className="text-xs text-slate-400">
                Average cost
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={cost}
                  onChange={(event) => setCost(event.target.value)}
                  className="mt-1.5 w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
                  placeholder="0.00"
                />
              </label>
            </div>
            {error ? <p className="mt-3 text-xs text-down">{error}</p> : null}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setPortfolioOpen(false)} className="rounded-lg px-3 py-2 text-sm text-slate-400 hover:text-white">Cancel</button>
              <button type="submit" className="rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-4 py-2 text-sm font-semibold text-ink hover:brightness-110">Add holding</button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
