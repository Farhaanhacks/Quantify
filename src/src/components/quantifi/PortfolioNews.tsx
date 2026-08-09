"use client";

import { useEffect, useState } from "react";
import {
  GlassCard,
  SectionHeading,
  TickerChip,
  Tag,
} from "@/components/quantifi/Cards";
import { usePortfolios } from "@/lib/usePortfolios";
import type { NewsArticle } from "@/lib/news";

type Item = NewsArticle & { holding: string };

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export default function PortfolioNews({ heading = true }: { heading?: boolean }) {
  const { portfolios, ready } = usePortfolios();
  const holdings = ready ? portfolios[0]?.holdings ?? [] : [];
  const tickersKey = holdings.map((h) => h.ticker.toUpperCase()).sort().join(",");

  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>("ALL");

  useEffect(() => {
    if (!tickersKey) {
      setItems([]);
      return;
    }
    const tickers = tickersKey.split(",").filter(Boolean);
    let cancelled = false;
    setLoading(true);
    (async () => {
      const all: Item[] = [];
      await Promise.all(
        tickers.map(async (t) => {
          try {
            const r = await fetch(`/api/news-for?ticker=${encodeURIComponent(t)}`);
            const d = await r.json();
            if (d?.ok && Array.isArray(d.articles)) {
              for (const a of d.articles.slice(0, 6)) all.push({ ...(a as NewsArticle), holding: t });
            }
          } catch {
            /* ignore one holding's failure */
          }
        })
      );
      if (cancelled) return;
      const seen = new Set<string>();
      const deduped = all
        .filter((a) => {
          const k = a.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        })
        .sort((x, y) => y.publishedMs - x.publishedMs)
        .slice(0, 30);
      setItems(deduped);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [tickersKey]);

  const tickers = tickersKey ? tickersKey.split(",").filter(Boolean) : [];
  const shown = filter === "ALL" ? items : items.filter((i) => i.holding === filter);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Portfolio news"
          title="News for your holdings"
          subtitle="Recent headlines for the companies you actually hold — pulled live, not a sample."
        />
      ) : null}

      {holdings.length === 0 ? (
        <GlassCard className="mt-6 p-8 text-center">
          <p className="text-sm text-slate-400">
            Add holdings to your portfolio and their news will show up here.
          </p>
        </GlassCard>
      ) : (
        <>
          {/* filter by holding */}
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilter("ALL")}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                filter === "ALL"
                  ? "border-gold/50 bg-gold/15 text-gold"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
              }`}
            >
              All holdings
            </button>
            {tickers.map((t) => (
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
                {t}
              </button>
            ))}
          </div>

          {loading && items.length === 0 ? (
            <p className="mt-6 text-sm text-slate-500">Loading the latest on your holdings…</p>
          ) : shown.length === 0 ? (
            <GlassCard className="mt-4 p-8 text-center">
              <p className="text-sm text-slate-400">
                No recent news found for {filter === "ALL" ? "your holdings" : filter} right now.
              </p>
            </GlassCard>
          ) : (
            <ul className="mt-4 space-y-3">
              {shown.map((a, i) => (
                <li key={a.link + i}>
                  <a href={a.link} target="_blank" rel="noopener noreferrer" className="block">
                    <GlassCard hover className="p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <TickerChip ticker={a.holding} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug text-slate-100">
                            {a.title}
                          </p>
                          {a.summary ? (
                            <p className="mt-1 line-clamp-2 text-xs text-slate-500">{a.summary}</p>
                          ) : null}
                          <div className="mt-2 flex items-center gap-2 text-[0.7rem] text-slate-500">
                            <span>{a.source}</span>
                            <span>·</span>
                            <span>{timeAgo(a.publishedMs)}</span>
                            {a.region && a.region !== "Global" ? (
                              <>
                                <span>·</span>
                                <Tag tone="neutral">{a.region}</Tag>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  </a>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-600">
            Headlines come from a live news search for each holding&apos;s company name. Quantifi
            doesn&apos;t endorse any source — always read the original.
          </p>
        </>
      )}
    </section>
  );
}
