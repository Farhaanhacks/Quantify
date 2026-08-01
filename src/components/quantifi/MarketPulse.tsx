import Link from "next/link";
import { fmtPct } from "@/data/demo";
import { getPulse, type PulseEntry } from "@/lib/marketPulse";

// One tape entry. When it maps to a tradeable symbol the whole entry is a link
// into that company's analysis — the movers used to be a second bar of chips
// purely to be clickable; now the single tape carries that.
function PulseItem({ item }: { item: PulseEntry }) {
  const up = item.changePct >= 0;
  const body = (
    <>
      <span className="text-xs font-medium text-slate-300">{item.label}</span>
      <span className="font-mono text-xs tnum text-white">{item.value}</span>
      <span className={`font-mono text-xs tnum ${up ? "text-up" : "text-down"}`}>
        {fmtPct(item.changePct)}
      </span>
      <span className="ml-2 h-3 w-px bg-white/10" />
    </>
  );

  if (!item.symbol) {
    return <div className="flex items-center gap-2 whitespace-nowrap">{body}</div>;
  }
  return (
    <Link
      href={`/stock-analysis?symbol=${encodeURIComponent(item.symbol)}`}
      className="flex items-center gap-2 whitespace-nowrap transition hover:brightness-125"
      title={`Open ${item.label} analysis`}
    >
      {body}
    </Link>
  );
}

function PulseRow({ items }: { items: PulseEntry[] }) {
  // Duplicate the list so the marquee loops seamlessly (-50% translate).
  const loop = [...items, ...items];
  return (
    <div className="flex w-max animate-marquee items-center gap-6 pr-6">
      {loop.map((m, i) => (
        <PulseItem key={`${m.label}-${i}`} item={m} />
      ))}
    </div>
  );
}

export default async function MarketPulse() {
  const { pulse, live, asOf } = await getPulse();

  return (
    <section className="border-b border-white/[0.06] bg-ink-900/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* One strip, not three. Indices and the watched movers share a single
            tape — the old "Today's movers" chip row below this was a second
            ticker bar carrying the same kind of data, and the standalone
            disclaimer band was a third. Both now fold into this line. */}
        <div className="my-2 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-white/[0.06] bg-gradient-to-r from-white/[0.04] to-transparent px-3 py-2">
          <div className="mask-fade-x relative min-w-0 flex-1 overflow-hidden">
            <PulseRow items={pulse} />
          </div>
          {/* On phones the tape needs the whole width, so the provenance note
              drops out rather than eating half the strip. */}
          <span className="hidden flex-none text-[0.6rem] text-slate-500 sm:inline">
            {live ? (
              <>
                Live · <span className="text-slate-400">{asOf}</span> · delayed up to ~15 min,
                research only
              </>
            ) : (
              <span className="text-slate-400">
                Live feed unavailable — last-known reference values.
              </span>
            )}
          </span>
        </div>
      </div>
    </section>
  );
}
