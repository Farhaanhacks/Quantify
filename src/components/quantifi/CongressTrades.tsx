"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard, SectionHeading, TickerChip, Tag } from "@/components/quantifi/Cards";

interface ApiTrade {
  id: string;
  person: string;
  chamber: "Senate" | "House";
  ticker: string;
  asset: string;
  action: "Buy" | "Sell" | "Exchange";
  amount: string;
  owner?: string;
  transactionDate: string;
  disclosureDate?: string;
  link?: string;
}

type Filter = "All" | "Buys" | "Sells" | "Senate" | "House";

function fmtDate(d: string): string {
  const t = Date.parse(d);
  if (isNaN(t)) return d || "—";
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function CongressTrades({ limit, heading = true }: { limit?: number; heading?: boolean }) {
  const [trades, setTrades] = useState<ApiTrade[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    (async () => {
      try {
        const r = await fetch("/api/congress-trades");
        if (!r.ok) throw new Error(String(r.status));
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
  }, []);

  const live = !!trades && trades.length > 0;

  const filtered = useMemo(() => {
    const needle = query.trim().toUpperCase();
    const base = (trades ?? []).filter((t) => {
      if (filter === "Buys") return t.action === "Buy";
      if (filter === "Sells") return t.action === "Sell";
      if (filter === "Senate") return t.chamber === "Senate";
      if (filter === "House") return t.chamber === "House";
      return true;
    });
    const q = needle
      ? base.filter((t) => t.ticker.includes(needle) || t.person.toUpperCase().includes(needle))
      : base;
    return limit ? q.slice(0, limit) : q;
  }, [trades, filter, query, limit]);

  const filters: Filter[] = ["All", "Buys", "Sells", "Senate", "House"];

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Congressional Trades"
          title="What U.S. politicians are trading"
          subtitle="Stock transactions disclosed by members of the U.S. House and Senate under the STOCK Act. Disclosed weeks after the fact and shown for research context — never a signal on its own."
        />
      ) : null}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full border px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.12em] ${
            live ? "border-up/30 bg-up/10 text-up" : "border-white/10 bg-white/[0.03] text-slate-500"
          }`}
        >
          {loading ? "Loading…" : live ? "Live · House & Senate disclosures" : error ? "Unavailable" : "No filings"}
        </span>
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              filter === f
                ? "border-gold/50 bg-gold/15 text-gold"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
            }`}
          >
            {f}
          </button>
        ))}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter by ticker or name…"
          className="ml-auto w-full max-w-xs rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
        />
      </div>

      <GlassCard className="mt-6 overflow-hidden">
        <div className="hidden grid-cols-[1.2fr_1.3fr_0.8fr_0.9fr_0.8fr] gap-3 border-b border-white/[0.06] px-5 py-3 text-[0.62rem] uppercase tracking-[0.16em] text-slate-500 lg:grid">
          <span>Politician</span>
          <span>Company</span>
          <span>Action</span>
          <span>Amount</span>
          <span className="text-right">Traded</span>
        </div>

        <ul className="divide-y divide-white/[0.05]">
          {filtered.map((t) => (
            <li key={t.id} className="grid grid-cols-2 gap-3 px-5 py-4 lg:grid-cols-[1.2fr_1.3fr_0.8fr_0.9fr_0.8fr] lg:items-center">
              <div className="text-xs">
                <div className="text-slate-200">{t.person}</div>
                <div className="text-slate-500">
                  {t.chamber}
                  {t.owner && t.owner !== "Self" ? ` · ${t.owner}` : ""}
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Link href={`/stock-analysis?symbol=${encodeURIComponent(t.ticker)}`} onClick={(e) => e.stopPropagation()}>
                  <TickerChip ticker={t.ticker} />
                </Link>
                <span className="hidden truncate text-xs text-slate-400 sm:inline">{t.asset}</span>
              </div>
              <div>
                <Tag tone={t.action === "Buy" ? "up" : t.action === "Sell" ? "down" : "neutral"}>{t.action}</Tag>
              </div>
              <div className="font-mono text-xs tnum text-slate-300">{t.amount}</div>
              <div className="text-right text-xs text-slate-500">
                {t.link ? (
                  <a href={t.link} target="_blank" rel="noopener noreferrer" className="hover:text-gold">
                    {fmtDate(t.transactionDate)} ↗
                  </a>
                ) : (
                  fmtDate(t.transactionDate)
                )}
              </div>
            </li>
          ))}
        </ul>

        {!loading && filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            {error
              ? "Couldn't reach the congressional-disclosure data right now — it's fetched live from public House/Senate filings and may be temporarily unavailable. Please try again shortly."
              : query || filter !== "All"
              ? "No trades match this filter."
              : "No recent congressional trades found right now."}
          </div>
        ) : null}

        {loading && filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">Loading congressional filings…</div>
        ) : null}
      </GlassCard>

      <p className="mt-3 text-xs leading-relaxed text-slate-600">
        Source: public U.S. House &amp; Senate financial-disclosure filings (STOCK Act). Amounts are
        disclosed as ranges, and filings appear weeks after the trade. For research and education only —
        not investment advice, and not a signal to follow any individual&apos;s trades.
      </p>
    </section>
  );
}
