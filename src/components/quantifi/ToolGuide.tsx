"use client";

import { useState } from "react";

// Interactive replacement for the old numbered "How it works" ladder and the
// flat FAQ list. Steps are clickable tabs (pick one, read its answer); FAQs are
// an accordion (tap a question to open it). No 1-2-3 staircase.

export function HowItWorksTabs({ steps }: { steps: { label: string; body: string }[] }) {
  const [active, setActive] = useState(0);
  const current = steps[active] ?? steps[0];

  return (
    <div className="mt-4">
      {/* Tabs */}
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="How it works">
        {steps.map((s, i) => (
          <button
            key={s.label}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              i === active
                ? "border-gold/50 bg-gold/15 text-gold"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/20 hover:text-white"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.02] p-5">
        <p className="text-sm leading-relaxed text-slate-200">{current.body}</p>
      </div>
    </div>
  );
}

export function FaqAccordion({ faqs }: { faqs: { q: string; a: string }[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mt-4 space-y-2">
      {faqs.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className="overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02]">
            <button
              type="button"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
            >
              <span className="text-sm font-semibold text-white">{f.q}</span>
              <span
                className={`flex-none text-slate-400 transition-transform ${isOpen ? "rotate-45 text-gold" : ""}`}
                aria-hidden
              >
                +
              </span>
            </button>
            {isOpen ? (
              <p className="px-4 pb-4 text-sm leading-relaxed text-slate-400">{f.a}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
