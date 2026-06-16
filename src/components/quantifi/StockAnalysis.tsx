"use client";

import { useMemo, useState } from "react";
import {
  GlassCard,
  SectionHeading,
  ChangePill,
  TickerChip,
  Tag,
  StatTile,
} from "@/components/quantifi/Cards";
import {
  stockAnalysis,
  news,
  insiderEvents,
  fmtPrice,
  type InsiderType,
} from "@/data/demo";

const TABS = [
  "Overview",
  "Valuation",
  "News",
  "Insider Activity",
  "Risks",
  "What to Watch",
] as const;

type Tab = (typeof TABS)[number];

function insiderTone(t: InsiderType): "up" | "down" | "gold" | "teal" | "neutral" {
  if (t === "Insider Buying" || t === "Pledge Released") return "up";
  if (t === "Insider Selling" || t === "Repeated Selling" || t === "Pledge Created")
    return "down";
  if (t === "Unusual Activity" || t === "Large Transaction") return "gold";
  return "teal";
}

export default function StockAnalysis({ heading = true }: { heading?: boolean }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const s = stockAnalysis;

  const linkedNews = useMemo(
    () => news.filter((n) => s.newsIds.includes(n.id)),
    [s.newsIds]
  );
  const linkedInsiders = useMemo(
    () => insiderEvents.filter((e) => s.insiderIds.includes(e.id)),
    [s.insiderIds]
  );

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Stock Analysis"
          title="One name, every lens"
          subtitle="A single stock connected to news, insiders, valuation context and risk framing. Educational research view — not advice."
        />
      ) : null}

      {/* Stock header */}
      <GlassCard className="mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <TickerChip ticker={s.ticker} active />
              <span className="text-xs text-slate-500">{s.exchange}</span>
              <Tag tone="teal">{s.sector}</Tag>
            </div>
            <h3 className="mt-3 font-display text-2xl font-semibold text-white">
              {s.name}
            </h3>
          </div>
          <div className="text-right">
            <div className="flex items-center justify-end gap-2">
              <span className="font-mono text-2xl font-semibold tnum text-white">
                ${fmtPrice(s.price)}
              </span>
              <ChangePill value={s.changePct} />
            </div>
            <div className="mt-1 text-xs text-slate-500">
              Market cap {s.marketCap} · demo data
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {s.highlights.map((h) => (
            <StatTile key={h.label} label={h.label} value={h.value} />
          ))}
        </div>
      </GlassCard>

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full border px-4 py-1.5 text-sm transition ${
              tab === t
                ? "border-gold/50 bg-gold/15 text-gold"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "Overview" ? (
          <GlassCard className="p-5 sm:p-6">
            <h4 className="font-display text-lg font-semibold text-white">Overview</h4>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{s.overview}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {s.highlights.map((h) => (
                <div
                  key={h.label}
                  className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
                >
                  <span className="text-xs uppercase tracking-[0.14em] text-slate-500">
                    {h.label}
                  </span>
                  <span className="text-sm font-medium text-slate-200">{h.value}</span>
                </div>
              ))}
            </div>
          </GlassCard>
        ) : null}

        {tab === "Valuation" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {s.valuation.map((m) => (
              <GlassCard key={m.label} className="p-5">
                <div className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
                  {m.label}
                </div>
                <div className="mt-2 font-display text-2xl font-semibold tnum text-white">
                  {m.value}
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-400">{m.context}</p>
              </GlassCard>
            ))}
          </div>
        ) : null}

        {tab === "News" ? (
          <div className="space-y-3">
            {linkedNews.map((n) => (
              <GlassCard key={n.id} className="p-5">
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Tag
                    tone={
                      n.sentiment === "positive"
                        ? "up"
                        : n.sentiment === "negative"
                        ? "down"
                        : "gold"
                    }
                  >
                    {n.sentiment}
                  </Tag>
                  <span>{n.source}</span>
                  <span aria-hidden>·</span>
                  <span>{n.time}</span>
                </div>
                <h4 className="mt-2 text-sm font-medium leading-snug text-white">
                  {n.headline}
                </h4>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">{n.summary}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {n.direct.map((d) => (
                    <TickerChip key={d.ticker} ticker={d.ticker} />
                  ))}
                </div>
              </GlassCard>
            ))}
            {linkedNews.length === 0 ? (
              <p className="px-1 text-sm text-slate-500">
                No linked news in the demo set for this name.
              </p>
            ) : null}
          </div>
        ) : null}

        {tab === "Insider Activity" ? (
          <GlassCard className="overflow-hidden">
            <ul className="divide-y divide-white/[0.05]">
              {linkedInsiders.map((e) => (
                <li
                  key={e.id}
                  className="grid grid-cols-2 gap-3 px-5 py-4 lg:grid-cols-[1.4fr_1fr_1.2fr_0.8fr_0.8fr] lg:items-center"
                >
                  <div className="flex items-center gap-2.5">
                    <TickerChip ticker={e.ticker} />
                    <span className="hidden text-sm text-slate-300 sm:inline">
                      {e.company}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400">
                    <div className="text-slate-200">{e.person}</div>
                    <div>{e.role}</div>
                  </div>
                  <div>
                    <Tag tone={insiderTone(e.type)}>{e.type}</Tag>
                    <p className="mt-1 hidden text-[0.7rem] text-slate-500 lg:block">
                      {e.note}
                    </p>
                  </div>
                  <div className="text-right font-mono text-sm tnum text-white">
                    {e.value}
                  </div>
                  <div className="text-right text-xs text-slate-500">{e.date}</div>
                </li>
              ))}
            </ul>
            {linkedInsiders.length === 0 ? (
              <div className="px-5 py-10 text-center text-sm text-slate-500">
                No linked insider activity in the demo set for this name.
              </div>
            ) : null}
          </GlassCard>
        ) : null}

        {tab === "Risks" ? (
          <GlassCard className="p-5 sm:p-6">
            <h4 className="font-display text-lg font-semibold text-white">Risk lens</h4>
            <p className="mt-1 text-xs text-slate-500">
              Framing to research further — not a prediction.
            </p>
            <ul className="mt-4 space-y-3">
              {s.risks.map((r, i) => (
                <li key={i} className="flex gap-3 text-sm text-slate-300">
                  <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-down/10 text-[0.7rem] text-down">
                    !
                  </span>
                  <span className="leading-relaxed">{r}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        ) : null}

        {tab === "What to Watch" ? (
          <GlassCard className="p-5 sm:p-6">
            <h4 className="font-display text-lg font-semibold text-white">
              What to watch next
            </h4>
            <p className="mt-1 text-xs text-slate-500">
              Signposts to monitor as the story develops.
            </p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {s.whatToWatch.map((w, i) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-slate-300"
                >
                  <span className="mt-0.5 inline-flex h-5 w-5 flex-none items-center justify-center rounded-full bg-teal/10 text-[0.7rem] text-teal">
                    ◎
                  </span>
                  <span className="leading-relaxed">{w}</span>
                </li>
              ))}
            </ul>
          </GlassCard>
        ) : null}
      </div>
    </section>
  );
}
