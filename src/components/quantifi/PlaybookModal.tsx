"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Playbook } from "@/data/playbooks";

function signalTone(signal: string): string {
  if (signal === "Strengthening") return "border-up/30 bg-up/10 text-up";
  if (signal === "Weakening") return "border-down/30 bg-down/10 text-down";
  return "border-gold/30 bg-gold/10 text-gold"; // Mixed / Early / Watch closely
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">{children}</div>;
}

function Road({ steps, tone }: { steps: string[]; tone: "up" | "down" }) {
  const arrow = tone === "up" ? "text-up" : "text-down";
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
              {!last ? <span className={`text-xs ${arrow}`} aria-hidden>→</span> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function PlaybookModal({ playbook, onClose }: { playbook: Playbook; onClose: () => void }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const go = (id: string) => {
    bodyRef.current?.querySelector(`#${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  const nav = [
    { id: "question", label: "Question" },
    { id: "read", label: "Read" },
    { id: "summary", label: "Summary" },
    { id: "market-map", label: "Market map" },
    { id: "bull-bear", label: "Bull/Bear" },
    { id: "thesis-tests", label: "Thesis tests" },
    { id: "scenarios", label: "Scenarios" },
    { id: "roads", label: "Roads" },
    { id: "sources", label: "Sources" },
    { id: "related", label: "Ideas" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[90vh] w-full max-w-[880px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl">
        {/* Fixed header */}
        <div className="flex-none border-b border-white/[0.06] px-6 pt-5 sm:px-8">
          <div className="flex items-start justify-between gap-3">
            <span className="rounded-full border border-teal/30 bg-teal/10 px-2 py-0.5 text-[0.62rem] font-medium text-teal">
              {playbook.type}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex-none rounded-md px-2 py-1 text-slate-400 transition hover:bg-white/[0.08] hover:text-white"
            >
              ✕
            </button>
          </div>
          <h3 className="mt-2 font-display text-2xl font-semibold text-white">{playbook.title}</h3>
          <p className="mt-1 text-sm text-slate-400">{playbook.subtitle}</p>
          <div className="mt-2 flex flex-wrap gap-1.5 text-[0.62rem] text-slate-500">
            {playbook.detailTags.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
          <p className="mt-1.5 text-[0.7rem] text-slate-600">Framework analysis only. Not investment advice.</p>
          <nav className="mt-3 flex gap-1 overflow-x-auto">
            {nav.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => go(n.id)}
                className="whitespace-nowrap rounded-t-md border-b-2 border-transparent px-2.5 py-1.5 text-xs text-slate-400 transition hover:border-gold/50 hover:text-white"
              >
                {n.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Scroll body */}
        <div ref={bodyRef} className="overflow-y-auto p-6 sm:p-8">
          {/* B — Core question */}
          <div id="question" className="rounded-xl border border-gold/20 bg-gold/[0.05] p-4 scroll-mt-2">
            <span className="text-[0.62rem] uppercase tracking-[0.16em] text-gold/80">The core question</span>
            <p className="mt-1 text-base font-medium leading-relaxed text-white">{playbook.coreQuestion}</p>
          </div>

          {/* C — Quantifi research read */}
          <div id="read" className="mt-4 rounded-xl border border-gold/20 bg-gold/[0.06] p-4 scroll-mt-2">
            <SectionLabel>Quantifi research read</SectionLabel>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{playbook.read}</p>
          </div>

          {/* Badges */}
          <div className="mt-4 flex flex-wrap gap-1.5 text-[0.65rem]">
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">⏱ {playbook.timeHorizon}</span>
            <span className="rounded-full border border-down/25 bg-down/10 px-2 py-0.5 text-down/90">Risk lens: {playbook.riskLens}</span>
            <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">Best for: {playbook.bestFor}</span>
            <span className="rounded-full border border-teal/25 bg-teal/10 px-2 py-0.5 text-teal/90">{playbook.status}</span>
          </div>

          {/* D — Executive summary */}
          <div id="summary" className="mt-6 scroll-mt-2">
            <SectionLabel>Executive summary</SectionLabel>
            <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
              {playbook.summary.map((c, i) => (
                <div key={c.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
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
          </div>

          {/* E — Market map */}
          <div id="market-map" className="mt-6 scroll-mt-2">
            <SectionLabel>Market map — how the framework connects to Quantifi Ideas</SectionLabel>
            <div className="mt-2.5">
              <div className="rounded-xl border border-teal/20 bg-teal/[0.06] px-3.5 py-2.5 text-center text-sm font-semibold text-teal">
                Situational Awareness
              </div>
              <div className="flex justify-center py-1 text-base leading-none text-teal/50" aria-hidden>↓</div>
              <div className="space-y-2">
                {playbook.linkedIdeas.map((idea) => (
                  <div key={idea.ideaId} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">{idea.title}</span>
                      <Link
                        href={`/ideas?theme=${encodeURIComponent(idea.ideaId)}`}
                        className="text-[0.7rem] font-medium text-gold/80 hover:text-gold"
                      >
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
            </div>
          </div>

          {/* F — Bull / bear case */}
          <div id="bull-bear" className="mt-6 grid gap-3 scroll-mt-2 sm:grid-cols-2">
            <div className="rounded-xl border border-up/20 bg-up/5 p-4">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-up/80">Bull case</div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{playbook.bullCase}</p>
            </div>
            <div className="rounded-xl border border-down/20 bg-down/5 p-4">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-down/80">Bear case</div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{playbook.bearCase}</p>
            </div>
          </div>

          {/* G — Thesis tests */}
          <div id="thesis-tests" className="mt-6 scroll-mt-2">
            <SectionLabel>Thesis tests</SectionLabel>
            <p className="mt-1 text-xs text-slate-500">The signals that decide whether this framework is strengthening or weakening.</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {playbook.thesisTests.map((t) => (
                <div key={t.test} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
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
          </div>

          {/* H — Scenario map */}
          <div id="scenarios" className="mt-6 scroll-mt-2">
            <SectionLabel>Scenario map</SectionLabel>
            <div className="mt-2.5 space-y-2">
              {playbook.scenarios.map((s) => {
                const tone = s.kind === "Best case" ? "border-up/20 bg-up/5" : s.kind === "Worst case" ? "border-down/20 bg-down/5" : "border-white/[0.08] bg-white/[0.02]";
                const kindColor = s.kind === "Best case" ? "text-up" : s.kind === "Worst case" ? "text-down" : "text-slate-400";
                const worst = s.kind === "Worst case";
                return (
                  <div key={s.kind} className={`rounded-xl border p-3.5 ${tone}`}>
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
          </div>

          {/* I — Bull road vs bear road */}
          <div id="roads" className="mt-6 scroll-mt-2">
            <SectionLabel>Bull road vs bear road</SectionLabel>
            <div className="mt-2.5 space-y-2">
              <Road steps={playbook.bullRoad} tone="up" />
              <Road steps={playbook.bearRoad} tone="down" />
            </div>
          </div>

          {/* J — Source pack — inspectable evidence, one card per source */}
          <div id="sources" className="mt-6 scroll-mt-2">
            <SectionLabel>Source pack</SectionLabel>
            <p className="mt-1 text-xs text-slate-500">External and reference sources — what each one checks, and the thesis test it informs.</p>
            <div className="mt-2.5 space-y-2">
              {playbook.sourcePack.map((s) => (
                <div key={s.title} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
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
                  {s.why ? (
                    <p className="mt-2 text-[0.72rem] leading-relaxed text-slate-400">{s.why}</p>
                  ) : null}
                  <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-2.5">
                    {s.usedIn ? (
                      <button
                        type="button"
                        onClick={() => go("thesis-tests")}
                        className="text-left text-[0.68rem] text-slate-400 transition hover:text-white"
                      >
                        <span className="text-teal/80">Use in thesis test: </span>
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
                        className="flex-none text-[0.68rem] font-medium text-gold/80 hover:text-gold"
                      >
                        Open sources →
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="my-6 h-px bg-white/[0.06]" />

          {/* K — Related Quantifi Ideas — internal links, kept separate */}
          <div id="related" className="scroll-mt-2">
            <SectionLabel>Related Quantifi Ideas</SectionLabel>
            <p className="mt-1 text-xs text-slate-500">Internal research themes this framework connects to.</p>
            <div className="mt-2.5 space-y-2">
              {playbook.linkedIdeas.map((idea) => (
                <Link
                  key={idea.ideaId}
                  href={`/ideas?theme=${encodeURIComponent(idea.ideaId)}`}
                  className="group block rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 transition hover:border-gold/40"
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
          </div>

          <p className="mt-6 border-t border-white/[0.06] pt-4 text-xs text-slate-500">
            Framework analysis only — a research decoder, not a recommendation. Not investment advice.
          </p>
        </div>
      </div>
    </div>
  );
}
