"use client";

import { useEffect, useState } from "react";

export interface NavSection {
  id: string;
  label: string;
}

// Sticky "on this page" rail for the stock analysis view. It only lists sections
// that actually rendered (several return null when a stock has no data for them),
// re-checking after the async fundamentals load, and highlights the section you're
// currently reading via an IntersectionObserver. Clicking scrolls to it.
export default function StockSectionNav({ sections }: { sections: NavSection[] }) {
  const [present, setPresent] = useState<NavSection[]>([]);
  const [active, setActive] = useState<string>("");

  // Which sections actually have content on screen right now.
  useEffect(() => {
    const check = () => {
      const p = sections.filter((s) => {
        const el = document.getElementById(s.id);
        return el != null && el.offsetHeight > 60;
      });
      setPresent(p);
      setActive((a) => (p.some((s) => s.id === a) ? a : p[0]?.id ?? ""));
    };
    check();
    // Fundamentals/ownership/peers load async — re-measure a couple of times.
    const timers = [500, 1200, 2500, 4500].map((ms) => setTimeout(check, ms));
    return () => timers.forEach(clearTimeout);
  }, [sections]);

  // Scroll-spy: highlight the topmost section within the reading band.
  useEffect(() => {
    if (!present.length) return;
    const els = present
      .map((s) => document.getElementById(s.id))
      .filter((e): e is HTMLElement => e != null);
    const obs = new IntersectionObserver(
      (entries) => {
        const vis = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (vis[0]) setActive(vis[0].target.id);
      },
      { rootMargin: "-15% 0px -75% 0px", threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [present]);

  const jump = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (!present.length) return null;

  return (
    <nav className="sticky top-24 hidden py-8 lg:block">
      <p className="mb-2 pl-3 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
        On this page
      </p>
      <ul className="border-l border-white/[0.08]">
        {present.map((s, i) => {
          const on = active === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => jump(s.id)}
                className={`-ml-px flex w-full items-center gap-2 border-l-2 py-1.5 pl-3 pr-2 text-left text-[0.82rem] transition ${
                  on ? "border-gold text-white" : "border-transparent text-slate-400 hover:text-white"
                }`}
              >
                <span className={`w-3 flex-none text-right font-mono text-[0.65rem] ${on ? "text-gold" : "text-slate-600"}`}>
                  {i + 1}
                </span>
                <span className="truncate">{s.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
