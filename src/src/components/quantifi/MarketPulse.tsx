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
        <div className="flex items-center gap-4 py-3">
          <span className="flex shrink-0 items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-gold">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                live ? "animate-pulseDot bg-up" : "bg-slate-500"
              }`}
            />
            Market Pulse
            <span
              className={`rounded-full border px-1.5 py-0.5 text-[0.55rem] tracking-[0.12em] ${
                live
                  ? "border-up/30 bg-up/10 text-up"
                  : "border-white/10 bg-white/[0.03] text-slate-500"
              }`}
            >
              {live ? "LIVE" : "DELAYED"}
            </span>
          </span>
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
              <span
                key={q.ticker}
                className={`chip font-mono tnum ${up ? "text-up" : "text-down"}`}
                title={q.price ? `$${fmtPrice(q.price)}` : q.ticker}
              >
                {q.ticker}
                <span>{fmtPct(q.changePct)}</span>
              </span>
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
