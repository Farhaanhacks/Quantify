"use client";

import { useState } from "react";
import { GlassCard, SectionHeading, TickerChip, Tag } from "@/components/quantifi/Cards";
import { famousTakes } from "@/data/demo";

export default function FamousTakes({ heading = true }: { heading?: boolean }) {
  const [selectedId, setSelectedId] = useState(famousTakes[0].id);
  const selected = famousTakes.find((t) => t.id === selectedId) ?? famousTakes[0];

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Famous Takes"
          title="Market narratives to study"
          subtitle="Well-known investor lenses and market narratives, presented as research framing — not predictions or advice."
          href="/famous-takes"
          cta="All takes"
        />
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        {/* Selector cards */}
        <div className="space-y-3">
          {famousTakes.map((t) => {
            const isActive = t.id === selectedId;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  isActive
                    ? "border-gold/40 bg-gold/[0.06]"
                    : "border-white/[0.08] bg-white/[0.02] hover:border-white/20"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{t.author}</span>
                  <Tag tone="gold">{t.stance}</Tag>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">{t.role}</p>
                <p className="mt-2 text-sm text-teal">{t.lens}</p>
              </button>
            );
          })}
        </div>

        {/* Detail */}
        <GlassCard className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display text-lg font-semibold text-white">{selected.lens}</h3>
              <p className="text-xs text-slate-500">
                {selected.author} · {selected.role}
              </p>
            </div>
            <Tag tone="gold">{selected.stance}</Tag>
          </div>

          <p className="mt-4 text-sm leading-relaxed text-slate-300">{selected.thesis}</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                Affected stocks
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selected.affectedStocks.map((s) => (
                  <TickerChip key={s} ticker={s} />
                ))}
              </div>
            </div>
            <div>
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                Affected ETFs
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {selected.affectedEtfs.map((s) => (
                  <TickerChip key={s} ticker={s} />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-down/20 bg-down/[0.06] p-4">
            <div className="text-[0.62rem] uppercase tracking-[0.16em] text-down/90">Risk</div>
            <p className="mt-1 text-xs leading-relaxed text-slate-300">{selected.risk}</p>
          </div>

          <div className="mt-4">
            <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
              What to monitor
            </div>
            <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
              {selected.monitor.map((m) => (
                <li key={m} className="flex items-start gap-2 text-xs text-slate-400">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-teal" />
                  {m}
                </li>
              ))}
            </ul>
          </div>
        </GlassCard>
      </div>
    </section>
  );
}
