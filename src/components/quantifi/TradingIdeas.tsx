"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { GlassCard, SectionHeading, Tag } from "@/components/quantifi/Cards";
import { ideaCategories, tradingIdeas, type TradingIdea } from "@/data/demo";
import { useProStatus } from "@/lib/useProStatus";
import { FREE_LIMITS } from "@/data/plans";

// Free users can preview every Idea, but get full-dashboard access to only the
// first couple of featured themes; the rest unlock with Quantifi Pro.
const FREE_IDEA_COUNT = FREE_LIMITS.featuredIdeas;
const FREE_IDS = new Set(tradingIdeas.slice(0, FREE_IDEA_COUNT).map((i) => i.id));

function scoreColor(score: number): string {
  if (score >= 7) return "#34D399";
  if (score >= 4) return "#E9B872";
  return "#FB7185";
}

// Colour a thesis-test signal by whether it's encouraging, neutral or a warning.
function signalTone(signal: string): string {
  if (signal === "Strengthening") return "border-up/30 bg-up/10 text-up";
  if (signal === "Weakening" || signal === "Rising risk" || signal === "Critical test")
    return "border-down/30 bg-down/10 text-down";
  // Mixed / Early / Unproven / Watch closely
  return "border-gold/30 bg-gold/10 text-gold";
}

function importanceTone(importance: string): string {
  if (importance === "Very high") return "font-semibold text-down";
  if (importance === "High") return "font-semibold text-gold";
  return "text-slate-300";
}

function tagTone(tag: string): string {
  if (tag === "Direct") return "border-up/30 bg-up/10 text-up";
  if (tag === "Commodity-linked") return "border-gold/30 bg-gold/10 text-gold";
  if (tag === "Early-stage") return "border-down/30 bg-down/10 text-down";
  return "border-white/15 bg-white/[0.04] text-slate-300"; // Indirect
}

// Multi-region themes lead with a "Global Theme" badge rather than a single
// region (the old behaviour made a US-China-India theme read as just "India").
const isGlobalTheme = (idea: TradingIdea) => idea.regions.length > 1;

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
      {idea.themeWeather ? (
        <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-gold/90">
          ☼ {idea.themeWeather}
        </span>
      ) : null}
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

  // Deep link: /ideas?theme=<id> opens that theme directly (used by Community
  // playbooks). Read from the URL so we don't need a Suspense boundary.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("theme");
    if (!id) return;
    const match = tradingIdeas.find((i) => i.id === id);
    if (match) setSelected(match);
  }, []);

  const filtered = useMemo(() => {
    const list =
      active === "All" ? tradingIdeas : tradingIdeas.filter((i) => i.category === active);
    return limit ? list.slice(0, limit) : list;
  }, [active, limit]);

  const isLocked = (idea: TradingIdea) => ready && !pro && !FREE_IDS.has(idea.id);

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
          subtitle="Thematic research across the US, China and India — built for study, not recommendations. Tap any theme for the full research dashboard."
          href="/ideas"
          cta="All ideas"
        />
      ) : null}

      {showFilter ? (
        <div className="mt-6 rounded-2xl border border-gold/15 bg-gold/[0.04] p-4 sm:p-5">
          <span className="inline-flex items-center rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.14em] text-gold">
            Curated research · editorial
          </span>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            <span className="font-medium text-white">These are not recommendations or live market signals. They are research maps.</span>{" "}
            Each theme lays out the investment question, the value chain, the
            bull / base / bear case, the thesis tests that would prove or break it,
            and the source pack behind it. Any prices, market caps or news shown for a
            named stock are pulled live — where live data isn&apos;t available we show that,
            never a made-up number.
          </p>
        </div>
      ) : null}

      {showFilter ? (
        <div className="mt-4 flex flex-wrap gap-2">
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
          // Preview is identical for everyone; only full-dashboard access differs.
          const inner = (
            <GlassCard hover className="flex h-full flex-col p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {isGlobalTheme(idea) ? (
                    <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[0.62rem] font-medium text-gold">
                      Global Theme
                    </span>
                  ) : null}
                  <Tag tone="teal">{idea.category}</Tag>
                </div>
                {locked ? (
                  <span className="flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-1.5 py-0.5 text-[0.58rem] font-medium text-gold">
                    🔒 Pro
                  </span>
                ) : (
                  <span className="text-right text-[0.62rem] text-slate-500">{idea.regions.join(" · ")}</span>
                )}
              </div>
              <h3 className="mt-3 font-display text-lg font-semibold leading-snug text-white">{idea.title}</h3>
              <p className="mt-1 text-sm text-slate-400">{idea.tagline}</p>

              {idea.question ? (
                <p className="mt-3 border-l-2 border-gold/40 pl-3 text-[0.82rem] italic leading-relaxed text-slate-300">
                  {idea.question}
                </p>
              ) : null}

              <MetaChips idea={idea} />

              <div className="mt-4 flex flex-wrap gap-1.5">
                {idea.names.slice(0, 6).map((n) => (
                  <span key={n.symbol} className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[0.7rem] text-slate-300">
                    {n.symbol}
                  </span>
                ))}
                {idea.names.length > 6 ? (
                  <span className="px-1 py-0.5 text-[0.7rem] text-slate-500">+{idea.names.length - 6}</span>
                ) : null}
              </div>

              <div className="mt-auto pt-4 text-xs text-gold/80">
                {locked ? "Unlock full research map with Pro →" : "Open research map →"}
              </div>
            </GlassCard>
          );

          return locked ? (
            <Link key={idea.id} href="/pricing" className="block">
              {inner}
            </Link>
          ) : (
            <button key={idea.id} type="button" onClick={() => setSelected(idea)} className="w-full text-left">
              {inner}
            </button>
          );
        })}
      </div>

      {!pro && ready ? (
        <p className="mt-6 text-center text-xs text-slate-500">
          Preview every theme free, with full dashboards on {FREE_IDEA_COUNT} featured themes. Unlock
          all {tradingIdeas.length} with{" "}
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

      {selected ? <IdeaModal idea={selected} pro={pro} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">{children}</div>;
}

function Road({ steps, tone }: { steps: string[]; tone: "up" | "down" }) {
  const color = tone === "up" ? "text-up" : "text-down";
  const border = tone === "up" ? "border-up/20 bg-up/5" : "border-down/20 bg-down/5";
  return (
    <div className={`rounded-xl border p-3 ${border}`}>
      <div className={`text-[0.62rem] uppercase tracking-[0.16em] ${tone === "up" ? "text-up/80" : "text-down/80"}`}>
        {tone === "up" ? "Bull road" : "Bear road"}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          const chip = last
            ? tone === "up"
              ? "border-up/50 bg-up/15 font-semibold text-up"
              : "border-down/50 bg-down/15 font-semibold text-down"
            : "border-white/[0.08] bg-white/[0.03] text-slate-200";
          return (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`rounded-md border px-2 py-1 text-xs ${chip}`}>{s}</span>
              {!last ? <span className={`text-xs ${color}`} aria-hidden>→</span> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function IdeaModal({ idea, pro, onClose }: { idea: TradingIdea; pro: boolean; onClose: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const [activeNav, setActiveNav] = useState<string>("overview");
  const go = (id: string) => {
    bodyRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  const nav = [
    { id: "overview", label: "Overview", show: true },
    { id: "theme-map", label: "Map", show: !!idea.themeMap?.length },
    { id: "scenarios", label: "Scenarios", show: true },
    { id: "roads", label: "Roads", show: !!(idea.bullRoad?.length || idea.bearRoad?.length) },
    { id: "names", label: "Companies", show: true },
    { id: "thesis-tests", label: "Tests", show: !!idea.thesisTests?.length },
    { id: "sources", label: "Sources", show: !!(idea.sourcePack?.length || idea.sources?.length) },
  ].filter((n) => n.show);

  // Scroll-spy: highlight the nav item for the section currently near the top.
  useEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    const sections = nav
      .map((n) => root.querySelector(`#${n.id}`))
      .filter((el): el is Element => Boolean(el));
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (!visible.length) return;
        const top = visible.reduce((a, b) =>
          a.boundingClientRect.top < b.boundingClientRect.top ? a : b
        );
        setActiveNav(top.target.id);
      },
      { root, rootMargin: "0px 0px -70% 0px", threshold: [0, 0.25, 1] }
    );
    sections.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-[880px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl">
        {/* Fixed header — title, sticky section nav, always-visible close */}
        <div className="flex-none border-b border-white/[0.06] px-6 pt-5 sm:px-8">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {isGlobalTheme(idea) ? (
                <span className="rounded-full border border-gold/30 bg-gold/10 px-2 py-0.5 text-[0.62rem] font-medium text-gold">
                  Global Theme
                </span>
              ) : null}
              <Tag tone="teal">{idea.category}</Tag>
              <span className="text-[0.7rem] text-slate-500">{idea.regions.join(" · ")}</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex-none rounded-md px-2 py-1 text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
            >
              ✕
            </button>
          </div>
          <h3 className="mt-2 font-display text-2xl font-semibold text-white">{idea.title}</h3>
          <p className="mt-1 text-sm text-slate-400">{idea.tagline}</p>
          <nav className="mt-3 flex gap-1 overflow-x-auto">
            {nav.map((n) => {
              const on = activeNav === n.id;
              return (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => go(n.id)}
                  aria-current={on ? "true" : undefined}
                  className={`whitespace-nowrap rounded-t-md border-b-2 px-2.5 py-1.5 text-xs transition ${
                    on ? "border-gold text-white" : "border-transparent text-slate-400 hover:border-gold/50 hover:text-white"
                  }`}
                >
                  {n.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Scroll body */}
        <div ref={bodyRef} className="overflow-y-auto p-6 sm:p-8">
          <div id="overview" />

          {idea.question ? (
            <div className="mt-1 rounded-xl border border-gold/20 bg-gold/[0.05] p-3.5">
              <span className="text-[0.62rem] uppercase tracking-[0.16em] text-gold/80">The investment question</span>
              <p className="mt-1 text-base font-medium leading-relaxed text-white">{idea.question}</p>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-1.5 text-[0.65rem]">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">⏱ {idea.timeHorizon}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">Maturity: {idea.maturity}</span>
            <span className="rounded-full border border-down/25 bg-down/10 px-2 py-0.5 text-down/90">Valuation risk: {idea.valuationRisk}</span>
            {idea.themeWeather ? (
              <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-gold/90">☼ {idea.themeWeather}</span>
            ) : null}
            {idea.bestFor ? (
              <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">Best for: {idea.bestFor}</span>
            ) : null}
          </div>

          {/* Quantifi read — the quick conclusion, up top */}
          <div id="read" className="mt-4 rounded-xl border border-gold/20 bg-gold/[0.06] p-4">
            <SectionLabel>Quantifi research read</SectionLabel>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{idea.verdict}</p>
          </div>

          {/* Scorecard — near the top so the user sees the conclusion fast */}
          <div id="scorecard" className="mt-4 scroll-mt-2">
            <SectionLabel>Quantifi scorecard</SectionLabel>
            <div className="mt-2.5 grid gap-x-6 gap-y-2 sm:grid-cols-2">
              {idea.scores.map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <span className="w-40 flex-none text-xs text-slate-300">{s.label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <span className="block h-full rounded-full" style={{ width: `${s.score * 10}%`, backgroundColor: scoreColor(s.score) }} />
                  </span>
                  <span className="w-9 flex-none text-right font-mono text-xs tnum text-slate-300">{s.score}/10</span>
                </div>
              ))}
            </div>
          </div>

          <div className="my-6 h-px bg-white/[0.06]" />

          {/* ── MIDDLE: theme map, scenarios, roads ────────────────────────── */}

          {/* Theme map / value chain — a vertical causal stack */}
          {idea.themeMap?.length ? (
            <div id="theme-map" className="scroll-mt-2">
              <SectionLabel>Theme map — the value chain</SectionLabel>
              <div className="mt-2.5">
                {idea.themeMap.map((link, i) => (
                  <div key={link.layer}>
                    <div className="rounded-xl border border-teal/15 bg-teal/[0.04] px-3.5 py-3">
                      <div className="flex items-center gap-2">
                        <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-teal/15 font-mono text-[0.6rem] text-teal">
                          {i + 1}
                        </span>
                        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-teal">{link.layer}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5 pl-7">
                        {link.symbols.map((s) => (
                          <span key={s} className="rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[0.7rem] text-slate-200">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                    {i < idea.themeMap!.length - 1 ? (
                      <div className="flex justify-center py-1 text-base leading-none text-teal/50" aria-hidden>↓</div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Split-cycle view — segments that don't all move together */}
          {idea.splitCycle?.length ? (
            <div className="mt-6">
              <SectionLabel>Split-cycle view</SectionLabel>
              <p className="mt-1 text-xs text-slate-500">Not all of this theme moves together — each segment has its own driver and risk.</p>
              <div className="mt-2.5 overflow-hidden rounded-xl border border-white/[0.06]">
                <div className="hidden grid-cols-[1fr_1.3fr_1.1fr] gap-3 border-b border-white/[0.06] bg-white/[0.02] px-3.5 py-2 text-[0.6rem] uppercase tracking-[0.12em] text-slate-500 sm:grid">
                  <span>Segment</span>
                  <span>Driver</span>
                  <span>Main risk</span>
                </div>
                <div className="divide-y divide-white/[0.05]">
                  {idea.splitCycle.map((r) => (
                    <div key={r.segment} className="grid gap-1 px-3.5 py-2.5 sm:grid-cols-[1fr_1.3fr_1.1fr] sm:gap-3">
                      <span className="text-sm font-medium text-white">{r.segment}</span>
                      <span className="text-xs text-slate-400">{r.driver}</span>
                      <span className="text-xs text-down/80">{r.risk}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          {/* Scenario map — what happens / who benefits / red flag */}
          <div id="scenarios" className="mt-6 scroll-mt-2">
            <SectionLabel>Scenario map</SectionLabel>
            <div className="mt-2.5 space-y-2">
              {idea.scenarios.map((s) => {
                const tone =
                  s.kind === "Best case"
                    ? "border-up/20 bg-up/5"
                    : s.kind === "Worst case"
                    ? "border-down/20 bg-down/5"
                    : "border-white/[0.08] bg-white/[0.02]";
                const kindColor = s.kind === "Best case" ? "text-up" : s.kind === "Worst case" ? "text-down" : "text-slate-400";
                return (
                  <div key={s.kind} className={`rounded-xl border p-3.5 ${tone}`}>
                    <span className={`text-[0.7rem] font-semibold uppercase tracking-wide ${kindColor}`}>{s.kind}</span>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{s.what}</p>
                    <div className="mt-2.5 space-y-1 border-t border-white/[0.06] pt-2.5">
                      <p className="text-xs leading-relaxed text-slate-300">
                        <span className={`font-medium ${s.kind === "Worst case" ? "text-slate-300" : "text-up/90"}`}>
                          {s.kind === "Worst case" ? "Most resilient: " : "Likely beneficiaries: "}
                        </span>
                        {s.wins}
                      </p>
                      {s.redFlag ? (
                        <p className="text-xs leading-relaxed text-slate-300">
                          <span className="font-medium text-down/90">Red flag: </span>
                          {s.redFlag}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
            {idea.swingFactor ? (
              <p className="mt-2.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-xs text-slate-300">
                <span className="font-semibold text-white">Main swing factor: </span>
                {idea.swingFactor}
              </p>
            ) : null}
          </div>

          {/* Bull road vs bear road */}
          {idea.bullRoad?.length || idea.bearRoad?.length ? (
            <div id="roads" className="mt-6 scroll-mt-2">
              <SectionLabel>Bull road vs bear road</SectionLabel>
              <div className="mt-2.5 space-y-2">
                {idea.bullRoad?.length ? <Road steps={idea.bullRoad} tone="up" /> : null}
                {idea.bearRoad?.length ? <Road steps={idea.bearRoad} tone="down" /> : null}
              </div>
            </div>
          ) : null}

          {/* What to watch */}
          <div className="mt-6">
            <SectionLabel>What to watch</SectionLabel>
            <ul className="mt-2 flex flex-wrap gap-2">
              {idea.watch.map((w) => (
                <li key={w} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-xs text-slate-300">
                  {w}
                </li>
              ))}
            </ul>
          </div>

          <div className="my-6 h-px bg-white/[0.06]" />

          {/* ── BOTTOM: names, checklist, prove/break, sources ─────────────── */}

          {/* Names grouped by role — uniform card with details shown directly */}
          <div id="names" className="scroll-mt-2">
            <SectionLabel>Names to study — grouped by role · tap to open full analysis</SectionLabel>
            <div className="mt-3 space-y-4">
              {idea.groups.map((group) => (
                <div key={group.label}>
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <h5 className="text-xs font-semibold text-teal">{group.label}</h5>
                    {group.note ? <span className="text-[0.7rem] text-slate-500">— {group.note}</span> : null}
                  </div>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {group.names.map((n) => (
                      <Link
                        key={`${group.label}-${n.symbol}`}
                        href={`/stock-analysis?symbol=${encodeURIComponent(n.symbol)}`}
                        onClick={onClose}
                        className="group flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 transition hover:border-gold/40"
                      >
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-sm text-white">{n.symbol}</span>
                          {n.tag ? (
                            <span className={`rounded-full border px-1.5 py-px text-[0.55rem] ${tagTone(n.tag)}`}>
                              {n.tag}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-xs text-slate-400">{n.role}</p>
                        {n.risk ? (
                          <p className="mt-1 text-[0.7rem] leading-relaxed text-slate-500"><span className="text-down/80">Risk:</span> {n.risk}</p>
                        ) : null}
                        {n.watch ? (
                          <p className="mt-1 text-[0.7rem] leading-relaxed text-slate-500"><span className="text-teal/80">Watch:</span> {n.watch}</p>
                        ) : null}
                        <span className="mt-auto pt-2 text-[0.65rem] font-medium text-gold/80 transition group-hover:text-gold">
                          Open analysis →
                        </span>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Thesis tests — research signals, not a to-do list */}
          {idea.thesisTests?.length ? (
            <div id="thesis-tests" className="mt-6 scroll-mt-2">
              <SectionLabel>Thesis tests</SectionLabel>
              <p className="mt-1 text-xs text-slate-500">
                The signals that decide whether this theme is strengthening or weakening.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {idea.thesisTests.map((t) => (
                  <div key={t.test} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium text-white">{t.test}</span>
                      <span className={`flex-none rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${signalTone(t.signal)}`}>
                        {t.signal}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[0.62rem]">
                      <span className="uppercase tracking-[0.12em] text-slate-500">Importance</span>
                      <span className={importanceTone(t.importance)}>{t.importance}</span>
                    </div>
                    <p className="mt-2 text-[0.72rem] leading-relaxed text-slate-400">
                      <span className="text-slate-500">Why it matters: </span>
                      {t.why}
                    </p>
                    <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-400">
                      <span className="text-teal/80">Metric to watch: </span>
                      {t.metric}
                    </p>
                    <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-400">
                      <span className="text-down/80">Breaks thesis if: </span>
                      {t.breaksIf}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* What would prove / break the thesis */}
          {idea.proves?.length || idea.breaks?.length ? (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {idea.proves?.length ? (
                <div className="rounded-xl border border-up/20 bg-up/5 p-4">
                  <div className="text-[0.62rem] uppercase tracking-[0.16em] text-up/80">What would prove the theme right</div>
                  <ul className="mt-2 space-y-1.5">
                    {idea.proves.map((p) => (
                      <li key={p} className="flex gap-2 text-sm text-slate-300">
                        <span className="mt-0.5 text-up">✓</span>
                        <span className="leading-relaxed">{p}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {idea.breaks?.length ? (
                <div className="rounded-xl border border-down/20 bg-down/5 p-4">
                  <div className="text-[0.62rem] uppercase tracking-[0.16em] text-down/80">What would break the theme</div>
                  <ul className="mt-2 space-y-1.5">
                    {idea.breaks.map((b) => (
                      <li key={b} className="flex gap-2 text-sm text-slate-300">
                        <span className="mt-0.5 text-down">✕</span>
                        <span className="leading-relaxed">{b}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Source pack — full evidence is a Pro feature; free users see a teaser. */}
          {idea.sourcePack?.length && !pro ? (
            <div id="sources" className="mt-6 scroll-mt-2">
              <SectionLabel>Source pack</SectionLabel>
              <Link
                href="/pricing"
                onClick={onClose}
                className="mt-2.5 flex flex-col items-center gap-2 rounded-xl border border-gold/25 bg-gold/[0.05] p-5 text-center transition hover:border-gold/40"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 bg-gold/15 text-gold">🔒</span>
                <span className="text-sm font-semibold text-white">Full source pack is part of Quantifi Pro</span>
                <span className="max-w-md text-xs leading-relaxed text-slate-400">
                  {idea.sourcePack.length} evidence sources — filings, earnings calls, industry &amp; policy
                  data — each with what it checks, the linked names and the thesis test it informs.
                </span>
                <span className="mt-1 rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-3 py-1 text-[0.7rem] font-semibold text-ink">
                  Unlock with Pro →
                </span>
              </Link>
            </div>
          ) : idea.sourcePack?.length ? (
            <div id="sources" className="mt-6 scroll-mt-2">
              <SectionLabel>Source pack</SectionLabel>
              <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                {idea.sourcePack.map((s) => (
                  <div key={s.type} className="flex flex-col rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                    <div className="text-sm font-medium text-white">{s.type}</div>
                    <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-400">
                      <span className="text-slate-500">Checks: </span>
                      {s.checks}
                    </p>
                    {s.linked?.length ? (
                      <p className="mt-1.5 text-[0.7rem] leading-relaxed text-slate-500">
                        <span className="text-slate-400">Linked names: </span>
                        <span className="font-mono">{s.linked.join(" · ")}</span>
                      </p>
                    ) : null}
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
                      {s.usedIn ? (
                        <button
                          type="button"
                          onClick={() => go("thesis-tests")}
                          className="text-left text-[0.66rem] text-slate-400 transition hover:text-white"
                        >
                          <span className="text-teal/80">Used in test: </span>
                          {s.usedIn}
                        </button>
                      ) : (
                        <span />
                      )}
                      {s.href ? (
                        <a
                          href={s.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-none text-[0.66rem] font-medium text-gold/80 hover:text-gold"
                        >
                          View sources →
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : idea.sources?.length ? (
            <div id="sources" className="mt-6 scroll-mt-2">
              <SectionLabel>Sources used</SectionLabel>
              <div className="mt-2 flex flex-wrap gap-2">
                {idea.sources.map((src) => (
                  <span key={src} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-xs text-slate-400">
                    {src}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {/* Methodology — documents the evidence categories used */}
          <div className="mt-5">
            <SectionLabel>How we research this</SectionLabel>
            <div className="mt-2 flex flex-wrap gap-2 text-[0.7rem]">
              {[
                "Company filings",
                "Earnings calls",
                "Industry & macro data",
                "Government & policy documents",
                "Financial news",
                "Quantifi methodology",
              ].map((c) => (
                <span key={c} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1 text-slate-400">
                  {c}
                </span>
              ))}
            </div>
            <p className="mt-2 text-[0.68rem] leading-relaxed text-slate-600">
              Per-stock scores and fair values are computed from current fundamentals where available; theme
              commentary draws on the source categories above. Educational research, not advice.
            </p>
          </div>

          <p className="mt-6 border-t border-white/[0.06] pt-4 text-xs text-slate-500">
            A research starting point, not a recommendation. Not advice — always do your own work.
          </p>
        </div>
      </div>
    </div>
  );
}
