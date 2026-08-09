"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

interface SessionUser {
  name?: string;
  email?: string;
  picture?: string;
}

// Recently-viewed companies are written by the nav search box; the account menu
// reads the same store so "Viewed companies" needs no extra plumbing.
const RECENT_KEY = "quantifi.recent-searches.v1";

interface Recent {
  symbol: string;
  name: string;
  flag?: string;
}

function loadRecent(): Recent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((m) => m && m.symbol).slice(0, 5) : [];
  } catch {
    return [];
  }
}

// Every destination here is a route that actually exists — a menu that dead-ends
// on a 404 is worse than a short menu.
const SECTIONS: { heading: string; links: { href: string; label: string }[] }[] = [
  {
    heading: "Your research",
    links: [
      { href: "/portfolio", label: "Portfolio" },
      { href: "/watchlist", label: "Watchlist" },
      { href: "/screener", label: "Screener" },
    ],
  },
  {
    heading: "Explore",
    links: [
      { href: "/ideas", label: "Ideas" },
      { href: "/rare-finds", label: "Rare Finds" },
      { href: "/insider-activity", label: "Insider Activity" },
      { href: "/famous-takes", label: "Famous Takes" },
      { href: "/news", label: "News" },
      { href: "/tools", label: "Tools" },
      { href: "/currencies", label: "Currencies" },
    ],
  },
  {
    heading: "Account",
    links: [
      { href: "/pricing", label: "Plans & Pricing" },
      { href: "/about", label: "About Quantifi" },
      { href: "/contact", label: "Help & Contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { href: "/privacy", label: "Privacy" },
      { href: "/terms", label: "Terms" },
      { href: "/refund-policy", label: "Refund policy" },
    ],
  },
];

export default function AuthButton() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [light, setLight] = useState(false);
  const [recent, setRecent] = useState<Recent[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d: { user?: SessionUser | null }) => {
        if (!cancelled) {
          setUser(d.user ?? null);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Read live state each time the panel opens, so the theme pills and the
  // recently-viewed list are never stale.
  useEffect(() => {
    if (!open) return;
    setLight(document.documentElement.classList.contains("light"));
    setRecent(loadRecent());
  }, [open]);

  const setTheme = (next: "light" | "dark") => {
    const el = document.documentElement;
    el.classList.toggle("light", next === "light");
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode — the class still applies for this session */
    }
    setLight(next === "light");
  };

  if (!ready) return null;

  if (!user) {
    return (
      <a
        href="/login"
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 12v3.5h4.9c-.2 1.2-1.6 3.6-4.9 3.6A5.1 5.1 0 1 1 12 6.9c1.6 0 2.7.7 3.3 1.3l2.3-2.2C16.1 4.6 14.3 4 12 4a8 8 0 1 0 0 16c4.6 0 7.7-3.2 7.7-7.8 0-.5 0-.9-.1-1.2H12z"
            fill="currentColor"
          />
        </svg>
        <span>Sign in</span>
      </a>
    );
  }

  const label = user.name || user.email || "Account";
  const initials = (user.name || user.email || "?")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");

  const row =
    "block rounded-md px-3 py-2 text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white";

  return (
    <div className="relative" ref={ref}>
      {/* Circle only — the name used to sit beside the avatar in a capsule, which
          ate nav width for information the menu already shows. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${label}`}
        title={label}
        className={`grid h-9 w-9 flex-none place-items-center overflow-hidden rounded-full border transition ${
          open ? "border-gold/60" : "border-white/15 hover:border-gold/40"
        }`}
      >
        {user.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.picture} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid h-full w-full place-items-center bg-gold/20 text-xs font-semibold text-gold">
            {initials}
          </span>
        )}
      </button>

      {open ? (
        <div
          role="menu"
          // Opaque, not translucent: at /95 the price and headings behind the
          // panel showed straight through the menu rows.
          className="absolute right-0 z-50 mt-2 max-h-[min(32rem,calc(100vh-5rem))] w-72 overflow-y-auto rounded-lg border border-white/10 bg-ink-900 p-1.5 shadow-2xl"
        >
          {/* Identity */}
          <div className="flex items-center gap-3 px-2 py-2">
            <span className="grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-full border border-white/10">
              {user.picture ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={user.picture} alt="" className="h-full w-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <span className="grid h-full w-full place-items-center bg-gold/20 text-sm font-semibold text-gold">
                  {initials}
                </span>
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-white">{label}</span>
              {user.email ? (
                <span className="block truncate text-xs text-slate-500">{user.email}</span>
              ) : null}
            </span>
          </div>

          {/* Theme — lives here now rather than as a separate nav button, so the
              two controls can't disagree about the current theme. */}
          <div className="mt-1 flex items-center justify-between gap-2 rounded-md px-3 py-2">
            <span className="text-sm text-slate-300">Theme</span>
            <span className="inline-flex rounded-md border border-white/10 bg-white/[0.03] p-0.5">
              {(["dark", "light"] as const).map((t) => {
                const active = t === "light" ? light : !light;
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTheme(t)}
                    className={`rounded px-2.5 py-1 text-xs capitalize transition ${
                      active ? "bg-gold/15 font-medium text-gold" : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                );
              })}
            </span>
          </div>

          {recent.length ? (
            <>
              <div className="mx-2 mt-1 border-t border-white/[0.07]" />
              <p className="px-3 pb-1 pt-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                Viewed companies
              </p>
              {recent.map((r) => (
                <Link
                  key={r.symbol}
                  href={`/stock-analysis?symbol=${encodeURIComponent(r.symbol)}`}
                  onClick={() => setOpen(false)}
                  className={`${row} flex items-center gap-2`}
                >
                  {r.flag ? <span className="text-sm leading-none">{r.flag}</span> : null}
                  <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  <span className="flex-none font-mono text-[0.62rem] text-slate-500">{r.symbol}</span>
                </Link>
              ))}
            </>
          ) : null}

          {SECTIONS.map((s) => (
            <div key={s.heading}>
              <div className="mx-2 mt-1 border-t border-white/[0.07]" />
              <p className="px-3 pb-1 pt-2 text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-slate-500">
                {s.heading}
              </p>
              {s.links.map((l) => (
                <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className={row}>
                  {l.label}
                </Link>
              ))}
            </div>
          ))}

          <div className="mx-2 mt-1 border-t border-white/[0.07]" />
          <a
            href="/api/auth/logout"
            className="mt-1 block rounded-md px-3 py-2 text-sm text-slate-300 transition hover:bg-down/10 hover:text-down"
          >
            Log out
          </a>
        </div>
      ) : null}
    </div>
  );
}
