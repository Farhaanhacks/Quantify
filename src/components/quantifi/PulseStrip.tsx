"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { fmtPct, fmtPrice } from "@/data/demo";
import type { PulseEntry, MoverEntry } from "@/lib/marketPulse";

interface Pulse {
  pulse: PulseEntry[];
  movers: MoverEntry[];
  live: boolean;
  asOf: string;
}

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

// The market strip, kept current.
//
// The bug this fixes: the whole thing was a server component. It rendered once,
// with whatever the quotes were at that moment, and then never changed —
// while the marquee animation kept sliding, which is precisely what makes a
// frozen ticker look like a working one. A page left open for an afternoon
// showed the morning's market under the words "last updated".
//
// So the server still renders the first values (no empty bar, no layout shift)
// and this refreshes them on a timer.
const REFRESH_MS = 60_000;

export default function PulseStrip({ initial }: { initial: Pulse }) {
  const [data, setData] = useState<Pulse>(initial);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      // Nothing to refresh into a hidden tab. Browsers throttle timers there
      // anyway, and polling a market feed for a tab nobody is looking at is
      // upstream traffic for no reader.
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const r = await fetch("/api/pulse", { cache: "no-store" });
        if (!r.ok) return;
        const d = (await r.json()) as Pulse & { ok?: boolean };
        // Keep the last good values on a bad response rather than blanking the
        // bar: a momentary upstream failure should not erase the market.
        if (!cancelled && d?.ok !== false && Array.isArray(d.pulse) && d.pulse.length) {
          setData({ pulse: d.pulse, movers: d.movers ?? [], live: d.live, asOf: d.asOf });
        }
      } catch {
        /* keep showing the last values */
      }
    };

    const id = setInterval(load, REFRESH_MS);
    // Refresh immediately when someone comes back to the tab, so returning to a
    // page never shows a stale figure for up to a minute.
    const onVisible = () => {
      if (!document.hidden) void load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  const { pulse, movers, live, asOf } = data;

  return (
    <section className="border-y border-white/[0.06] bg-ink-900/50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="my-2.5 flex items-center gap-3 rounded-lg border border-white/[0.06] bg-gradient-to-r from-white/[0.04] to-transparent px-3 py-2.5">
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
                className={`chip font-mono tnum transition hover:border-white/25 hover:brightness-125 ${up ? "text-up" : "text-down"}`}
                title={`Open ${q.ticker} analysis${q.price ? ` · $${fmtPrice(q.price)}` : ""}`}
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
              Live market data · last updated <span className="text-slate-400">{asOf}</span>
            </span>
          ) : (
            <span className="text-slate-400">
              Live feed temporarily unavailable. Showing last-known reference values.
            </span>
          )}
          <span className="text-slate-600">·</span>
          <span>Quotes may be delayed up to ~15 minutes. For research only, not trading.</span>
        </div>
      </div>
    </section>
  );
}
