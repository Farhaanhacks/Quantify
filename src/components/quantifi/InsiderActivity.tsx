"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassCard, SectionHeading, TickerChip, Tag } from "@/components/quantifi/Cards";
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

type Filter = "All" | "Buys" | "Sells" | "Planned";

function fmtDate(d: string): string {
  const t = Date.parse(d);
  if (isNaN(t)) return d;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
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
    const url = activeTicker
      ? `/api/insider/${encodeURIComponent(activeTicker)}`
      : "/api/insider-feed";
    (async () => {
      try {
        const r = await fetch(url);
        if (!r.ok) throw new Error(`status ${r.status}`);
        const d = (await r.json()) as { available?: boolean; trades?: ApiTrade[] };
        if (cancelled) return;
        setTrades(d.available && Array.isArray(d.trades) ? d.trades : []);
      } catch {
        if (!cancelled) {
          setTrades([]);
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

  const filters: Filter[] = ["All", "Buys", "Sells", "Planned"];

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Insider Activity"
          title={activeTicker ? `Insider trades · ${activeTicker}` : "Who is buying and selling"}
          subtitle="Real Form 4 filings from SEC EDGAR — directors and officers, with a 10b5-1 flag when the trade was pre-arranged. Disclosed after the fact; never a signal on its own."
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

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.12em] ${
            live
              ? "border-up/30 bg-up/10 text-up"
              : "border-white/10 bg-white/[0.03] text-slate-500"
          }`}
        >
          {loading ? "Loading…" : live ? "Live · SEC EDGAR" : error ? "Unavailable" : "No filings"}
        </span>
        {showFilter
          ? filters.map((t) => (
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
            ))
          : null}
      </div>

      <GlassCard className="mt-6 overflow-hidden">
        <div className="hidden grid-cols-[1.3fr_1.1fr_1fr_0.8fr_0.8fr] gap-3 border-b border-white/[0.06] px-5 py-3 text-[0.62rem] uppercase tracking-[0.16em] text-slate-500 lg:grid">
          <span>Company</span>
          <span>Person / role</span>
          <span>Activity</span>
          <span className="text-right">Value</span>
          <span className="text-right">When</span>
        </div>

        <ul className="divide-y divide-white/[0.05]">
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

        {loading && filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">Loading insider filings…</div>
        ) : null}
      </GlassCard>
    </section>
  );
}
