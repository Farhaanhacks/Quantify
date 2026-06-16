"use client";

import { useState } from "react";
import {
  GlassCard,
  SectionHeading,
  TickerChip,
  Tag,
  ImpactChain,
} from "@/components/quantifi/Cards";
import { news, type AffectedStock, type NewsItem } from "@/data/demo";

function sentimentTone(s: NewsItem["sentiment"]) {
  return s === "positive" ? "up" : s === "negative" ? "down" : "gold";
}

function AffectedRow({ list, label }: { list: AffectedStock[]; label: string }) {
  if (list.length === 0) {
    return (
      <div>
        <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">{label}</div>
        <p className="mt-1 text-xs text-slate-600">No direct read-through in this demo item.</p>
      </div>
    );
  }
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
          title="What the news means for stocks"
          subtitle="Select a headline to trace the affected names, peers, sector and ETFs — plus what to watch next."
          href="/news"
          cta="All news"
        />
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
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
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {n.direct.slice(0, 3).map((d) => (
                    <TickerChip key={d.ticker} ticker={d.ticker} />
                  ))}
                </div>
              </button>
            );
          })}
        </div>

        {/* Impact detail */}
        {selected ? (
          <GlassCard className="p-5 sm:p-6">
            <div className="flex items-center gap-2 text-[0.7rem] text-slate-500">
              <span>{selected.source}</span>
              <span>·</span>
              <span>{selected.time}</span>
              <span className="ml-auto">
                <Tag tone="neutral">{selected.region}</Tag>
              </span>
            </div>
            <h3 className="mt-2 font-display text-lg font-semibold text-white">
              {selected.headline}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">{selected.summary}</p>

            <div className="mt-5">
              <div className="mb-2 text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                Impact chain
              </div>
              <ImpactChain
                steps={[
                  { label: "Direct", value: selected.direct[0]?.ticker ?? "—", tone: "up" },
                  { label: "Peer", value: selected.peers[0]?.ticker ?? "—", tone: "teal" },
                  { label: "Sector", value: selected.sector.name, tone: "gold" },
                  { label: "ETF", value: selected.etfs[0]?.ticker ?? "—", tone: "teal" },
                ]}
              />
            </div>

            <div className="mt-5 grid gap-5 border-t border-white/[0.06] pt-5 sm:grid-cols-2">
              <AffectedRow list={selected.direct} label="Direct impact" />
              <AffectedRow list={selected.peers} label="Peer impact" />
              <div>
                <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                  Sector impact
                </div>
                <p className="mt-1 text-sm font-medium text-teal">{selected.sector.name}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{selected.sector.note}</p>
              </div>
              <AffectedRow list={selected.etfs} label="ETF / index impact" />
            </div>

            <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                Why affected
              </div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">{selected.whyAffected}</p>
            </div>

            <div className="mt-4">
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
          </GlassCard>
        ) : null}
      </div>
    </section>
  );
}
