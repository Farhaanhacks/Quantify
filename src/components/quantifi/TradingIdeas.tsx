"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard, SectionHeading, TickerChip, Tag } from "@/components/quantifi/Cards";
import { ideaCategories, tradingIdeas } from "@/data/demo";

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

  const filtered = useMemo(() => {
    const list =
      active === "All" ? tradingIdeas : tradingIdeas.filter((i) => i.category === active);
    return limit ? list.slice(0, limit) : list;
  }, [active, limit]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Trading Ideas"
          title="Ideas worth watching"
          subtitle="Thematic research starting points — a screen to study, never a recommendation."
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
          <GlassCard key={idea.id} hover className="flex flex-col p-5">
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

            <div className="mt-4 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                Risk lens
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-400">{idea.riskLens}</p>
            </div>

            <div className="mt-3 flex items-center gap-2 text-xs text-teal">
              <span className="h-1 w-1 rounded-full bg-teal" />
              {idea.signal}
            </div>
          </GlassCard>
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
    </section>
  );
}
