"use client";

import { useMemo, useState } from "react";
import { GlassCard, SectionHeading, Tag } from "@/components/quantifi/Cards";
import type { NewsArticle } from "@/lib/news";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

const REGIONS = ["All", "US", "India", "Global"] as const;

export default function NewsFeed({ items }: { items: NewsArticle[] }) {
  const [region, setRegion] = useState<(typeof REGIONS)[number]>("All");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((a) => {
      if (region !== "All" && a.region !== region) return false;
      if (needle && !`${a.title} ${a.source}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [items, region, q]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="News Impact"
        title="Live market news"
        subtitle="A continuously updating feed of market headlines from multiple sources. Refreshes on its own — no two visits look the same."
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRegion(r)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              region === r
                ? "border-gold/50 bg-gold/15 text-gold"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
            }`}
          >
            {r}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search headlines…"
          className="ml-auto w-full max-w-xs rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
        />
      </div>

      <p className="mt-3 text-xs text-slate-500">
        {filtered.length} stories
        {items.length ? "" : " — feed is momentarily unavailable, please refresh"}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a, i) => (
          <a
            key={`${a.link}-${i}`}
            href={a.link}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            <GlassCard hover className="flex h-full flex-col p-4">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-teal">{a.source}</span>
                <Tag tone={a.region === "India" ? "gold" : "teal"}>{a.region}</Tag>
              </div>
              <h3 className="mt-2 line-clamp-3 font-display text-[0.95rem] font-semibold leading-snug text-white">
                {a.title}
              </h3>
              {a.summary ? (
                <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-400">{a.summary}</p>
              ) : null}
              <div className="mt-auto pt-3 text-[0.7rem] text-slate-500">{timeAgo(a.publishedMs)}</div>
            </GlassCard>
          </a>
        ))}
      </div>

      {filtered.length === 0 ? (
        <GlassCard className="mt-4 p-10 text-center">
          <p className="text-sm text-slate-400">
            {items.length === 0
              ? "Couldn't reach the news feeds right now — they refresh automatically, so try again shortly."
              : "No stories match that filter."}
          </p>
        </GlassCard>
      ) : null}
    </section>
  );
}
