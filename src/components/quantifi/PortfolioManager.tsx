"use client";

import { useEffect, useMemo, useState } from "react";
import {
  GlassCard,
  SectionHeading,
  StatTile,
  TickerChip,
  ChangePill,
  BarMeter,
} from "@/components/quantifi/Cards";
import { stocks, fmtPrice, fmtPct } from "@/data/demo";
import {
  usePortfolios,
  resolvePrice,
  resolveName,
  type UserPortfolio,
} from "@/lib/usePortfolios";

function computeRows(p: UserPortfolio) {
  const rows = p.holdings.map((h) => {
    const value = h.shares * h.price;
    const cost = h.shares * h.avgCost;
    const pl = value - cost;
    const plPct = cost > 0 ? (pl / cost) * 100 : 0;
    return { ...h, name: resolveName(h.ticker) ?? h.ticker, value, cost, pl, plPct };
  });
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalPl = totalValue - totalCost;
  const totalPlPct = totalCost > 0 ? (totalPl / totalCost) * 100 : 0;
  return { rows, totalValue, totalCost, totalPl, totalPlPct };
}

export default function PortfolioManager() {
  const {
    portfolios,
    ready,
    createPortfolio,
    renamePortfolio,
    deletePortfolio,
    addHolding,
    removeHolding,
  } = usePortfolios();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);

  // add-holding form
  const [ticker, setTicker] = useState("");
  const [shares, setShares] = useState("");
  const [avgCost, setAvgCost] = useState("");
  const [price, setPrice] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Keep a valid selection.
  useEffect(() => {
    if (!ready) return;
    if (portfolios.length === 0) {
      setSelectedId(null);
      return;
    }
    if (!selectedId || !portfolios.some((p) => p.id === selectedId)) {
      setSelectedId(portfolios[0].id);
    }
  }, [ready, portfolios, selectedId]);

  const current = portfolios.find((p) => p.id === selectedId) ?? null;
  const summary = useMemo(() => (current ? computeRows(current) : null), [current]);

  // Auto-fill current price when a known ticker is typed.
  function onTickerChange(v: string) {
    setTicker(v);
    const known = resolvePrice(v);
    if (known > 0) setPrice(String(known));
  }

  function handleAdd() {
    setFormError(null);
    const t = ticker.trim().toUpperCase();
    const sh = Number(shares);
    const ac = Number(avgCost);
    const pr = price ? Number(price) : resolvePrice(t, ac);
    if (!t) return setFormError("Enter a ticker symbol.");
    if (!sh || sh <= 0) return setFormError("Enter a valid number of shares.");
    if (!ac || ac <= 0) return setFormError("Enter a valid average cost.");
    if (!current) return;
    addHolding(current.id, { ticker: t, shares: sh, avgCost: ac, price: pr || ac });
    setTicker("");
    setShares("");
    setAvgCost("");
    setPrice("");
  }

  function handleCreate() {
    const id = createPortfolio(newName);
    setNewName("");
    setCreating(false);
    setSelectedId(id);
  }

  if (!ready) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="h-40 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Portfolios"
        title="Build and track your own portfolios"
        subtitle="Create as many portfolios as you like and add holdings by hand. Saved in your browser — values are illustrative, not advice."
      />

      {/* Portfolio selector */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {portfolios.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => {
              setSelectedId(p.id);
              setRenaming(false);
            }}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              p.id === selectedId
                ? "border-gold/50 bg-gold/15 text-gold"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
            }`}
          >
            {p.name}
            <span className="ml-2 text-xs text-slate-500">{p.holdings.length}</span>
          </button>
        ))}

        {creating ? (
          <span className="inline-flex items-center gap-2">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              placeholder="Portfolio name"
              className="w-44 rounded-full border border-white/15 bg-ink-800 px-3 py-1.5 text-sm text-white outline-none focus:border-gold/40"
            />
            <button
              type="button"
              onClick={handleCreate}
              className="rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-3 py-1.5 text-sm font-semibold text-ink"
            >
              Add
            </button>
            <button
              type="button"
              onClick={() => setCreating(false)}
              className="text-sm text-slate-500 hover:text-white"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-full border border-dashed border-white/20 px-4 py-1.5 text-sm text-slate-400 transition hover:border-gold/40 hover:text-white"
          >
            + New portfolio
          </button>
        )}
      </div>

      {current ? (
        <>
          {/* Name + actions */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {renaming ? (
              <input
                autoFocus
                defaultValue={current.name}
                onBlur={(e) => {
                  renamePortfolio(current.id, e.target.value);
                  setRenaming(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    renamePortfolio(current.id, (e.target as HTMLInputElement).value);
                    setRenaming(false);
                  }
                }}
                className="rounded-lg border border-white/15 bg-ink-800 px-3 py-1.5 font-display text-lg text-white outline-none focus:border-gold/40"
              />
            ) : (
              <h3 className="font-display text-xl font-semibold text-white">{current.name}</h3>
            )}
            <div className="flex items-center gap-3 text-sm">
              <button
                type="button"
                onClick={() => setRenaming(true)}
                className="text-slate-400 transition hover:text-white"
              >
                Rename
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Delete "${current.name}"? This can't be undone.`)) {
                    deletePortfolio(current.id);
                  }
                }}
                className="text-down/80 transition hover:text-down"
              >
                Delete
              </button>
            </div>
          </div>

          {/* Summary tiles */}
          {summary ? (
            <div className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatTile label="Market value" value={`$${fmtPrice(summary.totalValue)}`} accent="gold" />
              <StatTile label="Total cost" value={`$${fmtPrice(summary.totalCost)}`} />
              <StatTile
                label="Total gain / loss"
                value={`${summary.totalPl >= 0 ? "+" : "-"}$${fmtPrice(Math.abs(summary.totalPl))}`}
                accent={summary.totalPl >= 0 ? "up" : "down"}
                sub={fmtPct(summary.totalPlPct)}
              />
              <StatTile label="Holdings" value={String(current.holdings.length)} />
            </div>
          ) : null}

          {/* Add holding */}
          <GlassCard className="mt-4 p-5">
            <h4 className="text-sm font-medium text-white">Add a holding</h4>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div className="lg:col-span-1">
                <label className="mb-1 block text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                  Ticker
                </label>
                <input
                  list="ticker-universe"
                  value={ticker}
                  onChange={(e) => onTickerChange(e.target.value)}
                  placeholder="e.g. AAPL"
                  className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
                />
                <datalist id="ticker-universe">
                  {stocks.map((s) => (
                    <option key={s.ticker} value={s.ticker}>
                      {s.name}
                    </option>
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                  Shares
                </label>
                <input
                  type="number"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                  Avg cost
                </label>
                <input
                  type="number"
                  value={avgCost}
                  onChange={(e) => setAvgCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                  Current price
                </label>
                <input
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="auto"
                  className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleAdd}
                  className="w-full rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90"
                >
                  Add holding
                </button>
              </div>
            </div>
            {formError ? (
              <p className="mt-3 text-sm text-down">{formError}</p>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                Known tickers auto-fill the current price; for anything else, enter a price yourself.
              </p>
            )}
          </GlassCard>

          {/* Holdings table */}
          <GlassCard className="mt-4 overflow-hidden">
            <div className="hidden grid-cols-[1.4fr_0.7fr_0.8fr_0.8fr_1fr_0.9fr_auto] gap-3 border-b border-white/[0.06] px-5 py-3 text-[0.62rem] uppercase tracking-[0.16em] text-slate-500 lg:grid">
              <span>Holding</span>
              <span className="text-right">Shares</span>
              <span className="text-right">Avg cost</span>
              <span className="text-right">Price</span>
              <span className="text-right">Value</span>
              <span className="text-right">Gain / loss</span>
              <span />
            </div>
            <ul className="divide-y divide-white/[0.05]">
              {summary?.rows.map((r) => (
                <li
                  key={r.id}
                  className="grid grid-cols-2 gap-3 px-5 py-4 lg:grid-cols-[1.4fr_0.7fr_0.8fr_0.8fr_1fr_0.9fr_auto] lg:items-center"
                >
                  <div className="flex items-center gap-2.5">
                    <TickerChip ticker={r.ticker} />
                    <span className="hidden text-sm text-slate-300 sm:inline">{r.name}</span>
                  </div>
                  <div className="text-right font-mono text-sm tnum text-slate-300">{r.shares}</div>
                  <div className="text-right font-mono text-sm tnum text-slate-300">${fmtPrice(r.avgCost)}</div>
                  <div className="text-right font-mono text-sm tnum text-slate-300">${fmtPrice(r.price)}</div>
                  <div className="text-right font-mono text-sm tnum text-white">${fmtPrice(r.value)}</div>
                  <div className="flex justify-end">
                    <ChangePill value={r.plPct} size="xs" />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeHolding(current.id, r.id)}
                      aria-label={`Remove ${r.ticker}`}
                      className="rounded-md px-2 py-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-down"
                    >
                      ✕
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {current.holdings.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-slate-500">
                No holdings yet. Add your first one above to start tracking this portfolio.
              </div>
            ) : null}
          </GlassCard>

          {/* Allocation */}
          {summary && summary.rows.length > 0 ? (
            <GlassCard className="mt-4 p-5 sm:p-6">
              <h4 className="font-display text-base font-semibold text-white">Allocation by holding</h4>
              <div className="mt-4 space-y-3">
                {summary.rows
                  .slice()
                  .sort((a, b) => b.value - a.value)
                  .map((r) => (
                    <BarMeter
                      key={r.id}
                      label={r.ticker}
                      value={summary.totalValue > 0 ? Math.round((r.value / summary.totalValue) * 100) : 0}
                      color="#E9B872"
                    />
                  ))}
              </div>
            </GlassCard>
          ) : null}
        </>
      ) : (
        <GlassCard className="mt-6 p-10 text-center">
          <p className="text-sm text-slate-400">
            You have no portfolios. Create one to get started.
          </p>
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="mt-4 inline-flex rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-5 py-2.5 text-sm font-semibold text-ink"
          >
            + New portfolio
          </button>
        </GlassCard>
      )}
    </section>
  );
}
