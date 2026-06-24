"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TradingViewWidget from "@/components/quantifi/TradingViewWidget";
import PriceChart from "@/components/quantifi/PriceChart";
import CompanySnapshot from "@/components/quantifi/CompanySnapshot";
import CompanyDetails from "@/components/quantifi/CompanyDetails";
import EtfSnapshot from "@/components/quantifi/EtfSnapshot";
import Competitors from "@/components/quantifi/Competitors";
import CompanyNewsSection from "@/components/quantifi/CompanyNewsSection";
import MyNotes from "@/components/quantifi/MyNotes";
import InsiderActivity from "@/components/quantifi/InsiderActivity";
import { GlassCard, TickerChip, Eyebrow } from "@/components/quantifi/Cards";
import { tvSymbol } from "@/lib/tvSymbol";
import { stockByTicker, type CompanyAnalytics } from "@/data/demo";
import type { EtfData } from "@/lib/yahooEtf";
import { popularTickers } from "@/data/popularTickers";
import { useProStatus } from "@/lib/useProStatus";
import { QUANTIFI_PRO } from "@/data/plans";
import { FREE_LIMIT } from "@/lib/freeLimit";

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

  // Free-analysis quota is enforced server-side, per email (Pro is unlimited).
  // `used` = the symbols this account has already unlocked; loaded from the API
  // so a refresh or a different device can't reset it.
  const { pro, user, ready: proReady } = useProStatus();
  const [used, setUsed] = useState<string[] | null>(null);
  const [meterReady, setMeterReady] = useState(false);
  const [revealing, setRevealing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMeterReady(false);
    fetch("/api/free-analyses")
      .then((r) => r.json())
      .then((d: { used?: string[] }) => {
        if (cancelled) return;
        setUsed(d.used ?? []);
        setMeterReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setUsed([]);
        setMeterReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.email, pro]);

  const hasAnalysis = Boolean((score?.available && score.analytics) || etf);
  const usedCount = used?.length ?? 0;
  const unlocked = pro || (used?.includes(ticker) ?? false);
  const limitReached = usedCount >= FREE_LIMIT;

  // Spend one free analysis on the current symbol (re-opening a revealed name is
  // free). The server is the source of truth; we just reflect what it returns.
  const reveal = async () => {
    if (revealing) return;
    setRevealing(true);
    try {
      const r = await fetch("/api/free-analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: ticker }),
      });
      const d = (await r.json()) as { allowed?: boolean; used?: string[] };
      if (Array.isArray(d.used)) setUsed(d.used);
    } catch {
      /* leave the gate up; they can retry */
    } finally {
      setRevealing(false);
    }
  };

  // What to render in the analysis slot. The chart above is always free.
  //   loading  → still resolving plan/quota
  //   analysis → Pro, or a free user who has unlocked this symbol
  //   signin   → not signed in (quota is per email, so we need one)
  //   reveal   → signed-in free user with slots left
  //   wall     → signed-in free user who has spent every slot
  type Stage = "loading" | "analysis" | "signin" | "reveal" | "wall";
  const resolved = !scoreLoading && score !== null; // know whether there's data to gate
  let stage: Stage = "loading";
  if (!proReady) stage = "loading";
  else if (pro) stage = "analysis";
  else if (!meterReady) stage = "loading";
  else if (unlocked) stage = "analysis";
  else if (!user) stage = "signin";
  else if (!resolved) stage = "loading";
  else if (!hasAnalysis) stage = "analysis"; // nothing to reveal → show the free "not available" card, no charge
  else if (limitReached) stage = "wall";
  else stage = "reveal";

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

      {/* Free-plan meter hint (only once they've unlocked this name). */}
      {stage === "analysis" && !pro && meterReady ? (
        <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <p className="text-center text-xs text-slate-500">
            Free plan · {Math.min(usedCount, FREE_LIMIT)} of {FREE_LIMIT} free analyses used.{" "}
            <Link href="/pricing" className="text-gold hover:underline">
              Go Pro for unlimited →
            </Link>
          </p>
        </section>
      ) : null}

      {stage === "loading" ? (
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <GlassCard className="p-6">
            <p className="text-sm text-slate-500">Loading analysis…</p>
          </GlassCard>
        </section>
      ) : stage === "signin" ? (
        <SignInGate ticker={ticker} />
      ) : stage === "reveal" ? (
        <RevealGate
          ticker={ticker}
          used={usedCount}
          limit={FREE_LIMIT}
          revealing={revealing}
          onReveal={reveal}
        />
      ) : stage === "wall" ? (
        <FreeLimitWall ticker={ticker} signedIn={Boolean(user)} />
      ) : (
        <>
          {/* Quantifi Score (stocks) → ETF X-ray (funds) → graceful fallback */}
          {score?.available && score.analytics ? (
            <>
              <CompanySnapshot
                ticker={ticker}
                data={score.analytics}
                price={score.price}
                name={score.name}
                live={Boolean(score.live)}
              />
              <Competitors symbol={ticker} name={score.name} kind="stocks" />
            </>
          ) : etf ? (
            <>
              <EtfSnapshot etf={etf} />
              <Competitors symbol={ticker} name={etf.name} kind="funds" />
            </>
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

          {/* News gets its own section (separate from the company tabs). */}
          {hasAnalysis ? (
            <CompanyNewsSection symbol={ticker} name={score?.name ?? etf?.name} />
          ) : null}

          {/* Personal notes for this ticker. */}
          <MyNotes ticker={ticker} />

          {/* Company filings + insiders: stocks only (funds and no-data symbols
              don't have them, and this keeps insider data out of the free
              "not available" view). */}
          {hasAnalysis && !etf ? (
            <>
              <CompanyDetails symbol={ticker} />
              <InsiderActivity ticker={ticker} heading showFilter />
            </>
          ) : null}
        </>
      )}
    </>
  );
}

// Free quota is per email, so a signed-out visitor can't get analyses — they
// could just reload to dodge the limit. Ask them to sign in first.
function SignInGate({ ticker }: { ticker: string }) {
  return (
    <section className="mx-auto max-w-2xl px-4 pb-16 pt-2 sm:px-6">
      <GlassCard className="border-gold/30 bg-gold/[0.04] p-8 text-center">
        <Eyebrow>Quantifi</Eyebrow>
        <h2 className="mt-4 font-display text-2xl font-semibold text-white sm:text-3xl">
          Sign in to analyse {ticker}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
          The live chart above is free for everyone. The full Quantifi Score, fundamentals
          and insider activity come with <span className="text-gold">{FREE_LIMIT} free analyses</span>{" "}
          on every account — sign in so we can keep them tied to you across your devices.
        </p>
        <div className="mt-7">
          <a
            href="/api/auth/login"
            className="rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-6 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Sign in to continue →
          </a>
        </div>
      </GlassCard>
    </section>
  );
}

// Signed-in free user with slots left: the analysis stays hidden until they
// choose to spend one of their free analyses on this name.
function RevealGate({
  ticker,
  used,
  limit,
  revealing,
  onReveal,
}: {
  ticker: string;
  used: number;
  limit: number;
  revealing: boolean;
  onReveal: () => void;
}) {
  const left = Math.max(0, limit - used);
  return (
    <section className="mx-auto max-w-2xl px-4 pb-16 pt-2 sm:px-6">
      <GlassCard className="border-gold/30 bg-gold/[0.04] p-8 text-center">
        <Eyebrow>Free analysis</Eyebrow>
        <h2 className="mt-4 font-display text-2xl font-semibold text-white sm:text-3xl">
          Reveal the full analysis for {ticker}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
          You have <span className="font-semibold text-gold">{left}</span> of {limit} free{" "}
          {limit === 1 ? "analysis" : "analyses"} left. Revealing {ticker} uses one — the chart
          above stays free, and you can re-open {ticker} anytime at no extra cost.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={onReveal}
            disabled={revealing}
            className="rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-6 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
          >
            {revealing ? "Unlocking…" : `Reveal analysis (uses 1 of ${left})`}
          </button>
          <Link
            href="/pricing"
            className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-medium text-white transition hover:border-gold/40"
          >
            Go Pro · unlimited
          </Link>
        </div>
      </GlassCard>
    </section>
  );
}

// Shown when a free user has spent their free analyses and opens a new name.
function FreeLimitWall({ ticker, signedIn }: { ticker: string; signedIn: boolean }) {
  return (
    <section className="mx-auto max-w-2xl px-4 pb-16 pt-2 sm:px-6">
      <GlassCard className="border-gold/30 bg-gold/[0.04] p-8 text-center">
        <Eyebrow>Quantifi Pro</Eyebrow>
        <h2 className="mt-4 font-display text-2xl font-semibold text-white sm:text-3xl">
          You&apos;ve used your {FREE_LIMIT} free analyses
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
          The chart for <span className="font-mono text-slate-200">{ticker}</span> stays free, but
          the full Quantifi Score, fundamentals and insider activity are part of Pro. Unlock
          unlimited analysis for{" "}
          <span className="font-semibold text-gold">
            {QUANTIFI_PRO.price}/{QUANTIFI_PRO.period}
          </span>{" "}
          <span className="text-slate-500 line-through">₹500</span>.
        </p>
        <div className="mt-7 flex items-center justify-center gap-3">
          <Link
            href="/pricing"
            className="rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-6 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Get Quantifi Pro →
          </Link>
          {!signedIn ? (
            <a
              href="/api/auth/login"
              className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-medium text-white transition hover:border-gold/40"
            >
              Sign in
            </a>
          ) : null}
        </div>
      </GlassCard>
    </section>
  );
}
