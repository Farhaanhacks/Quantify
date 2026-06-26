"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { ExposureGroup, ExposureItem, ExposureType, Playbook } from "@/data/playbooks";

function signalTone(signal: string): string {
  if (signal === "Strengthening") return "border-up/30 bg-up/10 text-up";
  if (signal === "Weakening") return "border-down/30 bg-down/10 text-down";
  return "border-gold/30 bg-gold/10 text-gold";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">{children}</div>;
}

function Road({ steps, tone }: { steps: string[]; tone: "up" | "down" }) {
  const arrow = tone === "up" ? "text-up" : "text-down";
  const border = tone === "up" ? "border-up/20 bg-up/5" : "border-down/20 bg-down/5";
  return (
    <div className={`rounded-xl border p-3.5 ${border}`}>
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
              {!last ? <span className={`text-xs ${arrow}`} aria-hidden>→</span> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

const EXPO_BADGE: Record<ExposureType, { label: string; cls: string }> = {
  long: { label: "Long", cls: "border-up/40 bg-up/10 text-up" },
  short: { label: "Bearish", cls: "border-down/40 bg-down/10 text-down" },
  private: { label: "Private", cls: "border-violet-400/40 bg-violet-400/10 text-violet-300" },
  proxy: { label: "Proxy", cls: "border-teal/40 bg-teal/10 text-teal" },
  watchlist: { label: "Watchlist", cls: "border-gold/40 bg-gold/10 text-gold" },
  editorial: { label: "Editorial", cls: "border-white/15 bg-white/5 text-slate-300" },
};

function ExposureCard({ item }: { item: ExposureItem }) {
  const badge = EXPO_BADGE[item.exposureType];
  const tradable = Boolean(item.ticker) && item.assetType !== "private_company";
  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
      <div className="flex flex-wrap items-center gap-2">
        {tradable ? (
          <Link
            href={`/stock-analysis?symbol=${encodeURIComponent(item.ticker as string)}`}
            className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-sm text-white transition hover:border-gold/40 hover:text-gold"
          >
            {item.ticker}
          </Link>
        ) : (
          <span className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-0.5 font-mono text-sm text-slate-300">
            {item.ticker ?? "—"}
          </span>
        )}
        <span className="text-sm text-slate-200">{item.name}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[0.6rem] font-semibold uppercase tracking-wide ${badge.cls}`}>
          {badge.label}
        </span>
        {item.assetType === "etf" ? (
          <span className="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[0.6rem] text-slate-300">ETF</span>
        ) : null}
        {item.conviction ? (
          <span className="text-[0.6rem] uppercase tracking-wide text-slate-500">{item.conviction} conviction</span>
        ) : null}
        {!item.isDirectExposure ? (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[0.6rem] text-amber-300">
            {item.assetType === "private_company" ? "Not directly tradable" : "Indirect"}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{item.explanation}</p>
      {item.sourceUrl ? (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-block text-[0.68rem] text-gold/80 hover:text-gold"
        >
          Source →
        </a>
      ) : null}
    </div>
  );
}

function ExposureSection({ groups }: { groups: ExposureGroup[] }) {
  return (
    <div className="mt-2.5 space-y-4">
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-[0.72rem] leading-relaxed text-slate-400">
        These are not recommendations. They represent thematic exposure, not necessarily fund holdings.
        Short / bearish names are shown separately from long exposure, and private companies are never
        shown as tradable tickers.
      </div>
      {groups.map((g) => (
        <div key={g.key}>
          <div className="flex flex-wrap items-baseline gap-x-2">
            <h4 className="text-sm font-semibold text-white">{g.title}</h4>
            <span className="text-[0.65rem] text-slate-500">{g.items.length} names</span>
          </div>
          <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-500">{g.note}</p>
          <div className="mt-2.5 grid gap-2.5 sm:grid-cols-2">
            {g.items.map((it) => (
              <ExposureCard key={`${g.key}-${it.name}`} item={it} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function PlaybookPage({ playbook }: { playbook: Playbook }) {
  const nav = [
    { id: "question", label: "Question" },
    { id: "read", label: "Read" },
    { id: "summary", label: "Summary" },
    { id: "market-map", label: "Market Map" },
    ...(playbook.exposure?.length ? [{ id: "exposure", label: "Exposure" }] : []),
    { id: "bull-bear", label: "Bull/Bear" },
    { id: "thesis-tests", label: "Thesis Tests" },
    { id: "scenarios", label: "Scenarios" },
    { id: "roads", label: "Roads" },
    { id: "sources", label: "Sources" },
    { id: "related", label: "Ideas" },
  ];

  const [active, setActive] = useState<string>(nav[0].id);

  const go = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  // Scroll-spy: highlight the section currently in view.
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-120px 0px -65% 0px", threshold: 0 }
    );
    nav.forEach((n) => {
      const el = document.getElementById(n.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playbook.id]);

  return (
    <div className="min-h-screen">
      {/* Sticky header */}
      <div className="sticky top-0 z-40 border-b border-white/[0.08] bg-ink-900/85 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6 lg:px-8">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-teal/30 bg-teal/10 px-2 py-0.5 text-[0.62rem] font-medium text-teal">
                  {playbook.type}
                </span>
                {playbook.lastUpdated ? (
                  <span className="text-[0.65rem] text-slate-500">Last updated {playbook.lastUpdated}</span>
                ) : null}
              </div>
              <h1 className="mt-1.5 truncate font-display text-xl font-semibold text-white sm:text-2xl">
                {playbook.title}
              </h1>
              <p className="hidden text-sm text-slate-400 sm:block">{playbook.subtitle}</p>
            </div>
            <Link
              href="/community"
              className="flex-none rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 transition hover:border-white/30 hover:text-white"
            >
              ← Back
            </Link>
          </div>
          <nav className="mt-3 flex gap-1 overflow-x-auto pb-1">
            {nav.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => go(n.id)}
                className={`whitespace-nowrap rounded-t-md border-b-2 px-3 py-2 text-xs transition ${
                  active === n.id
                    ? "border-gold text-white"
                    : "border-transparent text-slate-400 hover:border-gold/40 hover:text-white"
                }`}
              >
                {n.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Body — full width research dashboard */}
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Question */}
        <section id="question" className="scroll-mt-28 rounded-xl border border-gold/20 bg-gold/[0.05] p-5">
          <span className="text-[0.62rem] uppercase tracking-[0.16em] text-gold/80">The core question</span>
          <p className="mt-1.5 text-lg font-medium leading-relaxed text-white">{playbook.coreQuestion}</p>
        </section>

        {/* Read */}
        <section id="read" className="mt-5 scroll-mt-28 rounded-xl border border-gold/20 bg-gold/[0.06] p-5">
          <SectionLabel>Quantifi research read</SectionLabel>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{playbook.read}</p>
        </section>

        {playbook.whatChanged?.length ? (
          <section className="mt-5 rounded-xl border border-teal/20 bg-teal/[0.05] p-5">
            <div className="flex items-center justify-between gap-2">
              <SectionLabel>What changed recently</SectionLabel>
              {playbook.lastUpdated ? <span className="text-[0.62rem] text-slate-500">as of {playbook.lastUpdated}</span> : null}
            </div>
            <ul className="mt-2 space-y-1.5">
              {playbook.whatChanged.map((c) => (
                <li key={c} className="flex gap-2 text-sm leading-relaxed text-slate-300">
                  <span className="mt-0.5 flex-none text-teal">›</span>
                  <span>{c}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Badges */}
        <div className="mt-5 flex flex-wrap gap-1.5 text-[0.65rem]">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">⏱ {playbook.timeHorizon}</span>
          <span className="rounded-full border border-down/25 bg-down/10 px-2 py-0.5 text-down/90">Risk lens: {playbook.riskLens}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">Best for: {playbook.bestFor}</span>
          <span className="rounded-full border border-teal/25 bg-teal/10 px-2 py-0.5 text-teal/90">{playbook.status}</span>
        </div>

        {/* Summary */}
        <section id="summary" className="mt-8 scroll-mt-28">
          <SectionLabel>Executive summary</SectionLabel>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {playbook.summary.map((c, i) => (
              <div key={c.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full bg-gold/15 font-mono text-[0.6rem] text-gold">
                    {i + 1}
                  </span>
                  <span className="text-sm font-semibold text-white">{c.title}</span>
                </div>
                <p className="mt-1.5 text-[0.78rem] leading-relaxed text-slate-400">{c.summary}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Market map */}
        <section id="market-map" className="mt-8 scroll-mt-28">
          <SectionLabel>Market map — how the framework connects to Quantifi Ideas</SectionLabel>
          <div className="mt-3">
            <div className="mx-auto max-w-md rounded-xl border border-teal/20 bg-teal/[0.06] px-3.5 py-2.5 text-center text-sm font-semibold text-teal">
              {playbook.title.replace(/^Decode:\s*/, "")}
            </div>
            <div className="flex justify-center py-1 text-base leading-none text-teal/50" aria-hidden>↓</div>
            <div className="grid gap-3 lg:grid-cols-2">
              {playbook.linkedIdeas.map((idea) => (
                <div key={idea.ideaId} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white">{idea.title}</span>
                    <Link href={`/ideas?theme=${encodeURIComponent(idea.ideaId)}`} className="text-[0.7rem] font-medium text-gold/80 hover:text-gold">
                      Open theme →
                    </Link>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-slate-400">
                    <span className="text-slate-500">Why linked: </span>
                    {idea.whyLinked}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {idea.names.map((n) => (
                      <Link
                        key={n}
                        href={`/stock-analysis?symbol=${encodeURIComponent(n)}`}
                        className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[0.7rem] text-slate-300 transition hover:border-gold/40 hover:text-white"
                      >
                        {n}
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[0.7rem] text-slate-600">
              These tickers are thematically connected to the idea — see the Exposure tab for how each name is
              actually positioned (long, bearish, proxy or private).
            </p>
          </div>
        </section>

        {/* Exposure */}
        {playbook.exposure?.length ? (
          <section id="exposure" className="mt-8 scroll-mt-28">
            <SectionLabel>Exposure map — long, bearish, private, proxies & ETFs</SectionLabel>
            <ExposureSection groups={playbook.exposure} />
          </section>
        ) : null}

        {/* Bull / bear */}
        <section id="bull-bear" className="mt-8 grid gap-3 scroll-mt-28 sm:grid-cols-2">
          <div className="rounded-xl border border-up/20 bg-up/5 p-5">
            <div className="text-[0.62rem] uppercase tracking-[0.16em] text-up/80">Bull case</div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{playbook.bullCase}</p>
          </div>
          <div className="rounded-xl border border-down/20 bg-down/5 p-5">
            <div className="text-[0.62rem] uppercase tracking-[0.16em] text-down/80">Bear case</div>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{playbook.bearCase}</p>
          </div>
        </section>

        {/* Thesis tests */}
        <section id="thesis-tests" className="mt-8 scroll-mt-28">
          <SectionLabel>Thesis tests</SectionLabel>
          <p className="mt-1 text-xs text-slate-500">The signals that decide whether this framework is strengthening or weakening.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {playbook.thesisTests.map((t) => (
              <div key={t.test} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-white">{t.test}</span>
                  <span className={`flex-none rounded-full border px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide ${signalTone(t.signal)}`}>
                    {t.signal}
                  </span>
                </div>
                <p className="mt-2 text-[0.72rem] leading-relaxed text-slate-400">
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
        </section>

        {/* Scenarios */}
        <section id="scenarios" className="mt-8 scroll-mt-28">
          <SectionLabel>Scenario map</SectionLabel>
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {playbook.scenarios.map((s) => {
              const tone = s.kind === "Best case" ? "border-up/20 bg-up/5" : s.kind === "Worst case" ? "border-down/20 bg-down/5" : "border-white/[0.08] bg-white/[0.02]";
              const kindColor = s.kind === "Best case" ? "text-up" : s.kind === "Worst case" ? "text-down" : "text-slate-400";
              const worst = s.kind === "Worst case";
              return (
                <div key={s.kind} className={`rounded-xl border p-4 ${tone}`}>
                  <span className={`text-[0.7rem] font-semibold uppercase tracking-wide ${kindColor}`}>{s.kind}</span>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{s.what}</p>
                  <div className="mt-2.5 space-y-1 border-t border-white/[0.06] pt-2.5">
                    <p className="text-xs leading-relaxed text-slate-300">
                      <span className={`font-medium ${worst ? "text-slate-300" : "text-up/90"}`}>
                        {worst ? "Most resilient: " : "Likely beneficiaries: "}
                      </span>
                      {s.beneficiaries}
                    </p>
                    <p className="text-xs leading-relaxed text-slate-300">
                      <span className="font-medium text-down/90">Red flag: </span>
                      {s.redFlag}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Roads */}
        <section id="roads" className="mt-8 scroll-mt-28">
          <SectionLabel>Bull road vs bear road</SectionLabel>
          <div className="mt-3 space-y-2">
            <Road steps={playbook.bullRoad} tone="up" />
            <Road steps={playbook.bearRoad} tone="down" />
          </div>
        </section>

        {/* Sources */}
        <section id="sources" className="mt-8 scroll-mt-28">
          <SectionLabel>Source pack</SectionLabel>
          <p className="mt-1 text-xs text-slate-500">External and reference sources — what each one checks, and the thesis test it informs.</p>
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {playbook.sourcePack.map((s) => (
              <div key={s.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <div className="text-sm font-semibold text-white">{s.title}</div>
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
                {s.why ? <p className="mt-2 text-[0.72rem] leading-relaxed text-slate-400">{s.why}</p> : null}
                <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
                  {s.usedIn ? (
                    <button type="button" onClick={() => go("thesis-tests")} className="text-left text-[0.68rem] text-slate-400 transition hover:text-white">
                      <span className="text-teal/80">Use in thesis test: </span>
                      {s.usedIn}
                    </button>
                  ) : (
                    <span />
                  )}
                  {s.href ? (
                    <a href={s.href} target="_blank" rel="noopener noreferrer" className="flex-none text-[0.68rem] font-medium text-gold/80 hover:text-gold">
                      Open sources →
                    </a>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Ideas */}
        <section id="related" className="mt-8 scroll-mt-28">
          <SectionLabel>Related Quantifi Ideas</SectionLabel>
          <div className="mt-3 grid gap-2 lg:grid-cols-2">
            {playbook.linkedIdeas.map((idea) => (
              <Link
                key={idea.ideaId}
                href={`/ideas?theme=${encodeURIComponent(idea.ideaId)}`}
                className="group block rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-gold/40"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-white">{idea.title}</span>
                  <span className="flex-none text-[0.7rem] font-medium text-gold/80 transition group-hover:text-gold">Open theme →</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">
                  <span className="text-slate-500">Why it connects: </span>
                  {idea.whyLinked}
                </p>
              </Link>
            ))}
          </div>
        </section>

        <p className="mt-8 border-t border-white/[0.06] pt-5 text-xs text-slate-500">
          Curated research / editorial — a framework decoder, not a recommendation or a live market signal.
          Exposure types (long, bearish, private, proxy, ETF) are research classifications, not advice. Not investment advice.
        </p>
      </div>
    </div>
  );
}
