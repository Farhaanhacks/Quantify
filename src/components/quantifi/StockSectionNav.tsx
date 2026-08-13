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

  // Scroll-spy: which section is the reader actually in?
  //
  // This used an IntersectionObserver over a narrow band (15%–25% of the
  // viewport) and highlighted the topmost entry in the callback. Two faults,
  // both of which showed as the wrong item staying lit:
  //
  //   - The callback only receives entries whose intersection CHANGED, not
  //     everything currently visible. Picking the topmost of those picks the
  //     topmost of a partial list.
  //   - A section taller than the band never intersects it once its top has
  //     scrolled past. Nothing fires, so whichever section last touched the
  //     band stays highlighted — which is how reading Valuation left "My notes"
  //     lit from an earlier scroll.
  //
  // Position is what the question was always about, so it is now measured
  // directly: the active section is the LAST one whose top has passed the
  // reading line. That holds for sections of any height and has no dependence
  // on event history.
  useEffect(() => {
    if (!present.length) return;
    let frame = 0;
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * 0.25;
      let current = "";
      for (const s of present) {
        const el = document.getElementById(s.id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = s.id;
      }
      // Before the first section reaches the line, the reader is at the top of
      // the page — highlight the first section rather than nothing.
      setActive(current || present[0].id);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [present]);

  const jump = (id: string) =>
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });

  if (!present.length) return null;

  return (
    <nav className="sticky top-24 hidden py-8 lg:block">
      <p className="mb-3 pl-3 text-[0.62rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
        On this page
      </p>
      <ul className="space-y-0.5">
        {present.map((s, i) => {
          const on = active === s.id;
          return (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => jump(s.id)}
                className={`relative flex w-full items-center gap-2.5 rounded-md py-2 pl-4 pr-2.5 text-left text-[0.92rem] transition ${
                  on
                    ? "bg-white/[0.07] font-semibold text-white"
                    : "font-medium text-slate-400 hover:bg-white/[0.03] hover:text-white"
                }`}
              >
                {/* Gold marker bar on the active row */}
                <span
                  className={`absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-full transition ${
                    on ? "bg-gold" : "bg-transparent"
                  }`}
                  aria-hidden
                />
                <span className={`w-4 flex-none text-right font-mono text-[0.72rem] ${on ? "text-gold" : "text-slate-600"}`}>
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
