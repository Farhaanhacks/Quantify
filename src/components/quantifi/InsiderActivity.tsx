"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassCard, SectionHeading, TickerChip, Tag, Skeleton } from "@/components/quantifi/Cards";
import { fmtCompact } from "@/data/demo";

interface ApiTrade {
  id: string;
  ticker: string;
  company: string;
  person: string;
  role: string;
  action: string;
  acquired: boolean;
  shares: number;
  price: number;
  value: number;
  date: string;
  planned: boolean;
  planDate?: string;
  code: string;
}

interface Row {
  id: string;
  ticker: string;
  company: string;
  person: string;
  role: string;
  actionLabel: string;
  acquired: boolean;
  planned: boolean;
  planDate?: string;
  valueText: string;
  sharesText: string;
  dateText: string;
}

// Indian (BSE) insider/SAST disclosures are announcement filings, not the
// structured per-transaction rows US Form 4 gives us.
interface ApiDisclosure {
  id: string;
  ticker: string;
  company: string;
  headline: string;
  category: string;
  date: string;
  url?: string;
  person?: string;
  action?: string;
  sharesText?: string;
  valueText?: string;
}

type Filter = "All" | "Buys" | "Sells" | "Planned";

function fmtDate(d: string): string {
  const t = Date.parse(d);
  if (isNaN(t)) return d;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Share counts arrive from NSE as bare digit strings ("1200000"). Ungrouped,
// a column of them cannot be read at a glance — which is the whole point of
// giving shares a column. Group them the way Indian filings and Indian readers
// do (12,00,000), and leave anything that isn't a plain number alone.
function fmtShares(text?: string): string | undefined {
  const lead = text?.match(/^[\d,]+/)?.[0];
  if (!lead) return text;
  const n = Number(lead.replace(/,/g, ""));
  return Number.isFinite(n) && n > 0 ? n.toLocaleString("en-IN") : lead;
}

// Green for buy-like actions, red for sell-like, neutral otherwise.
function insiderTone(action?: string): "up" | "down" | "flat" {
  const a = (action || "").toLowerCase();
  if (/\b(buy|acqui|purchase|allot)/.test(a)) return "up";
  if (/\b(sell|sale|dispos|pledge|invocation)/.test(a)) return "down";
  return "flat";
}

function tradeToRow(t: ApiTrade): Row {
  return {
    id: t.id,
    ticker: t.ticker,
    company: t.company,
    person: t.person,
    role: t.role,
    actionLabel: t.action,
    acquired: t.acquired,
    planned: t.planned,
    planDate: t.planDate,
    valueText: t.value ? `$${fmtCompact(t.value)}` : t.price ? `$${t.price.toFixed(2)}` : "—",
    sharesText: t.shares ? t.shares.toLocaleString() : "—",
    dateText: fmtDate(t.date),
  };
}

// Placeholder rows shown while the live filing feed is in flight. `cols` are the
// grid tracks of the table this stands in for, so the section keeps its shape
// instead of collapsing to a single "Loading…" line on first paint.
function FilingSkeletonRows({ rows, cols }: { rows: number; cols: string[] }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, r) => (
        <li key={`sk-${r}`} className="grid items-center gap-3 px-5 py-4" style={{ gridTemplateColumns: cols.join(" ") }}>
          {cols.map((_c, i) =>
            i === 0 ? (
              <span key={i} className="flex items-center gap-2.5">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="hidden h-3 w-28 sm:block" />
              </span>
            ) : (
              <span key={i} className="flex justify-end">
                <Skeleton className="h-3.5 w-16" />
              </span>
            )
          )}
        </li>
      ))}
    </>
  );
}

export default function InsiderActivity({
  showFilter = true,
  limit,
  heading = true,
  ticker,
}: {
  showFilter?: boolean;
  limit?: number;
  heading?: boolean;
  ticker?: string;
}) {
  const [trades, setTrades] = useState<ApiTrade[] | null>(null);
  const [disclosures, setDisclosures] = useState<ApiDisclosure[]>([]);
  const [market, setMarket] = useState<"US" | "IN">("US");
  const [exchange, setExchange] = useState<"NSE" | "BSE">("NSE");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Why an Indian lookup came back empty, straight from the API. Without this
  // the page cannot tell "this company filed nothing" from "the exchange never
  // answered us", and it used to state the first for both.
  const [reason, setReason] = useState<"unconfigured" | "blocked" | "empty" | undefined>(undefined);
  const [filter, setFilter] = useState<Filter>("All");

  // Standalone (no fixed ticker) page lets the user search a company. `query`
  // is the searched symbol; when set it overrides the default feed.
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState<string | undefined>(undefined);
  const activeTicker = ticker ?? query;

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setReason(undefined);
    const url = activeTicker
      ? `/api/insider/${encodeURIComponent(activeTicker)}`
      : "/api/insider-feed";
    (async () => {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`status ${r.status}`);
        const d = (await r.json()) as {
          available?: boolean;
          market?: "US" | "IN";
          source?: string;
          reason?: "unconfigured" | "blocked" | "empty";
          trades?: ApiTrade[];
          disclosures?: ApiDisclosure[];
        };
        if (cancelled) return;
        if (d.market === "IN") {
          setMarket("IN");
          // "store"/"nse" → NSE; "bse" → BSE. Default NSE (the primary source now).
          setExchange(d.source === "bse" ? "BSE" : "NSE");
          setDisclosures(d.available && Array.isArray(d.disclosures) ? d.disclosures : []);
          setReason(d.reason);
          setTrades([]);
        } else {
          setMarket("US");
          setTrades(d.available && Array.isArray(d.trades) ? d.trades : []);
          setDisclosures([]);
        }
      } catch {
        if (!cancelled) {
          setTrades([]);
          setDisclosures([]);
          setError(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeTicker]);

  const live = !!trades && trades.length > 0;
  // For an Indian symbol we lean on the fetched market flag, but also on the
  // ticker itself so the labels switch immediately (before the fetch resolves).
  const isIndia = market === "IN" || (!!activeTicker && /\.(NS|BO)$/i.test(activeTicker));
  const liveIN = disclosures.length > 0;
  // Live SEC EDGAR data only — never a demo fallback. An empty result is an
  // honest empty state, not a reason to show fabricated trades.
  const source: Row[] = useMemo(
    () => (live ? (trades as ApiTrade[]).map(tradeToRow) : []),
    [live, trades]
  );

  const runSearch = () => {
    const t = queryInput.trim().toUpperCase();
    setQuery(t || undefined);
  };

  const filtered = useMemo(() => {
    const out = source.filter((r) => {
      if (filter === "Buys") return r.acquired;
      if (filter === "Sells") return !r.acquired;
      if (filter === "Planned") return r.planned;
      return true;
    });
    return limit ? out.slice(0, limit) : out;
  }, [source, filter, limit]);

  // Buys vs sells summary for the Indian disclosures (the headline carries the
  // transaction type, e.g. "… · Buy · …" / "… · Sell · …").
  const inBuySell = useMemo(() => {
    let buys = 0;
    let sells = 0;
    for (const d of disclosures) {
      const h = (d.headline || "").toLowerCase();
      if (/\b(buy|acqui|purchase)/.test(h)) buys++;
      else if (/\b(sell|sale|dispos|pledge|invocation)/.test(h)) sells++;
    }
    return { buys, sells };
  }, [disclosures]);

  // When embedded on a stock page (a fixed `ticker`), don't render an empty
  // Insider Activity section once the fetch has resolved with nothing — a blank
  // "no disclosures" card just looks broken. The standalone page (no fixed
  // ticker, has its own search UI) always renders.
  //
  // But only when the emptiness is REAL. If the exchange blocked us, or nothing
  // is configured to reach it, hiding the section is how this ends up looking
  // like a feature that simply does not exist: the reader gets no data and no
  // explanation, and cannot tell the difference. Those cases keep the section
  // and say what happened.
  const unexplained = reason === "blocked" || reason === "unconfigured";
  if (ticker && !loading && !live && !liveIN && !unexplained) return null;

  const filters: Filter[] = ["All", "Buys", "Sells", "Planned"];

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Insider Activity"
          title={activeTicker ? `Insider trades · ${activeTicker}` : "Insider trades"}
          subtitle={
            isIndia
              ? `Insider / SAST disclosures filed with ${exchange} — promoters, directors and designated persons under SEBI (PIT) Regulation 7. Official filings shown as disclosed; never a signal on its own. Beta.`
              : "Real Form 4 filings from SEC EDGAR — directors and officers, with a 10b5-1 flag when the trade was pre-arranged. Disclosed after the fact; never a signal on its own."
          }
          href={ticker ? undefined : "/insider-activity"}
          cta={ticker ? undefined : "All activity"}
        />
      ) : null}

      {/* Search a specific company (standalone page only) */}
      {!ticker ? (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <input
            value={queryInput}
            onChange={(e) => setQueryInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && runSearch()}
            placeholder="Search a company's insider trades — e.g. AAPL, NVDA, TSLA"
            className="min-w-[16rem] flex-1 rounded-lg border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-white outline-none focus:border-gold/40"
          />
          <button
            type="button"
            onClick={runSearch}
            className="rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-5 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Search
          </button>
          {query ? (
            <button
              type="button"
              onClick={() => {
                setQuery(undefined);
                setQueryInput("");
              }}
              className="rounded-lg border border-white/10 px-4 py-2.5 text-sm text-slate-300 transition hover:border-white/30 hover:text-white"
            >
              Back to feed
            </button>
          ) : null}
        </div>
      ) : null}

      {showFilter && !isIndia ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {filters.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                filter === t
                  ? "border-gold/50 bg-gold/15 text-gold"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
              }`}
            >
              {t === "Planned" ? "Planned (10b5-1)" : t}
            </button>
          ))}
        </div>
      ) : null}

      {isIndia && liveIN ? (
        <div className="mt-4 flex items-center gap-2 text-xs">
          <span className="rounded-full border border-up/30 bg-up/10 px-3 py-1 font-medium text-up">
            {inBuySell.buys} {inBuySell.buys === 1 ? "buy" : "buys"}
          </span>
          <span className="rounded-full border border-down/30 bg-down/10 px-3 py-1 font-medium text-down">
            {inBuySell.sells} {inBuySell.sells === 1 ? "sell" : "sells"}
          </span>
          <span className="text-slate-500">in recent filings</span>
        </div>
      ) : null}

      {isIndia ? (
        <GlassCard className="mt-6 overflow-hidden">
          {/* Six columns rather than one paragraph. Name, role, side, size and
              value were being run together into a single "·"-joined line, so
              nothing could be compared down the page — the thing a filings
              table exists for. Below lg they stack with inline labels, since
              six columns on a phone is worse than none. */}
          <div className="hidden grid-cols-[1.7fr_1.2fr_0.6fr_0.85fr_0.9fr_0.75fr] gap-3 border-b border-white/[0.06] px-5 py-3 text-[0.62rem] uppercase tracking-[0.16em] text-slate-500 lg:grid">
            <span>Person</span>
            <span>Role</span>
            <span>Side</span>
            <span className="text-right">Shares</span>
            <span className="text-right">Value</span>
            <span className="text-right">When</span>
          </div>
          <ul className="divide-y divide-white/[0.05]">
            {loading && disclosures.length === 0 ? (
              <FilingSkeletonRows rows={limit ?? 5} cols={["1.7fr", "1.2fr", "0.6fr", "0.85fr", "0.9fr", "0.75fr"]} />
            ) : null}
            {(limit ? disclosures.slice(0, limit) : disclosures).map((d) => {
              const tone = d.action ? insiderTone(d.action) : "flat";
              const pill =
                tone === "up"
                  ? "border-up/30 bg-up/10 text-up"
                  : tone === "down"
                    ? "border-down/30 bg-down/10 text-down"
                    : "border-white/10 bg-white/[0.04] text-slate-300";
              // The share count reads better as a figure in its own column;
              // "15000 Equity Shares" repeated down a column headed "Shares" is
              // mostly the word "Equity Shares". The full text stays as the
              // tooltip so nothing is lost.
              const sharesNum = fmtShares(d.sharesText);

              // A BSE announcement has no structured fields — only a headline.
              // Forcing that into columns would leave five empty cells and a
              // truncated sentence, so it keeps the full width.
              if (!d.person) {
                return (
                  <li key={d.id} className="grid grid-cols-1 gap-1 px-5 py-4 lg:grid-cols-[5.25fr_0.75fr]">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      {!ticker ? <TickerChip ticker={d.ticker} /> : null}
                      <span className="font-display text-sm font-semibold text-white">{d.headline}</span>
                    </div>
                    <div className="text-xs text-slate-500 lg:text-right">{fmtDate(d.date)}</div>
                  </li>
                );
              }

              return (
                <li
                  key={d.id}
                  className="grid grid-cols-1 gap-1.5 px-5 py-4 lg:grid-cols-[1.7fr_1.2fr_0.6fr_0.85fr_0.9fr_0.75fr] lg:items-center lg:gap-3"
                >
                  {/* Person */}
                  {/* nowrap on desktop: a chip + long name that wraps to a
                      second line pushes this row taller than its neighbours and
                      breaks the alignment the columns exist for. The name
                      truncates instead, with the full text on hover. */}
                  <div className="flex min-w-0 flex-wrap items-center gap-2 lg:flex-nowrap">
                    {!ticker ? <TickerChip ticker={d.ticker} /> : null}
                    <span className="min-w-0 truncate font-display text-sm font-semibold text-white" title={d.person}>
                      {d.person}
                    </span>
                    {d.action ? (
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide lg:hidden ${pill}`}
                      >
                        {d.action}
                      </span>
                    ) : null}
                  </div>

                  {/* Role */}
                  <div className="min-w-0 truncate text-xs text-slate-400" title={d.category}>
                    <span className="text-slate-600 lg:hidden">Role · </span>
                    {d.category || "—"}
                  </div>

                  {/* Side — its own column on desktop; shown beside the name on mobile */}
                  <div className="hidden lg:block">
                    {d.action ? (
                      <span
                        className={`inline-block rounded-full border px-2 py-0.5 text-[0.6rem] font-medium uppercase tracking-wide ${pill}`}
                      >
                        {d.action}
                      </span>
                    ) : (
                      <span className="text-slate-600">—</span>
                    )}
                  </div>

                  {/* Shares */}
                  <div className="text-xs text-slate-300 lg:text-right" title={d.sharesText}>
                    <span className="text-slate-600 lg:hidden">Shares · </span>
                    <span className="font-mono tnum">{sharesNum || "—"}</span>
                  </div>

                  {/* Value */}
                  <div className="text-xs text-slate-300 lg:text-right" title={d.valueText}>
                    <span className="text-slate-600 lg:hidden">Value · </span>
                    <span className="font-mono tnum">{d.valueText || "—"}</span>
                  </div>

                  {/* When */}
                  <div className="text-xs text-slate-500 lg:text-right">{fmtDate(d.date)}</div>
                </li>
              );
            })}
          </ul>
          {!loading && disclosures.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm leading-relaxed text-slate-500">
              {/* Each branch says only what we actually know. Claiming a company
                  filed nothing is a statement about that company, and we are
                  only entitled to make it when the exchange answered us. */}
              {reason === "unconfigured" ? (
                <>
                  Indian insider disclosures aren&apos;t switched on for this deployment.
                  <span className="mt-2 block text-[0.78rem] text-slate-600">
                    SEBI PIT filings are published by NSE and BSE, and both refuse requests
                    from datacenter IPs — so this needs either a data vendor or a residential
                    proxy configured before any company will show them. Nothing is wrong with{" "}
                    {activeTicker}.
                  </span>
                </>
              ) : reason === "blocked" || error ? (
                <>
                  Couldn&apos;t reach {exchange} just now, so we don&apos;t know what{" "}
                  {activeTicker} has filed.
                  <span className="mt-2 block text-[0.78rem] text-slate-600">
                    Indian disclosures are fetched live and the exchange is rate-limiting or
                    refusing the request. This is not a statement that there are none.
                  </span>
                </>
              ) : (
                `No recent insider / SAST disclosures found for ${activeTicker}. This covers NSE/BSE-filed SEBI PIT disclosures; some names or periods simply have none.`
              )}
            </div>
          ) : null}
        </GlassCard>
      ) : (
      <GlassCard className="mt-6 overflow-hidden">
        <div className="hidden grid-cols-[1.3fr_1.1fr_1fr_0.8fr_0.8fr] gap-3 border-b border-white/[0.06] px-5 py-3 text-[0.62rem] uppercase tracking-[0.16em] text-slate-500 lg:grid">
          <span>Company</span>
          <span>Person / role</span>
          <span>Activity</span>
          <span className="text-right">Value</span>
          <span className="text-right">When</span>
        </div>

        <ul className="divide-y divide-white/[0.05]">
          {loading && filtered.length === 0 ? (
            <FilingSkeletonRows rows={limit ?? 5} cols={["1.3fr", "1.1fr", "1fr", "0.8fr", "0.8fr"]} />
          ) : null}
          {filtered.map((r) => (
            <li
              key={r.id}
              className="grid grid-cols-2 gap-3 px-5 py-4 lg:grid-cols-[1.3fr_1.1fr_1fr_0.8fr_0.8fr] lg:items-center"
            >
              <div className="flex items-center gap-2.5">
                <TickerChip ticker={r.ticker} />
                <span className="hidden text-sm text-slate-300 sm:inline">{r.company}</span>
              </div>
              <div className="text-xs text-slate-400">
                <div className="text-slate-200">{r.person}</div>
                <div>{r.role}</div>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <Tag tone={r.acquired ? "up" : "down"}>{r.actionLabel}</Tag>
                {r.planned ? (
                  <span
                    className="rounded-full border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[0.6rem] tracking-wide text-gold"
                    title={r.planDate ? `Rule 10b5-1 plan adopted ${r.planDate}` : "Executed under a Rule 10b5-1 plan"}
                  >
                    10b5-1{r.planDate ? ` · ${r.planDate}` : ""}
                  </span>
                ) : null}
                <p className="mt-1 hidden w-full text-[0.7rem] text-slate-500 lg:block">
                  {r.sharesText !== "—" ? `${r.sharesText} sh` : ""}
                </p>
              </div>
              <div className="text-right font-mono text-sm tnum text-white">{r.valueText}</div>
              <div className="text-right text-xs text-slate-500">{r.dateText}</div>
            </li>
          ))}
        </ul>

        {!loading && filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            {error
              ? "Couldn't reach SEC EDGAR right now — Form 4 data is fetched live and may be rate-limited. Please try again shortly."
              : activeTicker
              ? `No recent insider activity found for ${activeTicker}. This is US-listed Form 4 data — non-US tickers (e.g. .NS) won't appear.`
              : source.length === 0
              ? "No recent insider activity found right now."
              : "No activity matches this filter."}
          </div>
        ) : null}

      </GlassCard>
      )}
    </section>
  );
}
