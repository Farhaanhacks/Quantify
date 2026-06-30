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
import { fmtPrice, fmtPct } from "@/data/demo";
import { popularTickers } from "@/data/popularTickers";
import {
  usePortfolios,
  resolveName,
  type UserPortfolio,
} from "@/lib/usePortfolios";

interface Quote {
  price: number;
  name?: string;
  currency?: string;
}

const cur = (c?: string) => (c === "INR" ? "₹" : "$");

function computeRows(p: UserPortfolio, quotes: Record<string, Quote>) {
  const rows = p.holdings.map((h) => {
    const q = quotes[h.ticker];
    const px = q?.price ?? h.price;
    const value = h.shares * px;
    const cost = h.shares * h.avgCost;
    const pl = value - cost;
    const plPct = cost > 0 ? (pl / cost) * 100 : 0;
    const currency = q?.currency ?? (h.ticker.endsWith(".NS") ? "INR" : "USD");
    return {
      ...h,
      price: px,
      name: q?.name ?? resolveName(h.ticker) ?? h.ticker,
      value,
      cost,
      pl,
      plPct,
      currency,
    };
  });
  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const totalPl = totalValue - totalCost;
  const totalPlPct = totalCost > 0 ? (totalPl / totalCost) * 100 : 0;
  const mixedCurrency = new Set(rows.map((r) => r.currency)).size > 1;
  return { rows, totalValue, totalCost, totalPl, totalPlPct, mixedCurrency };
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
  const [formError, setFormError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  // live quotes by ticker
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});

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
  const holdingsKey = current ? current.holdings.map((h) => h.ticker).join(",") : "";

  // Refresh live prices for everything held in the current portfolio.
  useEffect(() => {
    if (!current) return;
    const tickers = Array.from(new Set(current.holdings.map((h) => h.ticker)));
    let cancelled = false;
    (async () => {
      for (const t of tickers) {
        try {
          const r = await fetch(`/api/quote/${encodeURIComponent(t)}`);
          const d = await r.json();
          if (!cancelled && d.valid && typeof d.price === "number") {
            setQuotes((prev) => ({
              ...prev,
              [t]: { price: d.price, name: d.name, currency: d.currency },
            }));
          }
        } catch {
          /* ignore — keep stored price */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, holdingsKey]);

  const summary = useMemo(
    () => (current ? computeRows(current, quotes) : null),
    [current, quotes]
  );

  async function handleAdd() {
    setFormError(null);
    const t = ticker.trim().toUpperCase();
    const sh = Number(shares);
    const ac = Number(avgCost);
    if (!t) return setFormError("Enter a ticker symbol.");
    if (!sh || sh <= 0) return setFormError("Enter a valid number of shares.");
    if (!ac || ac <= 0) return setFormError("Enter a valid average cost.");
    if (!current) return;

    setAdding(true);
    try {
      const r = await fetch(`/api/quote/${encodeURIComponent(t)}`);
      const d = await r.json();
      if (!d.valid || typeof d.price !== "number") {
        setFormError(
          `Couldn't find "${t}". Check the symbol — Indian stocks need a .NS suffix (e.g. RELIANCE.NS).`
        );
        return;
      }
      addHolding(current.id, { ticker: t, shares: sh, avgCost: ac, price: d.price });
      setQuotes((prev) => ({
        ...prev,
        [t]: { price: d.price, name: d.name, currency: d.currency },
      }));
      setTicker("");
      setShares("");
      setAvgCost("");
    } catch {
      setFormError("Couldn't verify that ticker right now — please try again.");
    } finally {
      setAdding(false);
    }
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
        subtitle="Create portfolios and add real holdings — tickers are verified and priced from live data. Saved in your browser; illustrative, not advice."
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
              <button type="button" onClick={() => setRenaming(true)} className="text-slate-400 transition hover:text-white">
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
          {summary?.mixedCurrency ? (
            <p className="mt-2 text-xs text-slate-500">
              Note: this portfolio mixes currencies — per-row values are in each
              stock&apos;s native currency, but the totals above are a naive sum (no
              FX conversion yet).
            </p>
          ) : null}

          {/* Add holding */}
          <GlassCard className="mt-4 p-5">
            <h4 className="text-sm font-medium text-white">Add a holding</h4>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1 block text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">Ticker</label>
                <input
                  list="ticker-universe"
                  value={ticker}
                  onChange={(e) => setTicker(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                  placeholder="e.g. AAPL or RELIANCE.NS"
                  className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
                />
                <datalist id="ticker-universe">
                  {popularTickers.map((s) => (
                    <option key={s.s} value={s.s}>
                      {s.n}
                    </option>
                  ))}
                </datalist>
              </div>
              <div>
                <label className="mb-1 block text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">Shares</label>
                <input
                  type="number"
                  value={shares}
                  onChange={(e) => setShares(e.target.value)}
                  placeholder="0"
                  className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
                />
              </div>
              <div>
                <label className="mb-1 block text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">Avg cost</label>
                <input
                  type="number"
                  value={avgCost}
                  onChange={(e) => setAvgCost(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={adding}
                  className="w-full rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-50"
                >
                  {adding ? "Checking…" : "Add holding"}
                </button>
              </div>
            </div>
            {formError ? (
              <p className="mt-3 text-sm text-down">{formError}</p>
            ) : (
              <p className="mt-3 text-xs text-slate-500">
                The ticker is verified against live data before it&apos;s added, and
                the current price is fetched automatically — so only real symbols get
                tracked.
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
                  <div className="text-right font-mono text-sm tnum text-slate-300">{cur(r.currency)}{fmtPrice(r.avgCost)}</div>
                  <div className="text-right font-mono text-sm tnum text-slate-300">{cur(r.currency)}{fmtPrice(r.price)}</div>
                  <div className="text-right font-mono text-sm tnum text-white">{cur(r.currency)}{fmtPrice(r.value)}</div>
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
          <p className="text-sm text-slate-400">You have no portfolios. Create one to get started.</p>
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
