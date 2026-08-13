"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FlagChip from "@/components/quantifi/FlagChip";
import { popularTickers } from "@/data/popularTickers";

// A search that opens into a full panel rather than a dropdown.
//
// The old box was a live-typeahead input sitting in the navbar, and the list it
// dropped had room for about six rows. That is fine for "I know the ticker" and
// useless for everything else — you could not see what you searched last week,
// could not tell companies from funds without reading each row, and could not
// reach any part of the app from it.
//
// So the navbar now holds a TRIGGER, not an input: a quiet pill that says what
// it is and advertises its shortcut. Clicking it (or ⌘K / Ctrl-K) opens a panel
// with the whole result set on the left and a filter rail on the right.
//
// The rail lists the groups this app can actually produce — companies, funds,
// indices, and its own pages. Not a taxonomy borrowed from some other product:
// every entry there corresponds to results this search really returns, and a
// group with nothing in it is dimmed rather than shown as an empty promise.

interface Match {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  flag: string;
  country?: string;
  kind?: "Stock" | "ETF" | "Fund" | "Index";
}

/** A destination inside the app, searchable by name the same way a company is. */
interface PageHit {
  href: string;
  label: string;
  desc: string;
  /** Extra words that should match this page but don't appear in its label. */
  keywords: string;
}

const PAGES: PageHit[] = [
  { href: "/screener", label: "Screener", desc: "Filter companies by fundamentals", keywords: "filter screen valuation metrics" },
  { href: "/portfolio", label: "Portfolio", desc: "Your holdings and performance", keywords: "holdings positions returns" },
  { href: "/watchlist", label: "Watchlist", desc: "Companies you're tracking", keywords: "track follow saved" },
  { href: "/insider-activity", label: "Insider activity", desc: "Form 4 and SEBI PIT filings", keywords: "insider trades directors promoters sebi sec" },
  { href: "/news", label: "News", desc: "Market and portfolio headlines", keywords: "headlines articles press" },
  { href: "/explore", label: "Explore", desc: "Browse companies by theme", keywords: "discover browse sectors themes" },
  { href: "/ideas", label: "Ideas", desc: "Trading ideas and playbooks", keywords: "strategy playbook setups" },
  { href: "/tools", label: "Tools", desc: "DCF, risk analyser, comparisons", keywords: "calculator dcf risk compare pe" },
  { href: "/rare-finds", label: "Rare finds", desc: "Overlooked and undervalued names", keywords: "undervalued hidden gems" },
  { href: "/currencies", label: "Currencies", desc: "FX rates and conversion", keywords: "forex fx exchange rate" },
  { href: "/community", label: "Community", desc: "Questions and shared theses", keywords: "discussion forum ask" },
  { href: "/pricing", label: "Pricing", desc: "Plans and subscription", keywords: "plans subscribe pro billing upgrade" },
];

// Kept identical to the old navbar box's key, so nobody's history resets when
// this ships.
const RECENT_KEY = "quantifi.recent-searches.v1";

function loadRecent(): Match[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((m) => m && m.symbol).slice(0, 8) : [];
  } catch {
    return [];
  }
}

function pushRecent(m: Match) {
  try {
    const rest = loadRecent().filter((x) => x.symbol !== m.symbol);
    localStorage.setItem(RECENT_KEY, JSON.stringify([m, ...rest].slice(0, 8)));
  } catch {
    /* localStorage unavailable — non-fatal */
  }
}

type Group = "all" | "companies" | "funds" | "indices" | "pages";

const GROUP_LABEL: Record<Group, string> = {
  all: "All results",
  companies: "Companies",
  funds: "ETFs & funds",
  indices: "Indices",
  pages: "Pages",
};

function groupOf(m: Match): Exclude<Group, "all" | "pages"> {
  if (m.kind === "Index") return "indices";
  if (m.kind === "ETF" || m.kind === "Fund") return "funds";
  return "companies";
}

/** Monogram standing in for a company logo. */
function Monogram({ text }: { text: string }) {
  const letter = (text || "?").trim().charAt(0).toUpperCase();
  return (
    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-white/10 bg-white/[0.05] font-display text-sm font-semibold text-slate-300">
      {letter}
    </span>
  );
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.8">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MagnifierIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" strokeLinecap="round" />
    </svg>
  );
}

export default function CommandSearch({ className = "" }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [recent, setRecent] = useState<Match[]>([]);
  const [loading, setLoading] = useState(false);
  const [group, setGroup] = useState<Group>("all");
  const [active, setActive] = useState(0);
  // Mac shows ⌘K, everything else Ctrl K. Resolved after mount so the server
  // and client render the same markup.
  const [mac, setMac] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const term = q.trim();

  useEffect(() => {
    setMac(/mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent));
  }, []);

  // ⌘K / Ctrl-K from anywhere; Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Freeze the page behind the panel, and hand focus to the input.
  useEffect(() => {
    if (!open) return;
    setRecent(loadRecent());
    setActive(0);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => {
      document.body.style.overflow = prev;
      clearTimeout(t);
    };
  }, [open]);

  // Debounced live search.
  useEffect(() => {
    if (!open || term.length < 1) {
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
        const r = await fetch(`/api/symbol-search?q=${encodeURIComponent(term)}`, { signal: ac.signal });
        const d = await r.json();
        setResults(Array.isArray(d.results) ? d.results : []);
        setActive(0);
      } catch {
        /* aborted or offline — keep what's on screen */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(t);
  }, [term, open]);

  // Pages match on label, description and their extra keywords.
  const pageHits = useMemo(() => {
    if (term.length < 1) return [];
    const t = term.toLowerCase();
    return PAGES.filter(
      (p) =>
        p.label.toLowerCase().includes(t) ||
        p.desc.toLowerCase().includes(t) ||
        p.keywords.includes(t)
    ).slice(0, 6);
  }, [term]);

  const counts = useMemo(() => {
    const c: Record<Group, number> = { all: 0, companies: 0, funds: 0, indices: 0, pages: pageHits.length };
    for (const m of results) c[groupOf(m)]++;
    c.all = results.length + pageHits.length;
    return c;
  }, [results, pageHits]);

  const visibleSymbols = useMemo(
    () => (group === "all" ? results : group === "pages" ? [] : results.filter((m) => groupOf(m) === group)),
    [results, group]
  );
  const visiblePages = useMemo(
    () => (group === "all" || group === "pages" ? pageHits : []),
    [group, pageHits]
  );

  // One flat list for arrow-key traversal, symbols first then pages — the same
  // order they are painted.
  const flat = useMemo(
    () => [
      ...visibleSymbols.map((m) => ({ kind: "symbol" as const, m })),
      ...visiblePages.map((p) => ({ kind: "page" as const, p })),
    ],
    [visibleSymbols, visiblePages]
  );

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setResults([]);
    setGroup("all");
  }, []);

  const chooseSymbol = useCallback(
    (m: Match) => {
      pushRecent(m);
      close();
      router.push(`/stock-analysis?symbol=${encodeURIComponent(m.symbol)}`);
    },
    [close, router]
  );

  const choosePage = useCallback(
    (p: PageHit) => {
      close();
      router.push(p.href);
    },
    [close, router]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = flat[active];
      if (!item) return;
      if (item.kind === "symbol") chooseSymbol(item.m);
      else choosePage(item.p);
    }
  };

  // Keep the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const shortcut = mac ? "⌘ K" : "Ctrl K";

  return (
    <>
      {/* ── Trigger ─────────────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Search"
        aria-keyshortcuts="Meta+K Control+K"
        className={`group flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-left transition hover:border-white/20 hover:bg-white/[0.07] ${className}`}
      >
        <MagnifierIcon className="h-4 w-4 flex-none text-gold/70" />
        <span className="flex-1 text-sm text-slate-500 group-hover:text-slate-400">Search</span>
        <kbd className="flex-none rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-sans text-[0.6rem] tracking-wide text-slate-500">
          {shortcut}
        </kbd>
      </button>

      {/* ── Panel ───────────────────────────────────────────────────────── */}
      {open ? (
        <div style={{ backgroundColor: "var(--bg)" }}
          className="fixed inset-0 z-[100] flex flex-col backdrop-blur-xl" role="dialog" aria-modal="true" aria-label="Search">
          {/* Header: back arrow + the real input */}
          <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-6">
            <button
              type="button"
              onClick={close}
              aria-label="Close search"
              className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-slate-400 transition hover:bg-white/[0.06] hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="flex flex-1 items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2.5 focus-within:border-gold/40">
              <MagnifierIcon className="h-4 w-4 flex-none text-gold/70" />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search companies, funds or pages"
                aria-label="Search companies, funds or pages"
                autoComplete="off"
                className="w-full bg-transparent text-[0.95rem] text-white placeholder:text-slate-500 outline-none"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    inputRef.current?.focus();
                  }}
                  aria-label="Clear search"
                  className="flex-none rounded-full p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
              ) : null}
            </div>
          </div>

          <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 overflow-hidden px-4 py-5 sm:px-6 lg:flex-row lg:gap-10">
            {/* Results */}
            <div ref={listRef} className="min-w-0 flex-1 overflow-y-auto lg:order-1">
              {term.length < 1 ? (
                <>
                  {recent.length > 0 ? (
                    <section className="mb-7">
                      <h2 className="mb-2 font-display text-base font-semibold text-white">Recent searches</h2>
                      <ul>
                        {recent.map((m) => (
                          <li key={`r-${m.symbol}`}>
                            <button
                              type="button"
                              onClick={() => chooseSymbol(m)}
                              className="flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition hover:bg-white/[0.05]"
                            >
                              <ClockIcon />
                              <span className="min-w-0 truncate text-sm text-slate-300">{m.name}</span>
                              <span className="flex-none text-[0.7rem] text-slate-500">{m.symbol}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </section>
                  ) : null}

                  <section>
                    {/* Named for what it is. This is a curated list that ships
                        with the app — not a live popularity ranking, which
                        would need usage telemetry this product does not
                        collect. Calling it "most searched" would be inventing
                        a number. */}
                    <h2 className="mb-1 font-display text-base font-semibold text-white">Popular on Quantifi</h2>
                    <p className="mb-2 text-[0.72rem] text-slate-500">Widely followed companies, to get you started.</p>
                    <ul>
                      {popularTickers.slice(0, 8).map((p) => (
                        <li key={`p-${p.s}`}>
                          <button
                            type="button"
                            onClick={() =>
                              chooseSymbol({
                                symbol: p.s,
                                name: p.n,
                                type: "Stock",
                                exchange: "",
                                flag: "",
                                kind: "Stock",
                              })
                            }
                            className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/[0.05]"
                          >
                            <Monogram text={p.n} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-white">{p.n}</span>
                              <span className="block truncate text-[0.7rem] text-slate-500">{p.s}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </section>
                </>
              ) : (
                <>
                  {flat.length === 0 && !loading ? (
                    <p className="px-2 py-8 text-sm text-slate-500">
                      Nothing matched &ldquo;{term}&rdquo;. Try the company&apos;s full name — &ldquo;Reliance&rdquo;,
                      &ldquo;Trent&rdquo; — or a ticker.
                    </p>
                  ) : null}
                  {flat.length === 0 && loading ? (
                    <p className="px-2 py-8 text-sm text-slate-500">Searching…</p>
                  ) : null}

                  <ul>
                    {visibleSymbols.map((m, i) => (
                      <li key={`${m.symbol}-${i}`}>
                        <button
                          type="button"
                          data-idx={i}
                          onMouseEnter={() => setActive(i)}
                          onClick={() => chooseSymbol(m)}
                          className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition ${
                            i === active ? "bg-white/[0.07]" : "hover:bg-white/[0.05]"
                          }`}
                        >
                          <Monogram text={m.name} />
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-1.5">
                              <span className="min-w-0 truncate text-sm font-medium text-white">{m.name}</span>
                              {m.kind && m.kind !== "Stock" ? (
                                <span className="flex-none rounded-[3px] border border-white/15 px-1.5 py-px text-[0.55rem] uppercase tracking-wide text-slate-400">
                                  {m.kind}
                                </span>
                              ) : null}
                            </span>
                            <span className="mt-0.5 flex items-center gap-1.5 text-[0.7rem] text-slate-500">
                              <FlagChip country={m.country} symbol={m.symbol} />
                              <span className="truncate">
                                {m.exchange ? `${m.exchange}: ` : ""}
                                {m.symbol}
                              </span>
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}

                    {visiblePages.length ? (
                      <li className="px-2 pb-1 pt-4 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-slate-500">
                        Pages
                      </li>
                    ) : null}
                    {visiblePages.map((p, j) => {
                      const i = visibleSymbols.length + j;
                      return (
                        <li key={p.href}>
                          <button
                            type="button"
                            data-idx={i}
                            onMouseEnter={() => setActive(i)}
                            onClick={() => choosePage(p)}
                            className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition ${
                              i === active ? "bg-white/[0.07]" : "hover:bg-white/[0.05]"
                            }`}
                          >
                            <span className="flex h-9 w-9 flex-none items-center justify-center rounded-md border border-white/10 bg-white/[0.05] text-slate-400">
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
                                <path d="M4 6h16M4 12h16M4 18h10" strokeLinecap="round" />
                              </svg>
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-white">{p.label}</span>
                              <span className="block truncate text-[0.7rem] text-slate-500">{p.desc}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}
            </div>

            {/* Filter rail. Horizontal chips on small screens, a column beside
                the results from lg up — the reference layout only works when
                there is width to spare. */}
            {term.length >= 1 ? (
              <nav
                aria-label="Filter results"
                className="order-first flex flex-none gap-2 overflow-x-auto border-b border-white/[0.07] pb-3 lg:order-2 lg:w-48 lg:flex-col lg:gap-0.5 lg:overflow-visible lg:border-b-0 lg:border-l lg:border-white/[0.07] lg:pb-0 lg:pl-6"
              >
                {(Object.keys(GROUP_LABEL) as Group[]).map((g) => {
                  const n = counts[g];
                  const disabled = n === 0 && g !== "all";
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        setGroup(g);
                        setActive(0);
                      }}
                      disabled={disabled}
                      className={`flex flex-none items-center justify-between gap-2 whitespace-nowrap rounded-full px-3 py-2 text-sm transition lg:rounded-lg ${
                        group === g
                          ? "bg-white/[0.08] font-semibold text-white"
                          : disabled
                            ? "cursor-default text-slate-700"
                            : "text-slate-400 hover:bg-white/[0.05] hover:text-white"
                      }`}
                    >
                      <span>{GROUP_LABEL[g]}</span>
                      {n > 0 ? <span className="font-mono text-[0.65rem] tnum text-slate-500">{n}</span> : null}
                    </button>
                  );
                })}
              </nav>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
