import { marketPulse, topMovers, fmtPct, fmtPrice } from "@/data/demo";
import { getQuotes, isLiveConfigured } from "@/lib/marketData";

function PulseRow() {
  // Duplicate the list so the marquee loops seamlessly (-50% translate).
  const items = [...marketPulse, ...marketPulse];
  return (
    <div className="flex w-max animate-marquee items-center gap-6 pr-6">
      {items.map((m, i) => {
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
  // Live quotes for the movers strip (falls back to demo automatically).
  const tickers = topMovers.map((m) => m.ticker);
  const quotes = await getQuotes(tickers);
  const live = isLiveConfigured();

  return (
    <section className="border-y border-white/[0.06] bg-ink-900/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 py-3">
          <span className="flex shrink-0 items-center gap-2 text-xs font-medium uppercase tracking-[0.18em] text-gold">
            <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-gold" />
            Market Pulse
          </span>
          <div className="mask-fade-x relative flex-1 overflow-hidden">
            <PulseRow />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.04] py-3">
          <span className="flex items-center gap-2 text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
            Today&apos;s movers
            <span
              className={`rounded-full border px-1.5 py-0.5 text-[0.6rem] tracking-[0.12em] ${
                live
                  ? "border-up/30 bg-up/10 text-up"
                  : "border-white/10 bg-white/[0.03] text-slate-500"
              }`}
            >
              {live ? "LIVE" : "DEMO"}
            </span>
          </span>
          {quotes.map((q) => {
            const up = q.changePct >= 0;
            return (
              <span
                key={q.ticker}
                className={`chip font-mono tnum ${up ? "text-up" : "text-down"}`}
                title={`${q.name} · $${fmtPrice(q.price)}`}
              >
                {q.ticker}
                <span>{fmtPct(q.changePct)}</span>
              </span>
            );
          })}
        </div>
      </div>
    </section>
  );
}
