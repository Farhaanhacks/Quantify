import Link from "next/link";
import { GlassCard, ImpactChain, Tag } from "@/components/quantifi/Cards";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 pb-10 pt-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:gap-10 lg:px-8 lg:pb-16 lg:pt-24">
        {/* Left: thesis */}
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300">
            <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-teal" />
            Market-discovery & portfolio intelligence
          </div>

          <h1 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-6xl">
            See what&apos;s moving,
            <br />
            <span className="text-gradient-gold">why it&apos;s moving,</span>
            <br />
            and which stocks are affected.
          </h1>

          <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-400">
            Quantifi turns market news, insider activity, and portfolio risk into clear
            research signals.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/ideas"
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90"
            >
              Explore Ideas
              <span aria-hidden>→</span>
            </Link>
            <Link
              href="/news"
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white transition hover:border-gold/40"
            >
              View News Impact
            </Link>
          </div>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 text-sm text-slate-500">
            <span>
              <span className="font-display text-lg font-semibold text-white">7</span> global markets
            </span>
            <span className="h-4 w-px bg-white/10" />
            <span>
              <span className="font-display text-lg font-semibold text-white">9</span> discovery surfaces
            </span>
            <span className="h-4 w-px bg-white/10" />
            <span>Educational research signals, not advice</span>
          </div>
        </div>

        {/* Right: signature impact chain demo */}
        <GlassCard className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-up" />
              Live impact preview
            </div>
            <Tag tone="gold">Signal</Tag>
          </div>

          <p className="mt-4 text-sm font-medium text-white">
            Hyperscaler raises data-center capex guidance
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Trace how one headline ripples across the market.
          </p>

          <div className="mt-5">
            <ImpactChain
              steps={[
                { label: "Event", value: "Capex ↑", tone: "gold" },
                { label: "Direct", value: "NVDA", tone: "up" },
                { label: "Peer", value: "AMD", tone: "up" },
                { label: "Sector", value: "Semis", tone: "teal" },
                { label: "ETF", value: "SMH", tone: "up" },
              ]}
            />
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2 border-t border-white/[0.06] pt-5">
            {[
              { k: "Affected", v: "5 names" },
              { k: "Sector read", v: "Positive" },
              { k: "Watch items", v: "3 cues" },
            ].map((s) => (
              <div key={s.k}>
                <div className="text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">{s.k}</div>
                <div className="mt-1 text-sm font-medium text-white">{s.v}</div>
              </div>
            ))}
          </div>

          <Link
            href="/news"
            className="mt-5 inline-flex items-center gap-1.5 text-sm text-gold transition hover:gap-2.5"
          >
            Open full news impact
            <span aria-hidden>→</span>
          </Link>
        </GlassCard>
      </div>
    </section>
  );
}
