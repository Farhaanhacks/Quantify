"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  GlassCard,
  SectionHeading,
  TickerChip,
  Tag,
} from "@/components/quantifi/Cards";
import type { NewsArticle } from "@/lib/news";
import { analyzeNews, type AffectedName, type Level, type Tone } from "@/lib/newsImpact";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

const toneTag = (tone: Tone) => (tone === "positive" ? "up" : tone === "negative" ? "down" : "teal");
const LEVEL_TONE: Record<Level, "up" | "gold" | "down"> = { High: "up", Medium: "gold", Low: "down" };

function AffectedCard({ a }: { a: AffectedName }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="flex items-center gap-2">
        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-sm text-white">{a.ticker}</span>
        {a.primary ? <Tag tone="gold">Primary</Tag> : <span className="text-[0.65rem] text-slate-500">Read-through</span>}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-300">{a.role}</p>
      <p className="mt-1 text-xs leading-relaxed text-slate-400">
        <span className="text-slate-500">Why: </span>{a.why}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem]">
        <span className={a.impact === "High" ? "text-up" : a.impact === "Medium" ? "text-gold" : "text-slate-400"}>
          Impact: {a.impact}
        </span>
        <span className="text-slate-400">Confidence: {a.confidence}</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
        <span className="text-slate-500">Watch: </span>{a.watch}
      </p>
      <Link
        href={`/stock-analysis?symbol=${encodeURIComponent(a.ticker)}`}
        className="mt-2 inline-block text-[0.7rem] text-gold underline-offset-2 hover:underline"
      >
        Open analysis →
      </Link>
    </div>
  );
}

export default function NewsImpact({
  items,
  limit,
  heading = true,
}: {
  items: NewsArticle[];
  limit?: number;
  heading?: boolean;
}) {
  const list = (limit ? items.slice(0, limit) : items).filter((a) => a && a.title);
  const [selectedLink, setSelectedLink] = useState<string>(list[0]?.link ?? "");
  const selected = list.find((n) => n.link === selectedLink) ?? list[0];

  const detail = useMemo(
    () =>
      selected
        ? analyzeNews({ title: selected.title, summary: selected.summary, tickers: selected.tickers ?? [] })
        : null,
    [selected]
  );

  if (list.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        {heading ? (
          <SectionHeading
            eyebrow="News Impact"
            title="One headline → the market impact map"
            href="/news"
            cta="All news"
          />
        ) : null}
        <GlassCard className="mt-6 p-10 text-center text-sm text-slate-400">
          Live news is unavailable right now — the feed refreshes automatically, so check back shortly.
        </GlassCard>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="News Impact"
          title="One headline → the market impact map"
          subtitle="Live market news, not a summary. Each story is traced into what changed, why it matters, the chain of names affected, linked research themes and what to watch — so you can tell signal from noise."
          href="/news"
          cta="All news"
        />
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Live headline list */}
        <div className="space-y-3">
          {list.map((n) => {
            const isActive = n.link === selectedLink;
            const a = analyzeNews({ title: n.title, summary: n.summary, tickers: n.tickers ?? [] });
            return (
              <button
                key={n.link}
                type="button"
                onClick={() => setSelectedLink(n.link)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  isActive
                    ? "border-gold/40 bg-gold/[0.06]"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-2 text-[0.7rem] text-slate-500">
                  <span className="truncate text-teal">{n.source}</span>
                  <span>·</span>
                  <span>{timeAgo(n.publishedMs)}</span>
                  <span className="ml-auto">
                    <Tag tone={toneTag(a.tone)}>{a.tone}</Tag>
                  </span>
                </div>
                <h3 className="mt-2 line-clamp-2 text-sm font-medium text-white">{n.title}</h3>
                <div className="mt-2 flex items-center gap-1.5">
                  <Tag tone={LEVEL_TONE[a.impact]}>{a.impact} impact</Tag>
                  <span className="text-[0.65rem] text-slate-500">{a.confidence}% confidence</span>
                  <span className="ml-auto flex gap-1.5">
                    {(n.tickers ?? []).slice(0, 2).map((t) => (
                      <TickerChip key={t} ticker={t} />
                    ))}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Impact map detail */}
        {selected && detail ? (
          <GlassCard className="p-5 sm:p-6">
            <h3 className="font-display text-lg font-semibold leading-snug text-white">{selected.title}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Tag tone="neutral">{selected.source}</Tag>
              <span className="text-[0.65rem] text-slate-500">{timeAgo(selected.publishedMs)}</span>
              <Tag tone="neutral">{selected.region}</Tag>
              <Tag tone={toneTag(detail.tone)}>{detail.tone} tone</Tag>
              <Tag tone={LEVEL_TONE[detail.impact]}>{detail.impact} impact</Tag>
              <Tag tone="teal">{detail.confidence}% confidence</Tag>
            </div>

            {/* What changed */}
            <div className="mt-5">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">What changed</div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{detail.whatChanged}</p>
              {selected.summary ? (
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{selected.summary}</p>
              ) : null}
            </div>

            {/* Why it matters */}
            <div className="mt-4 rounded-xl border border-gold/20 bg-gold/[0.06] p-4">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-gold/80">Why it matters</div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{detail.whyItMatters}</p>
            </div>

            {/* Impact map */}
            <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="mb-3 text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Impact map</div>
              <ol className="space-y-0">
                {detail.impactMap.map((s, i) => (
                  <li key={s} className="relative pl-7">
                    <span className="absolute left-0 top-0.5 grid h-5 w-5 place-items-center rounded-full border border-gold/30 bg-gold/10 text-[0.6rem] font-semibold text-gold">
                      {i + 1}
                    </span>
                    {i < detail.impactMap.length - 1 ? (
                      <span className="absolute left-[9px] top-6 h-[calc(100%-1.25rem)] w-px bg-gradient-to-b from-gold/40 to-transparent" />
                    ) : null}
                    <p className={`pb-4 text-sm leading-snug ${i === detail.impactMap.length - 1 ? "text-white" : "text-slate-300"}`}>
                      {s}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            {/* Names affected */}
            {detail.affected.length ? (
              <div className="mt-5">
                <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Names affected</div>
                <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                  {detail.affected.map((a) => (
                    <AffectedCard key={a.ticker} a={a} />
                  ))}
                </div>
              </div>
            ) : null}

            {/* Linked themes */}
            {detail.themes.length ? (
              <div className="mt-5">
                <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Linked Quantifi themes</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detail.themes.map((t) => (
                    <Link
                      key={t.id}
                      href={`/ideas?theme=${encodeURIComponent(t.id)}`}
                      className="inline-flex items-center rounded-full border border-gold/25 bg-gold/[0.06] px-3 py-1 text-xs text-gold transition hover:border-gold/50"
                    >
                      {t.label} →
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {/* What to watch */}
            <div className="mt-5">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">What to watch next</div>
              <ul className="mt-2 space-y-1.5">
                {detail.watchNext.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-xs text-slate-400">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>

            {/* Signal classification */}
            <div className="mt-5 grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:grid-cols-3">
              <div>
                <div className="text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">Signal type</div>
                <div className="mt-1 text-xs font-medium text-slate-200">{detail.signalType}</div>
              </div>
              <div>
                <div className="text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">Thesis relevance</div>
                <div className="mt-1 text-xs font-medium text-slate-200">{detail.thesisRelevance}</div>
              </div>
              <div>
                <div className="text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">Time horizon</div>
                <div className="mt-1 text-xs font-medium text-slate-200">{detail.timeHorizon}</div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-4">
              <a
                href={selected.link}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90"
              >
                Read full article ↗
              </a>
              <p className="text-xs text-slate-500">
                Auto-generated impact map from a live article. Research starting point, not a recommendation.
              </p>
            </div>
          </GlassCard>
        ) : null}
      </div>
    </section>
  );
}
