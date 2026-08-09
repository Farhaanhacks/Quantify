"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { popularTickers } from "@/data/popularTickers";
import FlagChip from "@/components/quantifi/FlagChip";

// The front door's search box. Picking a company opens Stock Analysis for it
// without asking anyone to sign in first — a visitor gets to put a name they
// care about into the product and watch it answer, and only meets the wall
// where the research itself begins.
//
// It resolves against /api/symbol-search rather than accepting free text,
// because a listing outside the US needs its exchange suffix (RELIANCE.NS, not
// RELIANCE) and nobody should have to know that. The result carries the exact
// symbol, so the page it opens always resolves.
interface Match {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  flag: string;
  country?: string;
  kind?: "Stock" | "ETF" | "Fund" | "Index";
}

const SUGGESTED = popularTickers.slice(0, 5);

export default function LandingSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const term = q.trim();

  useEffect(() => {
    if (term.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      abortRef.current?.abort();
      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const r = await fetch(`/api/symbol-search?q=${encodeURIComponent(term)}`, {
          signal: ac.signal,
        });
        const d = await r.json();
        setResults(Array.isArray(d.results) ? d.results : []);
        setActive(0);
      } catch {
        /* aborted or offline — keep whatever was showing */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const go = (symbol: string) => {
    const s = symbol.trim().toUpperCase();
    if (!s) return;
    setOpen(false);
    router.push(`/stock-analysis?symbol=${encodeURIComponent(s)}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const m = results[active];
      if (m) go(m.symbol);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
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

        <div ref={boxRef} className="relative mx-auto mt-7 max-w-xl text-left">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const m = results[active];
              if (m) go(m.symbol);
            }}
            /* Rectangular, not a capsule — it sits under a serif headline and
               reads as a field rather than a pill. */
            className="flex items-center gap-2 rounded-lg border border-white/15 bg-ink-900 py-1.5 pl-4 pr-1.5 focus-within:border-gold/50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-slate-500" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <circle cx="11" cy="11" r="7" />
              <path d="m21 21-4.3-4.3" strokeLinecap="round" />
            </svg>
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onKeyDown={onKeyDown}
              placeholder="Search any stock: Apple, Reliance, NVDA"
              aria-label="Search any stock"
              role="combobox"
              aria-expanded={open}
              aria-controls="landing-search-listbox"
              autoComplete="off"
              className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none placeholder:text-slate-500"
            />
            <button
              type="submit"
              className="flex-none rounded-md bg-gradient-to-r from-gold-400 to-gold-600 px-5 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
            >
              Research
            </button>
          </form>

          {open && term.length >= 1 ? (
            <div
              id="landing-search-listbox"
              role="listbox"
              className="absolute left-0 right-0 top-full z-40 mt-1.5 max-h-80 overflow-y-auto rounded-lg border border-white/10 bg-ink-900 py-1 shadow-2xl"
            >
              {results.map((m, i) => (
                <button
                  key={`${m.symbol}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseEnter={() => setActive(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => go(m.symbol)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${
                    i === active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
                  }`}
                >
                  <FlagChip country={m.country} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="min-w-0 truncate text-[0.82rem] text-white">{m.name}</span>
                      {/* Say what it is. A search for a company turns up its
                          funds too, and the two are otherwise indistinguishable
                          from the name alone. */}
                      {m.kind && m.kind !== "Stock" ? (
                        <span className="flex-none rounded-[3px] border border-white/15 px-1.5 py-px text-[0.55rem] uppercase tracking-wide text-slate-400">
                          {m.kind}
                        </span>
                      ) : null}
                    </span>
                    <span className="block truncate text-[0.66rem] text-slate-500">
                      {m.exchange ? `${m.exchange}: ` : ""}
                      {m.symbol}
                    </span>
                  </span>
                </button>
              ))}
              {!results.length ? (
                <p className="px-3 py-3 text-[0.8rem] text-slate-500">
                  {loading ? "Searching…" : "No listing matches that yet."}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-xs">
          <span className="text-slate-500">Popular</span>
          {SUGGESTED.map((t) => (
            <button
              key={t.s}
              type="button"
              onClick={() => go(t.s)}
              className="rounded-md border border-white/12 px-3 py-1 text-slate-300 transition hover:border-gold/40 hover:text-gold"
            >
              {t.n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
