import { getPulse } from "@/lib/marketPulse";
import PulseStrip from "@/components/quantifi/PulseStrip";
export type { PulseEntry } from "@/lib/marketPulse";

// Placeholder shown while the quotes are in flight. It mirrors the real strip's
// three rows at the same heights, so the nav bar and everything under it sit
// exactly where they will end up — a shorter fallback would let the whole page
// jump downward the moment the quotes land.
export function MarketPulseSkeleton() {
  return (
    <section className="border-y border-white/[0.06] bg-ink-900/50" aria-hidden="true">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="my-2.5 flex items-center gap-3 rounded-lg border border-white/[0.06] bg-gradient-to-r from-white/[0.04] to-transparent px-3 py-2.5">
          <div className="h-5 flex-1 animate-pulse rounded bg-white/[0.05]" />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.04] py-3">
          <span className="h-4 w-28 animate-pulse rounded bg-white/[0.05]" />
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <span key={i} className="h-6 w-20 animate-pulse rounded-full bg-white/[0.04]" />
          ))}
        </div>
        <div className="flex items-center gap-x-2 border-t border-white/[0.04] py-2 text-[0.62rem]">
          <span className="h-3 w-72 animate-pulse rounded bg-white/[0.04]" />
        </div>
      </div>
    </section>
  );
}

export default async function MarketPulse() {
  // Rendered on the server for the first paint — no empty strip, no layout
  // shift — then handed to a client component that keeps it current. The server
  // value is a STARTING POINT, not the value for the lifetime of the page,
  // which is what it used to be.
  const initial = await getPulse();
  return <PulseStrip initial={initial} />;
}
