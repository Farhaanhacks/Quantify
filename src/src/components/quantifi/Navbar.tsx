"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import AuthButton from "@/components/quantifi/AuthButton";
import ThemeToggle from "@/components/quantifi/ThemeToggle";
import BrandLogo from "@/components/quantifi/BrandLogo";
import NotificationBell from "@/components/quantifi/NotificationBell";

// Ideas, Rare Finds and Tools are no longer surfaced in the nav — their content
// is moving to the community page. The routes still exist, so any saved/shared
// link keeps working; they're just not advertised here any more.
//
// Subscribe keeps the shape of every other nav item; only its colour differs.
// `accent` marks it so it reads as the paid destination without turning into a
// differently-shaped control.
const links = [
  { href: "/", label: "Home" },
  { href: "/news", label: "News" },
  { href: "/screener", label: "Screener" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/pricing", label: "Subscribe", accent: true },
];

// One search result / recently-viewed entry.
interface Match {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  flag: string;
}

const RECENT_KEY = "quantifi.recent-searches.v1";

function loadRecent(): Match[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((m) => m && m.symbol).slice(0, 6) : [];
  } catch {
    return [];
  }
}

function pushRecent(m: Match) {
  try {
    const rest = loadRecent().filter((x) => x.symbol !== m.symbol);
    localStorage.setItem(RECENT_KEY, JSON.stringify([m, ...rest].slice(0, 6)));
  } catch {
    /* localStorage unavailable — non-fatal */
  }
}

// Search a company/ticker with a live typeahead. Because many users won't know a
// stock needs a .NS / .BO suffix (RELIANCE.NS, DLF.NS…), we DON'T navigate on raw
// free text — the user must pick a real listing from the dropdown, which carries
// the exact Yahoo symbol. That guarantees Stock Analysis always gets a resolvable
// ticker. With an empty box we surface their recently-viewed companies instead.
function SearchBox({ onGo, className = "" }: { onGo?: () => void; className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Match[]>([]);
  const [recent, setRecent] = useState<Match[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const term = q.trim();
  const shown = term.length >= 1 ? results : recent;
  const showRecentHeader = term.length < 1 && recent.length > 0;

  // Refresh recently-viewed whenever the panel opens.
  useEffect(() => {
    if (open) setRecent(loadRecent());
  }, [open]);

  // Debounced live search.
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
        const r = await fetch(`/api/symbol-search?q=${encodeURIComponent(term)}`, { signal: ac.signal });
        const d = await r.json();
        setResults(Array.isArray(d.results) ? d.results : []);
        setActive(0);
      } catch {
        /* aborted or offline — leave prior results */
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [term]);

  // Close on outside click.
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (m: Match) => {
    pushRecent(m);
    setOpen(false);
    setQ("");
    setResults([]);
    router.push(`/stock-analysis?symbol=${encodeURIComponent(m.symbol)}`);
    onGo?.();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, shown.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const m = shown[active];
      if (m) choose(m); // must pick a real listing — no raw free-text navigation
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={boxRef} className={`relative ${className}`}>
      <div className="flex w-full items-center rounded-lg border border-white/10 bg-white/[0.04] px-3 transition-colors focus-within:border-brand/60 focus-within:bg-white/[0.07]">
        <svg viewBox="0 0 24 24" className="h-4 w-4 flex-none text-slate-500" fill="none" stroke="currentColor" strokeWidth="2">
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
          placeholder="Search a stock or ticker…"
          aria-label="Search a stock or ticker"
          role="combobox"
          aria-expanded={open}
          aria-controls="stock-search-listbox"
          autoComplete="off"
          className="w-full bg-transparent px-2 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none"
        />
      </div>

      {open && (term.length >= 1 || recent.length > 0) ? (
        <div
          id="stock-search-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-80 overflow-y-auto rounded-lg border border-white/10 bg-ink-900/95 py-1 shadow-2xl backdrop-blur-xl"
        >
          {showRecentHeader ? (
            <p className="px-3 pb-1 pt-1.5 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Recently viewed
            </p>
          ) : null}

          {shown.map((m, i) => (
            <button
              key={`${m.symbol}-${i}`}
              type="button"
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()} // keep focus so onClick fires before blur
              onClick={() => choose(m)}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-left transition ${
                i === active ? "bg-white/[0.07]" : "hover:bg-white/[0.04]"
              }`}
            >
              <span className="text-base leading-none">{m.flag}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.78rem] text-white">{m.name}</span>
                <span className="block truncate text-[0.64rem] text-slate-500">
                  {m.exchange ? `${m.exchange}: ` : ""}
                  {m.symbol}
                </span>
              </span>
              {m.type && !/equity/i.test(m.type) ? (
                <span className="flex-none rounded border border-white/10 px-1.5 py-0.5 text-[0.55rem] uppercase tracking-wide text-slate-400">
                  {m.type}
                </span>
              ) : null}
            </button>
          ))}

          {term.length >= 1 && !loading && results.length === 0 ? (
            <p className="px-3 py-3 text-[0.72rem] text-slate-500">
              No matches. Try the company&apos;s full name (e.g. &ldquo;Reliance&rdquo;, &ldquo;Trent&rdquo;).
            </p>
          ) : null}
          {term.length >= 1 && loading && results.length === 0 ? (
            <p className="px-3 py-3 text-[0.72rem] text-slate-500">Searching…</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function BrandMark() {
  return (
    // shrink-0 is essential: without it flexbox compresses the logo to a sliver
    // whenever the nav row runs out of room (which is exactly what happened when
    // the links and search box grew).
    <Link href="/" className="flex shrink-0 items-center" aria-label="Quantifi home">
      <BrandLogo className="h-12 w-auto" />
    </Link>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <BrandMark />

        <div className="hidden items-center gap-0.5 xl:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              // Hovering paints the same soft square as the active page, so the
              // whole row reads as a set of chips rather than bare text.
              className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
                l.accent
                  ? `text-gold hover:bg-white/10 ${isActive(l.href) ? "bg-white/10" : ""}`
                  : isActive(l.href)
                  ? "bg-white/10 text-white"
                  : "text-slate-300 hover:bg-white/10 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {/* Wide enough that the placeholder isn't clipped at the larger type size. */}
          <SearchBox className="hidden w-64 md:flex lg:w-72" />
          {/* Theme also appears inside the account menu. Both write the same
              localStorage key, and ThemeToggle watches the <html> class, so the
              two controls stay in sync. It stays in the nav for signed-out
              visitors, who have no account menu to open. */}
          <ThemeToggle />
          <NotificationBell />
          <AuthButton />
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-200 xl:hidden"
          >
            <span className="text-lg leading-none">{open ? "✕" : "≡"}</span>
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t border-white/[0.06] bg-ink/95 px-4 pb-4 pt-2 xl:hidden">
          <SearchBox className="mb-2" onGo={() => setOpen(false)} />
          <div className="grid grid-cols-2 gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  l.accent
                    ? `text-gold hover:bg-white/10 ${isActive(l.href) ? "bg-white/10" : ""}`
                    : isActive(l.href)
                    ? "bg-white/10 text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}
