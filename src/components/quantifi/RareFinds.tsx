import Link from "next/link";
import { GlassCard, SectionHeading, Tag } from "@/components/quantifi/Cards";
import { rareFinds, investmentPlans, type Conviction } from "@/data/rareFinds";

const tone = (c: Conviction): "teal" | "gold" | "down" =>
  c === "High" ? "teal" : c === "Medium" ? "gold" : "down";

export default function RareFinds() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Rare Finds"
        title="Undervalued, with room to run"
        subtitle="Names screening below fair value or with outsized potential — and a few 2–3 year plans built around the one debate dominating markets: is AI a bubble?"
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
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {rareFinds.map((f) => (
          <GlassCard key={f.ticker} className="flex h-full flex-col p-5">
            <div className="flex items-center justify-between gap-2">
              <Link href={`/stock-analysis?symbol=${f.ticker}`} className="font-mono text-sm text-white hover:text-gold">
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
            <div className="mt-auto pt-3">
              <span className="text-[0.62rem] uppercase tracking-[0.12em] text-down/80">Risk</span>
              <p className="mt-0.5 text-xs text-slate-400">{f.risk}</p>
            </div>
          </GlassCard>
        ))}
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
        Every name here carries real risk, valuations and fair-value estimates move daily, and the
        AI-bubble scenario is one view among many. Do your own work before acting on anything.
      </p>
    </section>
  );
}
