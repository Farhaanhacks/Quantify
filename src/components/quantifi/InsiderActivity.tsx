"use client";

import { useMemo, useState } from "react";
import { GlassCard, SectionHeading, TickerChip, Tag } from "@/components/quantifi/Cards";
import { insiderEvents, insiderTypes, type InsiderType } from "@/data/demo";

function typeTone(t: InsiderType): "up" | "down" | "gold" | "teal" | "neutral" {
  if (t === "Insider Buying" || t === "Pledge Released") return "up";
  if (t === "Insider Selling" || t === "Repeated Selling" || t === "Pledge Created") return "down";
  if (t === "Unusual Activity" || t === "Large Transaction") return "gold";
  return "teal";
}

export default function InsiderActivity({
  showFilter = true,
  limit,
  heading = true,
}: {
  showFilter?: boolean;
  limit?: number;
  heading?: boolean;
}) {
  const [active, setActive] = useState<"All" | InsiderType>("All");

  const filtered = useMemo(() => {
    const list =
      active === "All" ? insiderEvents : insiderEvents.filter((e) => e.type === active);
    return limit ? list.slice(0, limit) : list;
  }, [active, limit]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Insider Activity"
          title="Insider & promoter activity"
          subtitle="Context on who is buying, selling or changing stakes. Useful background — never a signal on its own."
          href="/insider-activity"
          cta="All activity"
        />
      ) : null}

      {showFilter ? (
        <div className="mt-6 flex flex-wrap gap-2">
          {(["All", ...insiderTypes] as ("All" | InsiderType)[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActive(t)}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                active === t
                  ? "border-gold/50 bg-gold/15 text-gold"
                  : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      ) : null}

      <GlassCard className="mt-6 overflow-hidden">
        {/* header row (hidden on mobile) */}
        <div className="hidden grid-cols-[1.4fr_1fr_1.2fr_0.8fr_0.8fr] gap-3 border-b border-white/[0.06] px-5 py-3 text-[0.62rem] uppercase tracking-[0.16em] text-slate-500 lg:grid">
          <span>Company</span>
          <span>Person / role</span>
          <span>Activity</span>
          <span className="text-right">Value</span>
          <span className="text-right">When</span>
        </div>

        <ul className="divide-y divide-white/[0.05]">
          {filtered.map((e) => (
            <li
              key={e.id}
              className="grid grid-cols-2 gap-3 px-5 py-4 lg:grid-cols-[1.4fr_1fr_1.2fr_0.8fr_0.8fr] lg:items-center"
            >
              <div className="flex items-center gap-2.5">
                <TickerChip ticker={e.ticker} />
                <span className="hidden text-sm text-slate-300 sm:inline">{e.company}</span>
              </div>
              <div className="text-xs text-slate-400">
                <div className="text-slate-200">{e.person}</div>
                <div>{e.role}</div>
              </div>
              <div>
                <Tag tone={typeTone(e.type)}>{e.type}</Tag>
                <p className="mt-1 hidden text-[0.7rem] text-slate-500 lg:block">{e.note}</p>
              </div>
              <div className="text-right font-mono text-sm tnum text-white">{e.value}</div>
              <div className="text-right text-xs text-slate-500">{e.date}</div>
            </li>
          ))}
        </ul>

        {filtered.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-slate-500">
            No activity of this type in the demo set. Try another filter.
          </div>
        ) : null}
      </GlassCard>
    </section>
  );
}
