"use client";

import Link from "next/link";
import { useState } from "react";
import { GlassCard, SectionHeading, Tag } from "@/components/quantifi/Cards";
import { rareFinds, investmentPlans, type Conviction, type RareFind } from "@/data/rareFinds";

const tone = (c: Conviction): "teal" | "gold" | "down" =>
  c === "High" ? "teal" : c === "Medium" ? "gold" : "down";

const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n}%`;

// The upside / base / downside scenario range — an illustrative visual, not a
// price target. The track runs from the downside return to the upside return,
// with "today" (0%) and the base case marked.
function ScenarioRange({ find }: { find: RareFind }) {
  const { downside, base, upside } = find.scenarios;
  const min = Math.min(downside.pct, 0);
  const max = Math.max(upside.pct, 0);
  const span = max - min || 1;
  const pos = (x: number) => `${((x - min) / span) * 100}%`;

  return (
    <div>
      <div className="flex items-center justify-between text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
        <span>Illustrative 2–3yr scenario range</span>
        <span className="text-slate-600">not a forecast</span>
      </div>

      {/* Range bar */}
      <div className="relative mt-5 mb-1 h-2 rounded-full bg-gradient-to-r from-down/50 via-white/10 to-up/50">
        {/* today (0%) */}
        <span className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-white/70" style={{ left: pos(0) }} />
        <span className="absolute -top-5 -translate-x-1/2 text-[0.55rem] text-slate-400" style={{ left: pos(0) }}>
          Today
        </span>
        {/* base case */}
        <span className="absolute -bottom-1 h-4 w-1 -translate-x-1/2 rounded bg-gold" style={{ left: pos(base.pct) }} />
        <span className="absolute -bottom-6 -translate-x-1/2 whitespace-nowrap text-[0.55rem] font-medium text-gold" style={{ left: pos(base.pct) }}>
          Base {fmtPct(base.pct)}
        </span>
      </div>
      <div className="mt-6 flex items-center justify-between text-[0.62rem]">
        <span className="text-down">Downside {fmtPct(downside.pct)}</span>
        <span className="text-up">Upside {fmtPct(upside.pct)}</span>
      </div>

      {/* Scenario notes */}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {[
          { label: "Downside", s: downside, cls: "border-down/25 bg-down/[0.06]", txt: "text-down" },
          { label: "Base case", s: base, cls: "border-white/[0.08] bg-white/[0.02]", txt: "text-slate-300" },
          { label: "Upside", s: upside, cls: "border-up/25 bg-up/[0.06]", txt: "text-up" },
        ].map((row) => (
          <div key={row.label} className={`rounded-lg border p-2.5 ${row.cls}`}>
            <div className="flex items-center justify-between">
              <span className="text-[0.58rem] uppercase tracking-[0.12em] text-slate-500">{row.label}</span>
              <span className={`font-mono text-xs font-semibold ${row.txt}`}>{fmtPct(row.s.pct)}</span>
            </div>
            <p className="mt-1 text-[0.7rem] leading-relaxed text-slate-400">{row.s.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RareFinds() {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Rare Finds"
        title="Undervalued, with room to run"
        subtitle="Names screening below fair value or with outsized potential — tap any card for why it's a rare find and an illustrative upside / base / downside range."
      />

      {/* AI bubble framing */}
      <GlassCard className="mt-6 border-gold/20 bg-gold/[0.05] p-5">
        <div className="text-[0.62rem] uppercase tracking-[0.16em] text-gold/80">The backdrop · AI bubble watch</div>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">
          Heading into 2026, an AI-driven valuation crash is the single most-cited market risk —
          roughly half to a majority of surveyed fund managers now call AI the market&apos;s biggest tail
          risk, with the mega-cap leaders seen as the most exposed. At the same time, value and
          small-cap names sit well below fair value. The plans below lean into that split: stay
          exposed to the real AI build-out, but with ballast underneath if the froth comes off.
          It&apos;s a debate, not a forecast — timing a bubble is notoriously hard.
        </p>
      </GlassCard>

      {/* Rare Finds grid */}
      <h3 className="mt-10 font-display text-lg font-semibold text-white">The watchlist</h3>
      <p className="mt-1 text-xs text-slate-500">Tap a card to see why it&apos;s a rare find and its scenario range.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rareFinds.map((f) => {
          const isOpen = open === f.ticker;
          return (
            <GlassCard
              key={f.ticker}
              className={`flex h-full cursor-pointer flex-col p-5 transition ${isOpen ? "sm:col-span-2 lg:col-span-3 border-gold/30" : "hover:border-white/20"}`}
              onClick={() => setOpen(isOpen ? null : f.ticker)}
            >
              <div className="flex items-center justify-between gap-2">
                <Link
                  href={`/stock-analysis?symbol=${f.ticker}`}
                  onClick={(e) => e.stopPropagation()}
                  className="font-mono text-sm text-white hover:text-gold"
                >
                  {f.ticker}
                </Link>
                <Tag tone={tone(f.conviction)}>{f.conviction}</Tag>
              </div>
              <div className="mt-0.5 text-xs text-slate-400">{f.name}</div>
              <div className="mt-2 text-[0.7rem] uppercase tracking-[0.12em] text-teal">{f.tag}</div>
              <p className="mt-2 text-xs leading-relaxed text-slate-300">{f.thesis}</p>
              <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2">
                <span className="text-[0.62rem] uppercase tracking-[0.12em] text-slate-500">Signal</span>
                <p className="mt-0.5 text-xs text-slate-300">{f.signal}</p>
              </div>

              {!isOpen ? (
                <div className="mt-auto flex items-center justify-between pt-3">
                  <div>
                    <span className="text-[0.62rem] uppercase tracking-[0.12em] text-down/80">Risk</span>
                    <p className="mt-0.5 text-xs text-slate-400">{f.risk}</p>
                  </div>
                  <span className="ml-3 flex-none self-end text-[0.7rem] font-medium text-gold/80">Why it&apos;s rare →</span>
                </div>
              ) : (
                <div className="mt-4 grid gap-5 border-t border-white/[0.08] pt-4 lg:grid-cols-2">
                  <div>
                    <span className="text-[0.62rem] uppercase tracking-[0.14em] text-gold/80">Why it&apos;s a rare find</span>
                    <ul className="mt-2 space-y-1.5">
                      {f.reasons.map((r) => (
                        <li key={r} className="flex gap-2 text-xs leading-relaxed text-slate-300">
                          <span className="mt-0.5 flex-none text-gold">›</span>
                          <span>{r}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-4">
                      <span className="text-[0.62rem] uppercase tracking-[0.12em] text-down/80">Main risk</span>
                      <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{f.risk}</p>
                    </div>
                    <Link
                      href={`/stock-analysis?symbol=${f.ticker}`}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-3 inline-block text-[0.72rem] text-gold underline-offset-2 hover:underline"
                    >
                      Open full analysis →
                    </Link>
                  </div>
                  <ScenarioRange find={f} />
                </div>
              )}
            </GlassCard>
          );
        })}
      </div>

      {/* Investment plans */}
      <h3 className="mt-12 font-display text-lg font-semibold text-white">2–3 year plans</h3>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {investmentPlans.map((p) => (
          <GlassCard key={p.id} className="flex h-full flex-col p-6">
            <div className="flex items-center justify-between gap-2">
              <h4 className="font-display text-base font-semibold text-white">{p.title}</h4>
              <Tag tone="gold">{p.horizon}</Tag>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-300">{p.thesis}</p>

            <div className="mt-4 rounded-lg border border-gold/15 bg-gold/[0.05] px-4 py-3">
              <span className="text-[0.62rem] uppercase tracking-[0.14em] text-gold/80">If the AI bubble pops</span>
              <p className="mt-1 text-sm leading-relaxed text-slate-200">{p.bubbleAngle}</p>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <span className="text-[0.62rem] uppercase tracking-[0.12em] text-teal">What to watch</span>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-300">{p.watch}</p>
              </div>
              <div>
                <span className="text-[0.62rem] uppercase tracking-[0.12em] text-down/80">Main risk</span>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{p.risk}</p>
              </div>
            </div>

            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              {p.tickers.map((t) => (
                <Link key={t} href={`/stock-analysis?symbol=${t}`}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 font-mono text-xs text-slate-300 transition hover:border-gold/40 hover:text-white">
                  {t}
                </Link>
              ))}
            </div>
          </GlassCard>
        ))}
      </div>

      <p className="mt-8 text-xs leading-relaxed text-slate-500">
        Educational research only — not investment advice, and not personalized to your situation.
        The scenario ranges are illustrative study cases, not price targets or forecasts. Every name
        here carries real risk, valuations and fair-value estimates move daily, and the AI-bubble
        scenario is one view among many. Do your own work before acting on anything.
      </p>
    </section>
  );
}
