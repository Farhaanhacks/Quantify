"use client";

import Link from "next/link";
import { useState } from "react";
import {
  GlassCard,
  SectionHeading,
  TickerChip,
  Tag,
} from "@/components/quantifi/Cards";
import {
  news,
  type AffectedStock,
  type ImpactLevel,
  type NewsItem,
} from "@/data/demo";

function sentimentTone(s: NewsItem["sentiment"]) {
  return s === "positive" ? "up" : s === "negative" ? "down" : "gold";
}

function impactTone(level: ImpactLevel): "up" | "gold" | "down" {
  return level === "High" ? "up" : level === "Medium" ? "gold" : "down";
}

// A compact label for the strength of a single read-through.
function ImpactBadge({ level }: { level?: ImpactLevel }) {
  if (!level) return null;
  const cls =
    level === "High"
      ? "text-up"
      : level === "Medium"
      ? "text-gold"
      : "text-slate-400";
  return <span className={`text-[0.65rem] font-medium ${cls}`}>{level} impact</span>;
}

// A name card: ticker, role, why, the metric to watch, and impact strength.
function AffectedCard({ a }: { a: AffectedStock }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="flex items-center gap-2">
        <TickerChip ticker={a.ticker} />
        {a.role ? <span className="text-xs text-slate-300">{a.role}</span> : null}
        <span className="ml-auto">
          <ImpactBadge level={a.impact} />
        </span>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">
        <span className="text-slate-500">Why: </span>
        {a.note}
      </p>
      {a.watch ? (
        <p className="mt-1 text-xs leading-relaxed text-slate-400">
          <span className="text-slate-500">Watch: </span>
          {a.watch}
        </p>
      ) : null}
      <Link
        href={`/stock-analysis?symbol=${encodeURIComponent(a.ticker)}`}
        className="mt-2 inline-block text-[0.7rem] text-gold underline-offset-2 hover:underline"
      >
        Open stock analysis →
      </Link>
    </div>
  );
}

function SimpleAffectedRow({ list, label }: { list: AffectedStock[]; label: string }) {
  if (list.length === 0) return null;
  return (
    <div>
      <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <ul className="mt-2 space-y-2">
        {list.map((a) => (
          <li key={a.ticker + a.note} className="flex items-start gap-2.5">
            <TickerChip ticker={a.ticker} />
            <span
              className={`mt-0.5 text-xs ${
                a.dir === "up" ? "text-up" : a.dir === "down" ? "text-down" : "text-slate-500"
              }`}
            >
              {a.dir === "up" ? "▲" : a.dir === "down" ? "▼" : "•"}
            </span>
            <span className="text-xs leading-relaxed text-slate-400">{a.note}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Vertical causal chain — the heart of the "impact map".
function ImpactMap({ steps }: { steps: string[] }) {
  return (
    <ol className="space-y-0">
      {steps.map((s, i) => (
        <li key={s} className="relative pl-7">
          <span className="absolute left-0 top-0.5 grid h-5 w-5 place-items-center rounded-full border border-gold/30 bg-gold/10 text-[0.6rem] font-semibold text-gold">
            {i + 1}
          </span>
          {i < steps.length - 1 ? (
            <span className="absolute left-[9px] top-6 h-[calc(100%-1.25rem)] w-px bg-gradient-to-b from-gold/40 to-transparent" />
          ) : null}
          <p className={`pb-4 text-sm leading-snug ${i === steps.length - 1 ? "text-white" : "text-slate-300"}`}>
            {s}
          </p>
        </li>
      ))}
    </ol>
  );
}

export default function NewsImpact({
  limit,
  heading = true,
}: {
  limit?: number;
  heading?: boolean;
}) {
  const items = limit ? news.slice(0, limit) : news;
  const [selectedId, setSelectedId] = useState<string>(items[0]?.id ?? "");
  const selected = news.find((n) => n.id === selectedId) ?? items[0];

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="News Impact"
          title="One headline → the market impact map"
          subtitle="Not a news summary. Each story is traced into what changed, why it matters, the chain of names affected, linked research themes and what to watch — so you can tell signal from noise."
          href="/news"
          cta="All news"
        />
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        {/* News list */}
        <div className="space-y-3">
          {items.map((n) => {
            const isActive = n.id === selectedId;
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => setSelectedId(n.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  isActive
                    ? "border-gold/40 bg-gold/[0.06]"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <div className="flex items-center gap-2 text-[0.7rem] text-slate-500">
                  <span>{n.source}</span>
                  <span>·</span>
                  <span>{n.time}</span>
                  <span className="ml-auto">
                    <Tag tone={sentimentTone(n.sentiment)}>{n.sentiment}</Tag>
                  </span>
                </div>
                <h3 className="mt-2 text-sm font-medium text-white">{n.headline}</h3>
                <div className="mt-2 flex items-center gap-1.5">
                  <Tag tone={impactTone(n.impact)}>{n.impact} impact</Tag>
                  <span className="text-[0.65rem] text-slate-500">{n.confidence}% confidence</span>
                  <span className="ml-auto flex gap-1.5">
                    {n.direct.slice(0, 2).map((d) => (
                      <TickerChip key={d.ticker} ticker={d.ticker} />
                    ))}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Impact detail */}
        {selected ? (
          <GlassCard className="p-5 sm:p-6">
            {/* Header + badges */}
            <h3 className="font-display text-lg font-semibold leading-snug text-white">
              {selected.headline}
            </h3>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Tag tone="neutral">{selected.source}</Tag>
              <span className="text-[0.65rem] text-slate-500">{selected.time}</span>
              <Tag tone="neutral">{selected.region}</Tag>
              <Tag tone={sentimentTone(selected.sentiment)}>{selected.sentiment}</Tag>
              <Tag tone={impactTone(selected.impact)}>{selected.impact} impact</Tag>
              <Tag tone="teal">{selected.confidence}% confidence</Tag>
            </div>

            {/* What changed */}
            <div className="mt-5">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                What changed
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{selected.whatChanged}</p>
            </div>

            {/* Why it matters */}
            <div className="mt-4">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                Why it matters
              </div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-400">{selected.whyAffected}</p>
            </div>

            {/* Impact map */}
            <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="mb-3 text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                Impact map
              </div>
              <ImpactMap steps={selected.impactMap} />
            </div>

            {/* Affected names with role + impact */}
            <div className="mt-5">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                Names affected
              </div>
              <div className="mt-2 grid gap-2.5 sm:grid-cols-2">
                {[...selected.direct, ...selected.peers].map((a) => (
                  <AffectedCard key={a.ticker + a.note} a={a} />
                ))}
              </div>
            </div>

            {/* Sector + ETF read-through */}
            <div className="mt-5 grid gap-5 border-t border-white/[0.06] pt-5 sm:grid-cols-2">
              <div>
                <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                  Sector impact
                </div>
                <p className="mt-1 text-sm font-medium text-teal">{selected.sector.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{selected.sector.note}</p>
              </div>
              <SimpleAffectedRow list={selected.etfs} label="ETF / index impact" />
            </div>

            {/* Linked themes */}
            {selected.linkedThemes.length > 0 ? (
              <div className="mt-5">
                <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                  Linked Quantifi themes
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.linkedThemes.map((t) => (
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

            {/* What to watch next */}
            <div className="mt-5">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                What to watch next
              </div>
              <ul className="mt-2 space-y-1.5">
                {selected.whatToWatch.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-xs text-slate-400">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>

            {/* Signal vs noise */}
            <div className="mt-5 grid gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:grid-cols-3">
              <div>
                <div className="text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">Signal type</div>
                <div className="mt-1 text-xs font-medium text-slate-200">{selected.signalType}</div>
              </div>
              <div>
                <div className="text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">Thesis relevance</div>
                <div className="mt-1 text-xs font-medium text-slate-200">{selected.thesisRelevance}</div>
              </div>
              <div>
                <div className="text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">Time horizon</div>
                <div className="mt-1 text-xs font-medium text-slate-200">{selected.timeHorizon}</div>
              </div>
            </div>

            <p className="mt-4 text-[0.7rem] leading-relaxed text-slate-600">
              Auto-detected impact map — a research starting point, not a recommendation. Confidence
              reflects how cleanly the headline reads through to the named exposures, not a probability
              of any price move.
            </p>
          </GlassCard>
        ) : null}
      </div>
    </section>
  );
}
