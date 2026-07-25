import Link from "next/link";
import { fmtPct, fmtPrice } from "@/data/demo";
import { getPulse, type PulseEntry } from "@/lib/marketPulse";

function PulseRow({ items }: { items: PulseEntry[] }) {
  // Duplicate the list so the marquee loops seamlessly (-50% translate).
  const loop = [...items, ...items];
  return (
    <div className="flex w-max animate-marquee items-center gap-6 pr-6">
      {loop.map((m, i) => {
        const up = m.changePct >= 0;
        return (
          <div key={`${m.label}-${i}`} className="flex items-center gap-2 whitespace-nowrap">
            <span className="text-xs font-medium text-slate-300">{m.label}</span>
            <span className="font-mono text-xs tnum text-white">{m.value}</span>
            <span className={`font-mono text-xs tnum ${up ? "text-up" : "text-down"}`}>
              {fmtPct(m.changePct)}
            </span>
            <span className="ml-2 h-3 w-px bg-white/10" />
          </div>
        );
      })}
    </div>
  );
}

export default async function MarketPulse() {
  const { pulse, movers, live, asOf } = await getPulse();

  return (
    <section className="border-y border-white/[0.06] bg-ink-900/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* The scrolling quotes sit in their own inset band with a subtle
            gradient, so the ticker reads as a distinct focus strip rather than
            floating loose text. */}
        <div className="my-2.5 flex items-center gap-3 rounded-xl border border-white/[0.06] bg-gradient-to-r from-white/[0.04] to-transparent px-3 py-2.5">
          <div className="mask-fade-x relative flex-1 overflow-hidden">
            <PulseRow items={pulse} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.04] py-3">
          <span className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
            Today&apos;s movers
          </span>
          {movers.map((q) => {
            const up = q.changePct >= 0;
            return (
              <Link
                key={q.ticker}
                href={`/stock-analysis?symbol=${encodeURIComponent(q.ticker)}`}
                className={`chip font-mono tnum transition-colors hover:border-white/25 hover:bg-white/[0.08] ${up ? "text-up" : "text-down"}`}
                title={q.price ? `View ${q.ticker} analysis · $${fmtPrice(q.price)}` : `View ${q.ticker} analysis`}
              >
                {q.ticker}
                <span>{fmtPct(q.changePct)}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-white/[0.04] py-2 text-[0.62rem] text-slate-500">
          {live ? (
            <span>
              Live market data · last updated{" "}
              <span className="text-slate-400">{asOf}</span>
            </span>
          ) : (
            <span className="text-slate-400">
              Live feed temporarily unavailable — showing last-known reference values.
            </span>
          )}
          <span className="text-slate-600">·</span>
          <span>Quotes may be delayed up to ~15 minutes. For research only, not trading.</span>
        </div>
      </div>
    </section>
  );
}
