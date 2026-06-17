"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard, SectionHeading, TickerChip, Tag } from "@/components/quantifi/Cards";
import { ideaCategories, tradingIdeas, type TradingIdea } from "@/data/demo";

export default function TradingIdeas({
  showFilter = true,
  limit,
  heading = true,
}: {
  showFilter?: boolean;
  limit?: number;
  heading?: boolean;
}) {
  const [active, setActive] = useState<string>("All");
  const [selected, setSelected] = useState<TradingIdea | null>(null);

  const filtered = useMemo(() => {
    const list =
      active === "All" ? tradingIdeas : tradingIdeas.filter((i) => i.category === active);
    return limit ? list.slice(0, limit) : list;
  }, [active, limit]);

  // Close the detail modal on Escape.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Trading Ideas"
          title="Ideas worth watching"
          subtitle="Thematic research starting points — tap any idea for the full breakdown. A screen to study, never a recommendation."
          href="/ideas"
          cta="All ideas"
        />
      ) : null}

      {showFilter ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {["All", ...ideaCategories].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setActive(cat)}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                active === cat
                  ? "border-gold/50 bg-gold/15 text-gold"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((idea) => (
          <button
            key={idea.id}
            type="button"
            onClick={() => setSelected(idea)}
            className="text-left"
          >
            <GlassCard hover className="flex h-full flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <Tag tone="teal">{idea.category}</Tag>
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold text-white">{idea.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{idea.tagline}</p>
              <p className="mt-3 text-[0.82rem] leading-relaxed text-slate-400">{idea.description}</p>

              <div className="mt-4 flex flex-wrap gap-1.5">
                {idea.tickers.map((t) => (
                  <TickerChip key={t} ticker={t} />
                ))}
              </div>

              <div className="mt-auto pt-4 text-xs text-gold/80">View full analysis →</div>
            </GlassCard>
          </button>
        ))}
      </div>

      {limit ? (
        <div className="mt-6 text-center">
          <Link
            href="/ideas"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-5 py-2.5 text-sm text-slate-200 transition hover:border-gold/40 hover:text-white"
          >
            Browse all {tradingIdeas.length} ideas
            <span aria-hidden>→</span>
          </Link>
        </div>
      ) : null}

      {/* Detail modal */}
      {selected ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setSelected(null)}
          />
          <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-2xl sm:p-8">
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-md px-2 py-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
            >
              ✕
            </button>

            <Tag tone="teal">{selected.category}</Tag>
            <h3 className="mt-3 font-display text-2xl font-semibold text-white">{selected.title}</h3>
            <p className="mt-1 text-sm text-slate-400">{selected.tagline}</p>

            <div className="mt-6 space-y-5">
              <div>
                <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">The idea</div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{selected.description}</p>
              </div>

              <div>
                <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">What to watch</div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{selected.signal}</p>
              </div>

              <div className="rounded-xl border border-down/20 bg-down/5 p-4">
                <div className="text-[0.62rem] uppercase tracking-[0.16em] text-down/80">Risk lens</div>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{selected.riskLens}</p>
              </div>

              <div>
                <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                  Names in this theme — tap to open full analysis
                </div>
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {selected.tickers.map((t) => (
                    <Link
                      key={t}
                      href={`/stock-analysis?symbol=${t}`}
                      onClick={() => setSelected(null)}
                      className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 font-mono text-sm text-slate-200 transition hover:border-gold/40 hover:text-white"
                    >
                      {t} <span className="text-gold/70">→</span>
                    </Link>
                  ))}
                </div>
              </div>

              <p className="border-t border-white/[0.06] pt-4 text-xs text-slate-500">
                A research starting point, not a recommendation. Always do your own work.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
