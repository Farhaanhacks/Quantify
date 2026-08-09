"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { popularTickers } from "@/data/popularTickers";

// The front door's search box. It opens Stock Analysis for the symbol without
// asking anyone to sign in first — a visitor gets to put a company they care
// about into the product and see it respond, and only meets the wall at the
// point where the research itself begins.
const SUGGESTED = popularTickers.slice(0, 5);

export default function LandingSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  const go = (symbol: string) => {
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    router.push(`/stock-analysis?symbol=${encodeURIComponent(s)}`);
  };

  return (
    <div className="rounded-2xl border border-gold/20 bg-gradient-to-b from-gold/[0.09] to-transparent px-6 py-12 sm:px-12">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-editorial text-[2rem] leading-tight text-white sm:text-[2.5rem]">
          Which stock are you weighing up?
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-[0.95rem] leading-relaxed text-slate-300">
          Search any listing on the US or Indian markets and see what the filings, the cash flows
          and the day&apos;s news say about it.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            go(q);
          }}
          className="mx-auto mt-7 flex max-w-xl items-center gap-2 rounded-full border border-white/15 bg-ink-900 py-1.5 pl-5 pr-1.5 focus-within:border-gold/50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search any stock — AAPL, TSLA, RELIANCE.NS"
            aria-label="Search any stock"
            className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
          />
          <button
            type="submit"
            className="flex-none rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-5 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Research
          </button>
        </form>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-xs">
          <span className="text-slate-500">Popular</span>
          {SUGGESTED.map((t) => (
            <button
              key={t.s}
              type="button"
              onClick={() => go(t.s)}
              className="rounded-full border border-white/12 px-3 py-1 text-slate-300 transition hover:border-gold/40 hover:text-gold"
            >
              {t.n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
