"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import TradingViewWidget from "@/components/quantifi/TradingViewWidget";
import PriceChart from "@/components/quantifi/PriceChart";
import CompanySnapshot from "@/components/quantifi/CompanySnapshot";
import CompanyVitals from "@/components/quantifi/CompanyVitals";
import ShareholdingStats from "@/components/quantifi/ShareholdingStats";
import CompanyDetails from "@/components/quantifi/CompanyDetails";
import EtfSnapshot from "@/components/quantifi/EtfSnapshot";
import Competitors from "@/components/quantifi/Competitors";
import PeerComparison from "@/components/quantifi/PeerComparison";
import PeRatioChart from "@/components/quantifi/PeRatioChart";
import CompanyNewsSection from "@/components/quantifi/CompanyNewsSection";
import MyNotes from "@/components/quantifi/MyNotes";
import InsiderActivity from "@/components/quantifi/InsiderActivity";
import StockHero from "@/components/quantifi/StockHero";
import KeyValuationMetric from "@/components/quantifi/KeyValuationMetric";
import AnalystConsensus from "@/components/quantifi/AnalystConsensus";
import DebtEquityHistory from "@/components/quantifi/DebtEquityHistory";
import StockSectionNav, { type NavSection } from "@/components/quantifi/StockSectionNav";
import { GlassCard, Eyebrow } from "@/components/quantifi/Cards";
import { SCORE_AXES, type CompanyAnalytics } from "@/data/demo";
import type { EtfData } from "@/lib/yahooEtf";
import { popularTickers } from "@/data/popularTickers";
import { useProStatus } from "@/lib/useProStatus";
import {
  QUANTIFI_PRO,
  FREE_LAUNCH_OFFER,
  FREE_LAUNCH_DAYS,
  PRO_PRICE_LABEL,
  PRO_PRICE_NOTE,
  PRO_STANDARD_PRICE,
} from "@/data/plans";
import { FREE_LIMIT } from "@/lib/freeLimit";
import { knownFund } from "@/data/knownFunds";

const QUICK = ["NVDA", "AAPL", "MSFT", "TSLA", "AMZN", "GOOGL", "INFY.NS", "RELIANCE.NS"];

// The full set of anchors the section rail can link to. StockSectionNav shows only
// the ones that actually rendered (data-driven sections return null), so the same
// list works for a full stock, an ETF X-ray, or a sparse name.
const NAV_SECTIONS: NavSection[] = [
  { id: "sec-chart", label: "Chart" },
  { id: "sec-score", label: "Snowflake score" },
  { id: "sec-etf", label: "Fund X-ray" },
  { id: "sec-overview", label: "Overview & financials" },
  { id: "sec-health", label: "Financial health" },
  { id: "sec-stats", label: "Key statistics" },
  { id: "sec-valuation", label: "Valuation" },
  { id: "sec-analyst", label: "Analyst view" },
  { id: "sec-ownership", label: "Ownership" },
  { id: "sec-competitors", label: "Competitors" },
  { id: "sec-peers", label: "Peers" },
  { id: "sec-news", label: "News" },
  { id: "sec-insider", label: "Insider trades" },
  { id: "sec-notes", label: "My notes" },
];

type Engine = "tv" | "quantifi";

function toTvSymbol(raw: string): string {
  const t = raw.trim().toUpperCase();
  if (!t) return "NASDAQ:NVDA";
  if (t.includes(":")) return t;
  if (t.endsWith(".NS")) return `NSE:${t.replace(".NS", "")}`;
  return t;
}

// Any non-US listing carries an exchange suffix (.NS/.BO India, .KS/.KQ Korea,
// .T Japan, .HK Hong Kong, .L London, .SS/.SZ China, …). TradingView's free
// widget routinely doesn't serve these without an exchange-specific prefix, so
// it throws "this symbol doesn't exist" — the engine shouldn't even be offered
// for them.
function tvCantServe(t: string): boolean {
  const u = t.toUpperCase();
  if (/\.[A-Z]{1,4}$/.test(u)) return true; // any non-US listing
  // Non-exchange-traded funds (e.g. ARKVX) aren't on TradingView's free widget.
  if (knownFund(u)?.preferQuantifiChart) return true;
  return false;
}

// The Quantifi chart leads everywhere, including US names TradingView can serve:
// it's the one carrying our own work — the 8-K event markers, period high/low and
// the crosshair detail — and it keeps the chart consistent across every listing.
// TradingView stays one click away for anyone who wants its drawing tools.
function defaultEngine(_t: string): Engine {
  return "quantifi";
}

interface ScoreResponse {
  available: boolean;
  live?: boolean;
  analytics?: CompanyAnalytics;
  price?: number;
  name?: string;
  currency?: string;
  reason?: string;
  message?: string;
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
  type Stage = "loading" | "analysis" | "reveal" | "wall" | "signin";
  const resolved = !scoreLoading && score !== null; // know whether there's data to gate
  let stage: Stage = "loading";
  if (!proReady) stage = "loading";
  else if (pro) stage = "analysis";
  else if (!user) stage = "signin"; // reachable signed out — the wall sits in the page
  else if (!meterReady) stage = "loading";
  else if (unlocked) stage = "analysis";
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
            if (!cancelled && ed.available && ed.etf) {
              setEtf(ed.etf);
              // Mutual funds / non-exchange-traded funds aren't on TradingView's
              // free widget — move straight to the Quantifi (Yahoo) chart.
              if (ed.etf.kind !== "ETF") setEngine("quantifi");
            }
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
    // Resolve FIRST so a free-text name (e.g. "Sandisk") never reaches the chart
    // as a broken raw symbol. /api/resolve maps names → tickers (SANDISK → SNDK)
    // via the curated map before falling back to Yahoo search.
    let t = raw.toUpperCase();
    try {
      const r = await fetch(`/api/resolve?q=${encodeURIComponent(raw)}`);
      const d = await r.json();
      if (d.symbol) t = String(d.symbol).toUpperCase();
    } catch {
      /* fall back to the raw upper-cased input */
    }
    setInput(t);
    go(t);
  };

  const tvSym = toTvSymbol(ticker);
  const tvUnsupported = tvCantServe(ticker);

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

  // Signed-out visitors can't analyse at all — the free quota is per email, so we
  // require sign-in before anything (the chart included) is shown.
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pb-4 pt-8 sm:px-6 lg:px-8">
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
            {tvUnsupported
              ? "Charts for this listing are drawn by the Quantifi engine (Yahoo data) — TradingView’s free widget doesn’t carry non-US symbols."
              : "The Quantifi chart is shown by default — it carries corporate event markers drawn from SEC filings, plus period high/low. Switch to TradingView anytime for its drawing tools."}
          </p>
        </GlassCard>
      </section>

      {stage === "analysis" ? (
        <div className="mx-auto max-w-7xl lg:grid lg:grid-cols-[224px_minmax(0,1fr)]">
          {/* Sticky section rail (desktop) */}
          <div className="lg:pl-4">
            <StockSectionNav sections={NAV_SECTIONS} />
          </div>

          {/* Main content column */}
          <div className="min-w-0">
            {/* Identity band — who this company is, what it costs, and the actions. */}
            <StockHero
              ticker={ticker}
              name={score?.name ?? etf?.name}
              price={score?.price}
              currency={score?.currency}
              score={
                score?.analytics
                  ? SCORE_AXES.reduce((sum, ax) => sum + (score.analytics!.scores[ax.key].score ?? 0), 0)
                  : undefined
              }
              fairValue={score?.analytics?.fairValue?.estimate}
            />

            {/* Live chart with engine toggle — only for a revealed name or Pro. */}
            <section id="sec-chart" className="scroll-mt-24 px-4 pb-2 pt-6 sm:px-6 lg:px-8">
              <div className="mx-auto max-w-4xl">
                {/* TradingView's free widget can't serve suffixed non-US listings
                    (.NS/.BO/.KS/.HK/.T/…) — it just renders "symbol doesn't
                    exist". Defaulting away from it wasn't enough: the toggle was
                    still there to be tapped into that error. For those symbols we
                    don't offer the engine at all. */}
                {tvUnsupported ? null : (
                  <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
                    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-xs">
                      {segBtn("tv", "TradingView")}
                      {segBtn("quantifi", "Quantifi")}
                    </div>
                  </div>
                )}

                {engine === "tv" && !tvUnsupported ? (
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
            {!pro && meterReady ? (
              <section className="px-4 sm:px-6 lg:px-8">
                <p className="text-center text-xs text-slate-500">
                  Free plan · {Math.min(usedCount, FREE_LIMIT)} of {FREE_LIMIT} free analyses used.{" "}
                  <Link href="/pricing" className="text-gold hover:underline">
                    Go Pro for unlimited →
                  </Link>
                </p>
              </section>
            ) : null}

            {/* Quantifi Score (stocks) → ETF X-ray (funds) → graceful fallback */}
            {score?.available && score.analytics ? (
              <>
                <div id="sec-score" className="scroll-mt-24">
                  <CompanySnapshot
                    ticker={ticker}
                    data={score.analytics}
                    price={score.price}
                    name={score.name}
                    currency={score.currency}
                    live={Boolean(score.live)}
                  />
                </div>
                <div id="sec-overview" className="scroll-mt-24">
                  <CompanyDetails symbol={ticker} />
                </div>
                <div id="sec-health" className="scroll-mt-24">
                  <DebtEquityHistory symbol={ticker} name={score.name} />
                </div>
                <div id="sec-stats" className="scroll-mt-24">
                  <CompanyVitals symbol={ticker} />
                </div>
                <div id="sec-valuation" className="scroll-mt-24">
                  <KeyValuationMetric symbol={ticker} name={score.name} />
                  <PeRatioChart symbol={ticker} name={score.name} />
                </div>
                <div id="sec-analyst" className="scroll-mt-24">
                  <AnalystConsensus symbol={ticker} name={score.name} />
                </div>
                <div id="sec-ownership" className="scroll-mt-24">
                  <ShareholdingStats symbol={ticker} />
                </div>
                <div id="sec-competitors" className="scroll-mt-24">
                  <Competitors symbol={ticker} name={score.name} kind="stocks" />
                </div>
                <div id="sec-peers" className="scroll-mt-24">
                  <PeerComparison symbol={ticker} name={score.name} />
                </div>
              </>
            ) : etf ? (
              <>
                <div id="sec-etf" className="scroll-mt-24">
                  <EtfSnapshot etf={etf} />
                </div>
                <div id="sec-competitors" className="scroll-mt-24">
                  <Competitors symbol={ticker} name={etf.name} kind="funds" />
                </div>
              </>
            ) : (
              <section className="px-4 pb-12 sm:px-6 lg:px-8">
                <GlassCard className="p-6">
                  <h3 className="font-display text-base font-semibold text-white">
                    {scoreLoading
                      ? `Loading analysis for ${ticker}…`
                      : `Analysis not available for ${ticker}`}
                  </h3>
                  {!scoreLoading ? (
                    <p className="mt-2 text-sm leading-relaxed text-slate-400">
                      {score?.message ??
                        "Live data is unavailable for this name right now. This is normal for ETFs and funds, indices, crypto, currencies and very new listings — or the market-data source may be briefly rate-limiting. The chart above still works."}
                    </p>
                  ) : null}
                </GlassCard>
              </section>
            )}

            {/* News gets its own section (separate from the company tabs). */}
            {hasAnalysis ? (
              <div id="sec-news" className="scroll-mt-24">
                <CompanyNewsSection symbol={ticker} name={score?.name ?? etf?.name} />
              </div>
            ) : null}

            {/* Personal notes for this ticker. */}
            <div id="sec-notes" className="scroll-mt-24">
              <MyNotes ticker={ticker} />
            </div>

            {/* Company filings + insiders: stocks only. */}
            {hasAnalysis && !etf ? (
              <div id="sec-insider" className="scroll-mt-24">
                <InsiderActivity ticker={ticker} heading showFilter />
              </div>
            ) : null}
          </div>
        </div>
      ) : stage === "loading" ? (
        <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
          <GlassCard className="p-6">
            <p className="text-sm text-slate-500">Loading analysis…</p>
          </GlassCard>
        </section>
      ) : stage === "reveal" ? (
        <RevealGate
          ticker={ticker}
          used={usedCount}
          limit={FREE_LIMIT}
          revealing={revealing}
          onReveal={reveal}
        />
      ) : stage === "signin" ? (
        <SignInGate ticker={ticker} />
      ) : stage === "wall" ? (
        <FreeLimitWall ticker={ticker} signedIn={Boolean(user)} />
      ) : null}
    </>
  );
}

// The free quota is per email, so a signed-out visitor can't analyse at all —
// otherwise they could just reload (or open another device) to dodge the limit.
// This gates the whole page, chart included.
function SignInGate({ ticker }: { ticker: string }) {
  return (
    <section className="mx-auto max-w-2xl px-4 pb-16 pt-2 sm:px-6">
      <GlassCard className="border-gold/30 bg-gold/[0.04] p-8 text-center">
        <Eyebrow>Quantifi</Eyebrow>
        <h2 className="mt-4 font-display text-2xl font-semibold text-white sm:text-3xl">
          Create a free account to see {ticker}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
          The valuation, the Quantifi Score, the fundamentals and the insider trades for{" "}
          <span className="text-white">{ticker}</span> are a moment away. Accounts are free, and
          your free analyses are tied to the account so they follow you across every device.
          {/* No count quoted: it would come from FREE_LIMIT, and that figure is
              a per-day quota rather than what an account is actually granted. */}
        </p>
        <div className="mt-7">
          <a
            href="/login"
            className="rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-6 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Create your free account →
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
          {limit === 1 ? "analysis" : "analyses"} left. Revealing {ticker} uses one and unlocks
          its live chart, Quantifi Score, fundamentals and insider activity — and you can
          re-open {ticker} anytime at no extra cost.
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

        {/* This wall hardcoded the paid price and so kept quoting a figure long
            after the launch offer made Pro free. Both states now come from the
            shared labels in plans.ts. */}
        {FREE_LAUNCH_OFFER ? (
          <>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
              <span className="font-mono text-slate-200">{ticker}</span> — its chart, the Quantifi
              Score, fundamentals and insider activity — needs Quantifi Pro. Right now Pro is{" "}
              <span className="font-semibold text-gold">free</span> for your first{" "}
              {FREE_LAUNCH_DAYS} days — no card needed.
            </p>
            <div className="mt-5 inline-flex items-baseline gap-2.5 rounded-lg border border-gold/30 bg-gold/[0.07] px-4 py-2.5">
              <span className="font-display text-3xl font-semibold text-gold">{PRO_PRICE_LABEL}</span>
              <span className="font-display text-lg font-medium text-slate-500 line-through decoration-slate-400/70">
                {PRO_STANDARD_PRICE}
              </span>
              <span className="text-xs text-slate-400">{PRO_PRICE_NOTE}</span>
            </div>
          </>
        ) : (
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
            <span className="font-mono text-slate-200">{ticker}</span> — its chart, the Quantifi
            Score, fundamentals and insider activity — needs Quantifi Pro now. Unlock unlimited
            analysis for{" "}
            <span className="font-semibold text-gold">
              {QUANTIFI_PRO.price}/{QUANTIFI_PRO.period}
            </span>{" "}
            <span className="text-slate-500 line-through">{PRO_STANDARD_PRICE}</span>.
          </p>
        )}

        <div className="mt-7 flex items-center justify-center gap-3">
          <Link
            href="/pricing"
            className="rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-6 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            {FREE_LAUNCH_OFFER ? "Claim free Pro →" : "Get Quantifi Pro →"}
          </Link>
          {!signedIn ? (
            <a
              href="/login"
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
