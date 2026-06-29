"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ExposureGroup, ExposureItem, Playbook } from "@/data/playbooks";

type TabId = "overview" | "map" | "tests" | "scenarios" | "sources";

function signalTone(signal: string): string {
  if (signal === "Strengthening") return "border-up/30 bg-up/10 text-up";
  if (signal === "Weakening") return "border-down/30 bg-down/10 text-down";
  return "border-gold/30 bg-gold/10 text-gold";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[0.62rem] uppercase tracking-[0.18em] text-slate-500">{children}</div>;
}

function Ticker({ symbol, muted = false }: { symbol: string; muted?: boolean }) {
  return (
    <Link
      href={`/stock-analysis?symbol=${encodeURIComponent(symbol)}`}
      className={`rounded-md border px-2 py-0.5 font-mono text-sm transition hover:border-gold/40 hover:text-gold ${
        muted ? "border-white/10 bg-white/[0.02] text-slate-300" : "border-white/10 bg-white/[0.05] text-white"
      }`}
    >
      {symbol}
    </Link>
  );
}

// A single exposure line — the panel colour carries the meaning, so rows stay clean.
function ExposureRow({ item }: { item: ExposureItem }) {
  const tradable = Boolean(item.ticker) && item.assetType !== "private_company";
  return (
    <div className="border-t border-white/[0.06] py-3 first:border-t-0 first:pt-0">
      <div className="flex flex-wrap items-center gap-2">
        {tradable ? (
          <Ticker symbol={item.ticker as string} />
        ) : (
          <span className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-0.5 font-mono text-sm text-slate-400">
            {item.ticker ?? "—"}
          </span>
        )}
        <span className="text-sm font-medium text-white">{item.name}</span>
        {item.assetType === "etf" ? (
          <span className="rounded-full border border-white/15 bg-white/5 px-1.5 py-0.5 text-[0.58rem] text-slate-400">ETF</span>
        ) : null}
        {item.assetType === "private_company" ? (
          <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 text-[0.58rem] text-amber-300">
            Not directly tradable
          </span>
        ) : !item.isDirectExposure ? (
          <span className="rounded-full border border-amber-400/25 bg-amber-400/[0.07] px-1.5 py-0.5 text-[0.58rem] text-amber-300/90">
            Indirect
          </span>
        ) : null}
        {item.conviction ? (
          <span className="ml-auto text-[0.58rem] uppercase tracking-wide text-slate-600">{item.conviction}</span>
        ) : null}
      </div>
      <p className="mt-1.5 text-[0.8rem] leading-relaxed text-slate-400">{item.explanation}</p>
    </div>
  );
}

function group(groups: ExposureGroup[] | undefined, key: ExposureGroup["key"]) {
  return groups?.find((g) => g.key === key);
}

export default function PlaybookPage({ playbook }: { playbook: Playbook }) {
  const [tab, setTab] = useState<TabId>("overview");

  const title = playbook.memoTitle ?? playbook.title;
  const subtitle = playbook.memoSubtitle ?? playbook.subtitle;

  const longG = group(playbook.exposure, "long");
  const shortG = group(playbook.exposure, "short");
  const privateG = group(playbook.exposure, "private");
  const proxyG = group(playbook.exposure, "proxy");
  const etfG = group(playbook.exposure, "etf");

  const beneficiaries = useMemo(() => longG?.items.map((i) => i.ticker).filter(Boolean) as string[] | undefined, [longG]);
  const risks = useMemo(() => shortG?.items.map((i) => i.ticker).filter(Boolean) as string[] | undefined, [shortG]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "map", label: "Investment Map" },
    { id: "tests", label: "Thesis Tests" },
    { id: "scenarios", label: "Scenarios" },
    { id: "sources", label: "Sources" },
  ];

  const badges = [
    { k: "Time horizon", v: playbook.timeHorizon },
    { k: "Risk lens", v: playbook.riskLens },
    { k: "Style", v: playbook.styleTag ?? playbook.bestFor },
    { k: "Type", v: "Curated research, not a recommendation" },
  ];

  return (
    <div className="min-h-screen">
      {/* ── Memo hero header ── */}
      <header className="border-b border-white/[0.08] bg-gradient-to-b from-ink-800/60 to-transparent">
        <div className="mx-auto max-w-5xl px-4 pt-7 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full border border-teal/30 bg-teal/10 px-2.5 py-0.5 text-[0.62rem] font-medium uppercase tracking-wide text-teal">
              {playbook.type}
            </span>
            <Link
              href="/community"
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-slate-300 transition hover:border-white/30 hover:text-white"
            >
              ← Back
            </Link>
          </div>
          <h1 className="mt-4 max-w-3xl font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400 sm:text-base">{subtitle}</p>

          <div className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {badges.map((b) => (
              <div key={b.k} className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-3 py-2">
                <div className="text-[0.55rem] uppercase tracking-[0.16em] text-slate-500">{b.k}</div>
                <div className="mt-0.5 text-[0.8rem] font-medium leading-snug text-slate-200">{b.v}</div>
              </div>
            ))}
          </div>
          {playbook.lastUpdated ? (
            <p className="mt-3 text-[0.7rem] text-slate-500">Last updated {playbook.lastUpdated}</p>
          ) : null}
        </div>

        {/* Sticky tab bar */}
        <div className="sticky top-0 z-40 mt-5 border-t border-white/[0.06] bg-ink-900/85 backdrop-blur-md">
          <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`whitespace-nowrap border-b-2 px-3.5 py-3 text-sm transition ${
                  tab === t.id ? "border-gold font-medium text-white" : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* ── Always-visible thesis + so-what (the 10-second read) ── */}
      <div className="mx-auto max-w-5xl px-4 pt-7 sm:px-6 lg:px-8">
        {playbook.oneLineThesis ? (
          <div className="rounded-2xl border border-gold/25 bg-gold/[0.06] p-5 sm:p-6">
            <SectionLabel>Core thesis</SectionLabel>
            <p className="mt-2 text-base font-medium leading-relaxed text-white sm:text-lg">{playbook.oneLineThesis}</p>
          </div>
        ) : null}
        {playbook.soWhat ? (
          <div className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
            <SectionLabel>So what does this mean for investors?</SectionLabel>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">{playbook.soWhat}</p>
          </div>
        ) : null}
      </div>

      {/* ── Tab panels ── */}
      <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6 lg:px-8">
        {tab === "overview" ? (
          <div className="space-y-6">
            {playbook.whatChanged?.length ? (
              <section className="rounded-2xl border border-teal/20 bg-teal/[0.05] p-5">
                <SectionLabel>What changed recently</SectionLabel>
                <ul className="mt-2.5 space-y-1.5">
                  {playbook.whatChanged.map((c) => (
                    <li key={c} className="flex gap-2 text-sm leading-relaxed text-slate-300">
                      <span className="mt-0.5 flex-none text-teal">›</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}

            <div className="grid gap-4 lg:grid-cols-2">
              <section className="rounded-2xl border border-up/20 bg-up/5 p-5">
                <div className="text-[0.62rem] uppercase tracking-[0.18em] text-up/80">Bull case</div>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{playbook.bullCase}</p>
                {beneficiaries?.length ? (
                  <div className="mt-4">
                    <div className="text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">Key beneficiaries</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {beneficiaries.map((t) => <Ticker key={t} symbol={t} muted />)}
                    </div>
                  </div>
                ) : null}
              </section>

              <section className="rounded-2xl border border-down/20 bg-down/5 p-5">
                <div className="text-[0.62rem] uppercase tracking-[0.18em] text-down/80">Bear case</div>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">{playbook.bearCase}</p>
                {risks?.length ? (
                  <div className="mt-4">
                    <div className="text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">Key de-rating risks</div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {risks.map((t) => <Ticker key={t} symbol={t} muted />)}
                    </div>
                  </div>
                ) : null}
              </section>
            </div>

            <p className="text-xs text-slate-500">
              Want the full positioning — long vs bearish vs private vs proxy vs ETF? Open the{" "}
              <button type="button" onClick={() => setTab("map")} className="text-gold underline-offset-2 hover:underline">
                Investment Map
              </button>
              .
            </p>
          </div>
        ) : null}

        {tab === "map" && playbook.exposure?.length ? (
          <div className="space-y-5">
            <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 text-[0.78rem] leading-relaxed text-slate-400">
              Thematic exposure, not recommendations or fund holdings. Bullish, bearish, private and proxy
              exposure are shown separately on purpose — a name central to the theme is not automatically a
              long.
            </p>

            {/* Beneficiaries vs Bearish — the core split, side by side */}
            <div className="grid gap-4 lg:grid-cols-2">
              {longG ? (
                <section className="rounded-2xl border border-up/25 bg-up/[0.06] p-5">
                  <h3 className="font-display text-lg font-semibold text-up">{longG.title}</h3>
                  <p className="mt-1 text-[0.75rem] leading-relaxed text-slate-400">{longG.note}</p>
                  <div className="mt-3">
                    {longG.items.map((it) => <ExposureRow key={it.name} item={it} />)}
                  </div>
                </section>
              ) : null}

              {shortG ? (
                <section className="rounded-2xl border border-down/25 bg-down/[0.06] p-5">
                  <h3 className="font-display text-lg font-semibold text-down">{shortG.title}</h3>
                  <p className="mt-1 text-[0.75rem] leading-relaxed text-slate-400">{shortG.note}</p>
                  <div className="mt-3">
                    {shortG.items.map((it) => <ExposureRow key={it.name} item={it} />)}
                  </div>
                </section>
              ) : null}
            </div>

            {/* Private AI lab exposure — visually central */}
            {privateG ? (
              <section className="rounded-2xl border border-violet-400/30 bg-violet-400/[0.07] p-5 sm:p-6">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-display text-lg font-semibold text-violet-200">{privateG.title}</h3>
                  <span className="rounded-full border border-violet-400/40 bg-violet-400/10 px-2 py-0.5 text-[0.58rem] uppercase tracking-wide text-violet-200">
                    Private · not directly tradable
                  </span>
                </div>
                <p className="mt-1 text-[0.78rem] leading-relaxed text-slate-300">{privateG.note}</p>

                {/* Lead callout = first private name (Anthropic) */}
                {privateG.items[0] ? (
                  <div className="mt-4 rounded-xl border border-violet-400/25 bg-ink-900/40 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-base font-semibold text-white">{privateG.items[0].name}</span>
                      <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[0.58rem] text-amber-300">
                        Private — not directly tradable
                      </span>
                    </div>
                    <p className="mt-2 text-[0.82rem] leading-relaxed text-slate-300">{privateG.items[0].explanation}</p>
                    {privateG.items[0].sourceUrl ? (
                      <a href={privateG.items[0].sourceUrl} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-block text-[0.68rem] text-gold/80 hover:text-gold">
                        Source →
                      </a>
                    ) : null}
                  </div>
                ) : null}

                {/* Remaining private labs */}
                {privateG.items.length > 1 ? (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {privateG.items.slice(1).map((it) => (
                      <div key={it.name} className="rounded-xl border border-white/[0.06] bg-ink-900/30 p-3.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-semibold text-white">{it.name}</span>
                          <span className="rounded-full border border-amber-400/25 bg-amber-400/[0.07] px-1.5 py-0.5 text-[0.55rem] text-amber-300/90">Not tradable</span>
                        </div>
                        <p className="mt-1.5 text-[0.78rem] leading-relaxed text-slate-400">{it.explanation}</p>
                      </div>
                    ))}
                  </div>
                ) : null}

                {/* Public proxies to the private labs */}
                {proxyG ? (
                  <div className="mt-4 border-t border-violet-400/20 pt-4">
                    <div className="text-[0.6rem] uppercase tracking-[0.16em] text-slate-400">Public-market proxies (indirect)</div>
                    <p className="mt-1 text-[0.72rem] leading-relaxed text-slate-500">{proxyG.note}</p>
                    <div className="mt-2.5">
                      {proxyG.items.map((it) => <ExposureRow key={it.name} item={it} />)}
                    </div>
                  </div>
                ) : null}
              </section>
            ) : null}

            {/* ETF basket — last, clearly indirect */}
            {etfG ? (
              <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5">
                <h3 className="font-display text-base font-semibold text-slate-200">{etfG.title}</h3>
                <p className="mt-1 text-[0.75rem] leading-relaxed text-slate-500">{etfG.note}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {etfG.items.map((it) => (
                    <div key={it.name} className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2.5 py-1.5">
                      {it.ticker ? <Ticker symbol={it.ticker} muted /> : null}
                      <span className="text-[0.72rem] text-slate-400">{it.name}</span>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        ) : null}

        {tab === "tests" ? (
          <section>
            <SectionLabel>Thesis tests</SectionLabel>
            <p className="mt-1 text-xs text-slate-500">The signals that decide whether this framework is strengthening or weakening.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {playbook.thesisTests.map((t) => (
                <div key={t.test} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-medium text-white">{t.test}</span>
                    <span className={`flex-none rounded-full border px-2 py-0.5 text-[0.62rem] font-semibold uppercase tracking-wide ${signalTone(t.signal)}`}>
                      {t.signal}
                    </span>
                  </div>
                  <p className="mt-2.5 text-[0.76rem] leading-relaxed text-slate-400">
                    <span className="text-teal/80">Confirms if: </span>{t.metric}
                  </p>
                  <p className="mt-1 text-[0.76rem] leading-relaxed text-slate-400">
                    <span className="text-down/80">Breaks if: </span>{t.breaksIf}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "scenarios" ? (
          <section>
            <SectionLabel>Scenario map</SectionLabel>
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              {playbook.scenarios.map((s) => {
                const tone = s.kind === "Best case" ? "border-up/25 bg-up/[0.06]" : s.kind === "Worst case" ? "border-down/25 bg-down/[0.06]" : "border-white/[0.08] bg-white/[0.02]";
                const kindColor = s.kind === "Best case" ? "text-up" : s.kind === "Worst case" ? "text-down" : "text-slate-300";
                const worst = s.kind === "Worst case";
                return (
                  <div key={s.kind} className={`rounded-2xl border p-4 ${tone}`}>
                    <span className={`text-[0.72rem] font-semibold uppercase tracking-wide ${kindColor}`}>{s.kind}</span>
                    <p className="mt-2 text-sm leading-relaxed text-slate-200">{s.what}</p>
                    <div className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
                      <p className="text-xs leading-relaxed text-slate-300">
                        <span className={`font-medium ${worst ? "text-slate-300" : "text-up/90"}`}>{worst ? "Most resilient: " : "Likely beneficiaries: "}</span>
                        {s.beneficiaries}
                      </p>
                      <p className="text-xs leading-relaxed text-slate-300">
                        <span className="font-medium text-down/90">Red flag: </span>{s.redFlag}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bull / bear road kept compact under scenarios */}
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              {([["Bull road", playbook.bullRoad, "up"], ["Bear road", playbook.bearRoad, "down"]] as const).map(([label, steps, tone]) => (
                <div key={label} className={`rounded-2xl border p-4 ${tone === "up" ? "border-up/20 bg-up/5" : "border-down/20 bg-down/5"}`}>
                  <div className={`text-[0.62rem] uppercase tracking-[0.16em] ${tone === "up" ? "text-up/80" : "text-down/80"}`}>{label}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1.5">
                    {steps.map((s, i) => (
                      <span key={s} className="flex items-center gap-1.5">
                        <span className={`rounded-md border px-2 py-1 text-xs ${i === steps.length - 1 ? (tone === "up" ? "border-up/50 bg-up/15 font-semibold text-up" : "border-down/50 bg-down/15 font-semibold text-down") : "border-white/[0.08] bg-white/[0.03] text-slate-200"}`}>{s}</span>
                        {i < steps.length - 1 ? <span className={`text-xs ${tone === "up" ? "text-up" : "text-down"}`} aria-hidden>→</span> : null}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {tab === "sources" ? (
          <section className="space-y-5">
            <div>
              <SectionLabel>Source pack</SectionLabel>
              <p className="mt-1 text-xs text-slate-500">External and reference sources — what each checks, and the thesis test it informs.</p>
              <div className="mt-3 grid gap-3 lg:grid-cols-2">
                {playbook.sourcePack.map((s) => (
                  <div key={s.title} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
                    <div className="text-sm font-semibold text-white">{s.title}</div>
                    <p className="mt-1 text-[0.74rem] leading-relaxed text-slate-400">
                      <span className="text-slate-500">Checks: </span>{s.checks}
                    </p>
                    {s.why ? <p className="mt-2 text-[0.74rem] leading-relaxed text-slate-400">{s.why}</p> : null}
                    {s.href ? (
                      <a href={s.href} target="_blank" rel="noopener noreferrer" className="mt-2.5 inline-block text-[0.7rem] font-medium text-gold/80 hover:text-gold">
                        Open source →
                      </a>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <SectionLabel>Related Quantifi Ideas</SectionLabel>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {playbook.linkedIdeas.map((idea) => (
                  <Link key={idea.ideaId} href={`/ideas?theme=${encodeURIComponent(idea.ideaId)}`} className="group block rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition hover:border-gold/40">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-white">{idea.title}</span>
                      <span className="flex-none text-[0.7rem] font-medium text-gold/80 transition group-hover:text-gold">Open theme →</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{idea.whyLinked}</p>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <p className="mt-8 border-t border-white/[0.06] pt-5 text-xs text-slate-500">
          Curated research / editorial — a framework decoder, not a recommendation or a live market signal.
          Exposure types (beneficiary, bearish, private, proxy, ETF) are research classifications, not advice.
          Not investment advice.
        </p>
      </div>
    </div>
  );
}
