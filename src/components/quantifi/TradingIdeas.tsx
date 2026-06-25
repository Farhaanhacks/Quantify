"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard, SectionHeading, Tag } from "@/components/quantifi/Cards";
import { ideaCategories, tradingIdeas, type TradingIdea } from "@/data/demo";
import { useProStatus } from "@/lib/useProStatus";

// Free users get the first row (3 ideas); the rest are Quantifi Pro.
const FREE_IDEA_COUNT = 3;
const FREE_IDS = new Set(tradingIdeas.slice(0, FREE_IDEA_COUNT).map((i) => i.id));

function scoreColor(score: number): string {
  if (score >= 7) return "#34D399";
  if (score >= 4) return "#E9B872";
  return "#FB7185";
}

function MetaChips({ idea }: { idea: TradingIdea }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5 text-[0.65rem]">
      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">
        ⏱ {idea.timeHorizon}
      </span>
      <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">
        {idea.maturity}
      </span>
      <span className="rounded-full border border-down/25 bg-down/10 px-2 py-0.5 text-down/90">
        Valuation risk: {idea.valuationRisk}
      </span>
    </div>
  );
}

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
  const { pro, ready } = useProStatus();

  const filtered = useMemo(() => {
    const list =
      active === "All" ? tradingIdeas : tradingIdeas.filter((i) => i.category === active);
    return limit ? list.slice(0, limit) : list;
  }, [active, limit]);

  // A theme is locked for non-Pro users unless it's one of the free three.
  const isLocked = (idea: TradingIdea) => ready && !pro && !FREE_IDS.has(idea.id);

  // Close the detail modal on Escape + lock background scroll.
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [selected]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Ideas worth watching"
          title="Global research themes"
          subtitle="Thematic research across the US, China and India — built for study, not recommendations. Tap any theme for the full breakdown."
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
        {filtered.map((idea) => {
          const locked = isLocked(idea);
          return (
            <div key={idea.id} className="relative">
              <button
                type="button"
                onClick={() => (locked ? null : setSelected(idea))}
                className="w-full text-left"
                aria-disabled={locked}
              >
                <GlassCard
                  hover={!locked}
                  className={`flex h-full flex-col p-5 ${locked ? "opacity-95" : ""}`}
                >
                  <div className={locked ? "select-none blur-[3px]" : ""}>
                    <div className="flex items-start justify-between gap-2">
                      <Tag tone="teal">{idea.category}</Tag>
                      <span className="text-right text-[0.62rem] text-slate-500">
                        {idea.regions.join(" · ")}
                      </span>
                    </div>
                    <h3 className="mt-3 font-display text-lg font-semibold leading-snug text-white">
                      {idea.title}
                    </h3>
                    <p className="mt-1 text-sm text-slate-400">{idea.tagline}</p>

                    <MetaChips idea={idea} />

                    <div className="mt-4 space-y-1.5 text-xs leading-relaxed">
                      <p className="text-slate-300">
                        <span className="text-up">▲ Bull</span> {idea.bullCase}
                      </p>
                      <p className="text-slate-300">
                        <span className="text-down">▼ Bear</span> {idea.bearCase}
                      </p>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {idea.names.slice(0, 6).map((n) => (
                        <span
                          key={n.symbol}
                          className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[0.7rem] text-slate-300"
                        >
                          {n.symbol}
                        </span>
                      ))}
                      {idea.names.length > 6 ? (
                        <span className="px-1 py-0.5 text-[0.7rem] text-slate-500">
                          +{idea.names.length - 6}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-auto pt-4 text-xs text-gold/80">Open research theme →</div>
                  </div>
                </GlassCard>
              </button>

              {locked ? (
                <Link
                  href="/pricing"
                  className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-2xl bg-ink-900/40 p-4 text-center backdrop-blur-[1px]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 bg-gold/15 text-gold">
                    🔒
                  </span>
                  <span className="font-display text-sm font-semibold text-white">
                    Quantifi Pro
                  </span>
                  <span className="max-w-[14rem] text-[0.7rem] leading-relaxed text-slate-300">
                    Unlock all {tradingIdeas.length} research themes — the full library beyond the
                    first three.
                  </span>
                  <span className="mt-1 rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-3 py-1 text-[0.7rem] font-semibold text-ink">
                    Upgrade →
                  </span>
                </Link>
              ) : null}
            </div>
          );
        })}
      </div>

      {!pro && ready ? (
        <p className="mt-6 text-center text-xs text-slate-500">
          Showing {Math.min(FREE_IDEA_COUNT, filtered.length)} free themes.{" "}
          {tradingIdeas.length - FREE_IDEA_COUNT} more are part of{" "}
          <Link href="/pricing" className="text-gold hover:underline">
            Quantifi Pro
          </Link>
          .
        </p>
      ) : null}

      {limit ? (
        <div className="mt-6 text-center">
          <Link
            href="/ideas"
            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-5 py-2.5 text-sm text-slate-200 transition hover:border-gold/40 hover:text-white"
          >
            Browse all {tradingIdeas.length} themes
            <span aria-hidden>→</span>
          </Link>
        </div>
      ) : null}

      {/* Detail modal */}
      {selected ? <IdeaModal idea={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}

function IdeaModal({ idea, onClose }: { idea: TradingIdea; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
    >
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-20 rounded-md bg-ink-900/80 px-2 py-1 text-slate-400 backdrop-blur transition hover:bg-white/[0.08] hover:text-white"
        >
          ✕
        </button>

        <div className="overflow-y-auto p-6 sm:p-8">
        <div className="flex flex-wrap items-center gap-2">
          <Tag tone="teal">{idea.category}</Tag>
          <span className="text-[0.7rem] text-slate-500">{idea.regions.join(" · ")}</span>
        </div>
        <h3 className="mt-3 font-display text-2xl font-semibold text-white">{idea.title}</h3>
        <p className="mt-1 text-sm text-slate-400">{idea.tagline}</p>

        <div className="mt-4 flex flex-wrap gap-1.5 text-[0.65rem]">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">
            ⏱ {idea.timeHorizon}
          </span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">
            Maturity: {idea.maturity}
          </span>
          <span className="rounded-full border border-down/25 bg-down/10 px-2 py-0.5 text-down/90">
            Valuation risk: {idea.valuationRisk}
          </span>
          {idea.bestFor ? (
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">
              Best for: {idea.bestFor}
            </span>
          ) : null}
        </div>

        <div className="mt-6 space-y-6">
          <div>
            <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Core thesis</div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{idea.description}</p>
          </div>

          <div>
            <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Why now</div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{idea.whyNow}</p>
          </div>

          {/* Scenario map */}
          <div>
            <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
              Scenario map
            </div>
            <div className="mt-2.5 space-y-2">
              {idea.scenarios.map((s) => {
                const tone =
                  s.kind === "Best case"
                    ? "border-up/20 bg-up/5 text-up/80"
                    : s.kind === "Worst case"
                    ? "border-down/20 bg-down/5 text-down/80"
                    : "border-white/[0.08] bg-white/[0.02] text-slate-400";
                return (
                  <div
                    key={s.kind}
                    className={`rounded-xl border p-3 sm:flex sm:items-start sm:gap-4 ${tone}`}
                  >
                    <span className="block w-24 flex-none text-[0.7rem] font-semibold uppercase tracking-wide">
                      {s.kind}
                    </span>
                    <div className="mt-1 sm:mt-0">
                      <p className="text-sm leading-relaxed text-slate-300">{s.what}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        <span className="text-slate-400">What tends to win:</span> {s.wins}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bull / bear */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-up/20 bg-up/5 p-4">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-up/80">Bull case</div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{idea.bullCase}</p>
            </div>
            <div className="rounded-xl border border-down/20 bg-down/5 p-4">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-down/80">Bear case</div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{idea.bearCase}</p>
            </div>
          </div>

          {/* What to watch */}
          <div>
            <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">What to watch</div>
            <ul className="mt-2 flex flex-wrap gap-2">
              {idea.watch.map((w) => (
                <li
                  key={w}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-xs text-slate-300"
                >
                  {w}
                </li>
              ))}
            </ul>
          </div>

          {/* Names grouped by role — tap to open analysis */}
          <div>
            <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
              Names to study — grouped by role · tap to open full analysis
            </div>
            <div className="mt-3 space-y-4">
              {idea.groups.map((group) => (
                <div key={group.label}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h5 className="text-xs font-semibold text-teal">{group.label}</h5>
                    {group.note ? (
                      <span className="text-[0.7rem] text-slate-500">— {group.note}</span>
                    ) : null}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {group.names.map((n) => (
                      <Link
                        key={`${group.label}-${n.symbol}`}
                        href={`/stock-analysis?symbol=${encodeURIComponent(n.symbol)}`}
                        onClick={onClose}
                        className="group rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 transition hover:border-gold/40"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-sm text-white">{n.symbol}</span>
                          <span className="text-gold/70 transition group-hover:translate-x-0.5">→</span>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{n.role}</p>
                        {n.why ? (
                          <p className="mt-1.5 text-[0.7rem] leading-relaxed text-slate-500">
                            <span className="text-slate-400">Why:</span> {n.why}
                          </p>
                        ) : null}
                        {n.risk ? (
                          <p className="mt-1 text-[0.7rem] leading-relaxed text-slate-500">
                            <span className="text-down/80">Risk:</span> {n.risk}
                          </p>
                        ) : null}
                        {n.watch ? (
                          <p className="mt-1 text-[0.7rem] leading-relaxed text-slate-500">
                            <span className="text-teal/80">Watch:</span> {n.watch}
                          </p>
                        ) : null}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Research checklist */}
          <div>
            <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
              Research checklist
            </div>
            <ul className="mt-2.5 space-y-2">
              {idea.checklist.map((item) => (
                <li
                  key={item.question}
                  className="flex gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5"
                >
                  <span className="mt-0.5 text-teal">☐</span>
                  <div>
                    <p className="text-sm text-slate-200">{item.question}</p>
                    <p className="mt-0.5 text-[0.7rem] leading-relaxed text-slate-500">{item.why}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          {/* Quantifi research scorecard */}
          <div>
            <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
              Quantifi research scorecard
            </div>
            <div className="mt-2.5 space-y-2">
              {idea.scores.map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="w-44 flex-none text-xs text-slate-300">{s.label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${s.score * 10}%`, backgroundColor: scoreColor(s.score) }}
                    />
                  </span>
                  <span className="w-10 flex-none text-right font-mono text-xs tnum text-slate-300">
                    {s.score}/10
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 rounded-xl border border-gold/20 bg-gold/[0.06] p-3">
              <span className="text-[0.62rem] uppercase tracking-[0.16em] text-gold/80">
                Research read
              </span>
              <p className="mt-1 text-sm leading-relaxed text-slate-200">{idea.verdict}</p>
            </div>
          </div>

          {/* Risk tag */}
          <div className="rounded-xl border border-down/20 bg-down/5 p-4">
            <div className="text-[0.62rem] uppercase tracking-[0.16em] text-down/80">
              Quantifi risk tag
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{idea.riskTag}</p>
          </div>

          {/* Sources */}
          {idea.sources?.length ? (
            <div>
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                Sources used
              </div>
              <ul className="mt-2 space-y-1 text-xs text-slate-500">
                {idea.sources.map((src) => (
                  <li key={src} className="flex gap-2">
                    <span className="text-slate-600">•</span>
                    <span>{src}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <p className="border-t border-white/[0.06] pt-4 text-xs text-slate-500">
            A research starting point, not a recommendation. Not advice — always do your own work.
          </p>
        </div>
        </div>
      </div>
    </div>
  );
}
