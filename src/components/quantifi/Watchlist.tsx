"use client";

import { useEffect, useState } from "react";
import {
  GlassCard,
  SectionHeading,
  ChangePill,
  TickerChip,
  Tag,
} from "@/components/quantifi/Cards";
import { fmtPrice } from "@/data/demo";
import { useWatchlist, type AlertKind } from "@/lib/useWatchlist";

type Quote = { price: number; changePct: number; currency: string; name: string };

const ALERT_KINDS: AlertKind[] = ["News", "Event", "Insider", "Price"];

function alertTone(kind: AlertKind): "gold" | "teal" | "down" | "neutral" {
  if (kind === "Insider") return "down";
  if (kind === "News") return "gold";
  if (kind === "Event") return "teal";
  if (kind === "Price") return "teal";
  return "neutral";
}

function ccy(currency: string, ticker: string): string {
  if (currency === "INR" || /\.(NS|BO)$/i.test(ticker)) return "₹";
  if (currency === "GBP") return "£";
  if (currency === "EUR") return "€";
  return "$";
}

export default function Watchlist({ heading = true }: { heading?: boolean }) {
  const {
    data,
    ready,
    scope,
    addStock,
    removeStock,
    addTheme,
    removeTheme,
    addAlert,
    toggleAlert,
    removeAlert,
  } = useWatchlist();

  const [quotes, setQuotes] = useState<Record<string, Quote>>({});

  // Live prices for every saved stock.
  useEffect(() => {
    let cancelled = false;
    if (!data.stocks.length) {
      setQuotes({});
      return;
    }
    (async () => {
      const entries = await Promise.all(
        data.stocks.map(async (t) => {
          try {
            const r = await fetch(`/api/quote/${encodeURIComponent(t)}`);
            const d = await r.json();
            if (d?.valid) {
              return [
                t,
                {
                  price: d.price,
                  changePct: d.changePct ?? 0,
                  currency: d.currency ?? "USD",
                  name: d.name ?? t,
                } as Quote,
              ] as const;
            }
          } catch {
            /* ignore */
          }
          return null;
        })
      );
      if (cancelled) return;
      const map: Record<string, Quote> = {};
      for (const e of entries) if (e) map[e[0]] = e[1];
      setQuotes(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [data.stocks]);

  // --- add-stock form ---
  const [stockInput, setStockInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [stockErr, setStockErr] = useState<string | null>(null);

  const handleAddStock = async () => {
    const t = stockInput.trim().toUpperCase();
    if (!t) return;
    setStockErr(null);
    if (data.stocks.includes(t)) {
      setStockErr("Already on your watchlist.");
      return;
    }
    setChecking(true);
    try {
      const r = await fetch(`/api/quote/${encodeURIComponent(t)}`);
      const d = await r.json();
      if (d?.valid) {
        addStock(t);
        setStockInput("");
      } else {
        setStockErr(`Couldn't find "${t}". Try a symbol like NVDA or INFY.NS`);
      }
    } catch {
      setStockErr("Couldn't check that ticker right now.");
    } finally {
      setChecking(false);
    }
  };

  // --- add-theme form ---
  const [themeInput, setThemeInput] = useState("");
  const handleAddTheme = () => {
    if (!themeInput.trim()) return;
    addTheme(themeInput);
    setThemeInput("");
  };

  // --- add-alert form ---
  const [alertTicker, setAlertTicker] = useState("");
  const [alertText, setAlertText] = useState("");
  const [alertKind, setAlertKind] = useState<AlertKind>("News");
  const handleAddAlert = () => {
    const tk = alertTicker.trim().toUpperCase();
    const tx = alertText.trim();
    if (!tk || !tx) return;
    addAlert({ ticker: tk, text: tx, kind: alertKind });
    setAlertTicker("");
    setAlertText("");
    setAlertKind("News");
  };

  const inputCls =
    "rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-slate-500 outline-none focus:border-gold/40";
  const btnCls =
    "rounded-lg border border-gold/40 bg-gold/15 px-3 py-2 text-sm font-medium text-gold transition hover:bg-gold/25 disabled:opacity-40";

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Watchlist"
          title="Everything you're tracking"
          subtitle="Add the stocks, themes and alerts you care about. Everything here is yours — edit it any time."
        />
      ) : null}

      {/* scope indicator */}
      {ready ? (
        <p className="mt-3 text-xs text-slate-500">
          {scope === "account"
            ? "✓ Synced to your account — this list follows you on any device you sign in to."
            : "Saved on this device. Sign in (top-right) to sync across devices."}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Saved stocks */}
        <GlassCard className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-white">Saved stocks</h3>
            <span className="text-xs text-slate-500">{data.stocks.length} tracked</span>
          </div>

          {/* add row */}
          <div className="mt-4 flex gap-2">
            <input
              value={stockInput}
              onChange={(e) => setStockInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddStock()}
              placeholder="Add a ticker — e.g. NVDA, INFY.NS"
              className={`${inputCls} flex-1`}
            />
            <button onClick={handleAddStock} disabled={checking} className={btnCls}>
              {checking ? "Checking…" : "Add"}
            </button>
          </div>
          {stockErr ? <p className="mt-2 text-xs text-down">{stockErr}</p> : null}

          {data.stocks.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">
              Nothing here yet. Add a ticker above to start tracking it with live prices.
            </p>
          ) : (
            <ul className="mt-4 divide-y divide-white/[0.05]">
              {data.stocks.map((ticker) => {
                const q = quotes[ticker];
                return (
                  <li key={ticker} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <TickerChip ticker={ticker} />
                      <span className="hidden text-sm text-slate-300 sm:inline">
                        {q?.name ?? "—"}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      {q ? (
                        <>
                          <span className="font-mono text-sm tnum text-white">
                            {ccy(q.currency, ticker)}
                            {fmtPrice(q.price)}
                          </span>
                          <ChangePill value={q.changePct} size="xs" />
                        </>
                      ) : (
                        <span className="text-xs text-slate-500">loading…</span>
                      )}
                      <button
                        onClick={() => removeStock(ticker)}
                        aria-label={`Remove ${ticker}`}
                        className="ml-1 flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-slate-500 transition hover:border-down/40 hover:text-down"
                      >
                        ×
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </GlassCard>

        {/* Saved themes */}
        <GlassCard className="p-5 sm:p-6">
          <h3 className="font-display text-lg font-semibold text-white">Saved themes</h3>
          <p className="mt-1 text-xs text-slate-500">
            Narratives you&apos;re following — type one and hit Add.
          </p>
          <div className="mt-4 flex gap-2">
            <input
              value={themeInput}
              onChange={(e) => setThemeInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddTheme()}
              placeholder="e.g. AI Infrastructure"
              className={`${inputCls} flex-1`}
            />
            <button onClick={handleAddTheme} className={btnCls}>
              Add
            </button>
          </div>
          {data.themes.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No themes saved yet.</p>
          ) : (
            <div className="mt-4 flex flex-wrap gap-2">
              {data.themes.map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Tag tone="teal">{t}</Tag>
                  <button
                    onClick={() => removeTheme(t)}
                    aria-label={`Remove ${t}`}
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-white/10 text-xs text-slate-500 transition hover:border-down/40 hover:text-down"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* Alerts */}
      <GlassCard className="mt-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-white">Alerts</h3>
          <span className="text-xs text-slate-500">
            {data.alerts.filter((a) => a.on).length} active
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Research reminders you&apos;ve set. Saved to your account — toggle on/off or remove any time.
        </p>

        {/* add alert */}
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <input
            value={alertTicker}
            onChange={(e) => setAlertTicker(e.target.value)}
            placeholder="Ticker"
            className={`${inputCls} sm:w-28`}
          />
          <input
            value={alertText}
            onChange={(e) => setAlertText(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAddAlert()}
            placeholder="What should this alert remind you to watch?"
            className={`${inputCls} flex-1`}
          />
          <select
            value={alertKind}
            onChange={(e) => setAlertKind(e.target.value as AlertKind)}
            className={`${inputCls} sm:w-32`}
          >
            {ALERT_KINDS.map((k) => (
              <option key={k} value={k} className="bg-ink-900">
                {k}
              </option>
            ))}
          </select>
          <button onClick={handleAddAlert} className={btnCls}>
            Add
          </button>
        </div>

        {data.alerts.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No alerts yet. Set one above — e.g. ticker “NVDA”, “Flag any new vendor-financing
            disclosure”, kind “News”.
          </p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {data.alerts.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <TickerChip ticker={a.ticker} />
                  <div>
                    <p className="text-sm text-slate-200">{a.text}</p>
                    <div className="mt-1">
                      <Tag tone={alertTone(a.kind)}>{a.kind}</Tag>
                    </div>
                  </div>
                </div>
                <div className="flex flex-none items-center gap-2">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={a.on}
                    onClick={() => toggleAlert(a.id)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
                      a.on ? "border-gold/40 bg-gold/30" : "border-white/10 bg-white/[0.06]"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                        a.on ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </button>
                  <button
                    onClick={() => removeAlert(a.id)}
                    aria-label="Remove alert"
                    className="flex h-6 w-6 items-center justify-center rounded-full border border-white/10 text-slate-500 transition hover:border-down/40 hover:text-down"
                  >
                    ×
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </GlassCard>
    </section>
  );
}
