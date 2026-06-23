"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import TradingViewWidget from "@/components/quantifi/TradingViewWidget";
import PriceChart from "@/components/quantifi/PriceChart";
import CompanySnapshot from "@/components/quantifi/CompanySnapshot";
import CompanyDetails from "@/components/quantifi/CompanyDetails";
import EtfSnapshot from "@/components/quantifi/EtfSnapshot";
import InsiderActivity from "@/components/quantifi/InsiderActivity";
import { GlassCard, TickerChip } from "@/components/quantifi/Cards";
import { tvSymbol } from "@/lib/tvSymbol";
import { stockByTicker, type CompanyAnalytics } from "@/data/demo";
import type { EtfData } from "@/lib/yahooEtf";
import { popularTickers } from "@/data/popularTickers";

const QUICK = ["NVDA", "AAPL", "MSFT", "TSLA", "AMZN", "GOOGL", "INFY.NS", "RELIANCE.NS"];

type Engine = "tv" | "quantifi";

function toTvSymbol(raw: string): string {
  const t = raw.trim().toUpperCase();
  if (!t) return "NASDAQ:NVDA";
  if (t.includes(":")) return t;
  const known = stockByTicker[t];
  if (known) return tvSymbol(t, known.exchange);
  if (t.endsWith(".NS")) return `NSE:${t.replace(".NS", "")}`;
  return t;
}

// Indian symbols routinely aren't served by TradingView's free widget, so default
// them to the Yahoo-powered chart that does cover them.
function defaultEngine(t: string): Engine {
  const u = t.toUpperCase();
  if (u.endsWith(".NS") || u.endsWith(".BO")) return "quantifi";
  return "tv";
}

interface ScoreResponse {
  available: boolean;
  live?: boolean;
  analytics?: CompanyAnalytics;
  price?: number;
  name?: string;
}

export default function StockExplorer({ initial = "NVDA" }: { initial?: string }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  // The URL's ?symbol= is the source of truth, so in-app links (e.g. clicking a
  // notification) load that stock instantly — no manual refresh needed.
  const urlSymbol = (searchParams.get("symbol") ?? initial).toUpperCase();

  const [input, setInput] = useState(urlSymbol);
  const [ticker, setTicker] = useState(urlSymbol);
  const [engine, setEngine] = useState<Engine>(defaultEngine(urlSymbol));
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const [scoreLoading, setScoreLoading] = useState(false);
  const [etf, setEtf] = useState<EtfData | null>(null);

  // Follow URL changes (notification clicks, back/forward) without a reload.
  useEffect(() => {
    setTicker(urlSymbol);
    setInput(urlSymbol);
  }, [urlSymbol]);

  // Reset to the smart default engine whenever the symbol changes.
  useEffect(() => {
    setEngine(defaultEngine(ticker));
  }, [ticker]);

  // Fetch the live Quantifi Score; if the symbol has no company fundamentals
  // (i.e. it's an ETF/fund), fall back to the ETF X-ray instead.
  useEffect(() => {
    let cancelled = false;
    setScore(null);
    setEtf(null);
    setScoreLoading(true);
    fetch(`/api/score/${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then(async (d: ScoreResponse) => {
        if (cancelled) return;
        setScore(d);
        if (!d.available) {
          // Stocks fail here for a reason — try the fund path.
          try {
            const er = await fetch(`/api/etf/${encodeURIComponent(ticker)}`);
            const ed = (await er.json()) as { available: boolean; etf?: EtfData };
            if (!cancelled && ed.available && ed.etf) setEtf(ed.etf);
          } catch {
            /* leave etf null → generic not-available card */
          }
        }
      })
      .catch(() => !cancelled && setScore({ available: false }))
      .finally(() => !cancelled && setScoreLoading(false));
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  // Navigate to a symbol via the URL so the address bar, refresh and shareable
  // links all stay in sync; the urlSymbol effect above updates the view.
  const go = (sym: string) => {
    const t = sym.trim().toUpperCase();
    if (!t) return;
    setTicker(t);
    setInput(t);
    router.replace(`/stock-analysis?symbol=${encodeURIComponent(t)}`, { scroll: false });
  };

  const commit = async () => {
    const raw = input.trim();
    if (!raw) return;
    let t = raw.toUpperCase();
    setTicker(t); // optimistic
    try {
      const r = await fetch(`/api/resolve?q=${encodeURIComponent(raw)}`);
      const d = await r.json();
      if (d.symbol && String(d.symbol).toUpperCase() !== t) {
        t = String(d.symbol).toUpperCase();
        setInput(t);
      }
    } catch {
      /* keep optimistic value */
    }
    go(t);
  };

  const tvSym = toTvSymbol(ticker);

  const segBtn = (e: Engine, label: string) => (
    <button
      type="button"
      onClick={() => setEngine(e)}
      className={
        engine === e
          ? "rounded-full bg-gold/20 px-3 py-1 font-medium text-gold"
          : "rounded-full px-3 py-1 text-slate-400 transition hover:text-white"
      }
    >
      {label}
    </button>
  );

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
              placeholder="e.g. AAPL, TSLA, ADANIENT.NS, QQQ"
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
                onClick={() => go(q)}
                className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-xs text-slate-300 transition hover:border-gold/40 hover:text-white"
              >
                {q}
              </button>
            ))}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Two chart engines: TradingView (interactive) and Quantifi (Yahoo data,
            covers symbols TradingView&apos;s free widget skips, like many Indian
            stocks). Switch anytime with the toggle.
          </p>
        </GlassCard>

        {/* Live chart with engine toggle */}
        <div className="mx-auto mt-4 max-w-4xl">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TickerChip ticker={ticker} active />
              <span className="text-xs text-slate-500">
                Live chart · {engine === "tv" ? "TradingView" : "Quantifi (Yahoo)"}
              </span>
            </div>
            <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-xs">
              {segBtn("tv", "TradingView")}
              {segBtn("quantifi", "Quantifi")}
            </div>
          </div>

          {engine === "tv" ? (
            <>
              <TradingViewWidget
                symbol={tvSym}
                kind="advanced-chart"
                height={540}
                range="12M"
                allowSymbolChange
              />
              <p className="mt-2 text-xs text-slate-500">
                Seeing “only available on TradingView”? Tap{" "}
                <span className="text-gold">Quantifi</span> above for the Yahoo-powered chart.
              </p>
            </>
          ) : (
            <PriceChart symbol={ticker} height={500} />
          )}
        </div>
      </section>

      {/* Quantifi Score (stocks) → ETF X-ray (funds) → graceful fallback */}
      {score?.available && score.analytics ? (
        <CompanySnapshot
          ticker={ticker}
          data={score.analytics}
          price={score.price}
          name={score.name}
          live={Boolean(score.live)}
        />
      ) : etf ? (
        <EtfSnapshot etf={etf} />
      ) : (
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <GlassCard className="p-6">
            <h3 className="font-display text-base font-semibold text-white">
              {scoreLoading
                ? `Loading analysis for ${ticker}…`
                : `Analysis not available for ${ticker}`}
            </h3>
            {!scoreLoading ? (
              <p className="mt-2 text-sm leading-relaxed text-slate-400">
                We couldn&apos;t pull fundamentals or fund data for this symbol — it
                may be an index, an unrecognized ticker, or Yahoo may be temporarily
                rate-limiting. The chart above still works.
              </p>
            ) : null}
          </GlassCard>
        </section>
      )}

      {/* Funds have no company filings/insiders — hide those sections for them. */}
      {etf ? null : (
        <>
          <CompanyDetails symbol={ticker} />
          <InsiderActivity ticker={ticker} heading showFilter />
        </>
      )}
    </>
  );
}
