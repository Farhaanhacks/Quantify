"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import AuthButton from "@/components/quantifi/AuthButton";
import ThemeToggle from "@/components/quantifi/ThemeToggle";
import BrandLogo from "@/components/quantifi/BrandLogo";
import NotificationBell from "@/components/quantifi/NotificationBell";
import { useProStatus } from "@/lib/useProStatus";
import CommandSearch from "@/components/quantifi/CommandSearch";
import { DISCOVER_PATHS } from "@/components/quantifi/DiscoverNav";

// Ideas and Rare Finds are reachable again, through Discover rather than as
// nav items of their own — a top bar with six peers had no room for two more,
// and they belong together anyway.
//
// Subscribe keeps the shape of every other nav item; only its colour differs.
// `accent` marks it so it reads as the paid destination without turning into a
// differently-shaped control.
// Discover is a section, not a page: the screener and the ideas/rare-finds
// library sit under it, and DiscoverNav draws the second row that switches
// between them. `match` is how this row knows it is the active one — the
// section's pages keep their own top-level URLs, so a startsWith test on
// "/discover" alone would never fire.
const links: {
  href: string;
  label: string;
  accent?: boolean;
  match?: string[];
}[] = [
  { href: "/", label: "Home" },
  { href: "/news", label: "News" },
  { href: "/discover", label: "Discover", match: DISCOVER_PATHS },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/pricing", label: "Subscribe", accent: true },
];

// Signed out, every one of those except Subscribe now bounces off the auth
// gate, so offering them is offering a door that doesn't open. The landing
// page gets a nav that matches what a visitor can actually reach.
const signedOutLinks: typeof links = [
  { href: "/pricing", label: "Plans", accent: true },
  { href: "/about", label: "About" },
  { href: "/contact", label: "Contact" },
];

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
  // `ready` guards the swap: until the session resolves we render the
  // signed-out set, so a logged-in visitor never sees the product links
  // disappear and reappear on first paint.
  const { user, ready } = useProStatus();
  const signedIn = ready && user != null;
  const navLinks = signedIn ? links : signedOutLinks;

  const isActive = (l: { href: string; match?: string[] }) => {
    if (l.href === "/") return pathname === "/";
    if (l.match?.some((m) => pathname === m || pathname.startsWith(`${m}/`))) return true;
    return pathname.startsWith(l.href);
  };

  return (
    // Solid background, no backdrop-blur. The bar used to be bg-ink/70 +
    // backdrop-blur-xl, and on iOS Safari that blur layer got clipped to the
    // bounds of the logo inside it, painting an opaque plate behind the mark —
    // white over a light page, grey over a dark one. Over a bar this opaque the
    // blur was barely visible anyway, so a solid surface loses nothing and
    // renders identically on every engine. bg-ink-900 is remapped to white in
    // light mode by globals.css, so both themes stay correct.
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-ink-900">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
        <BrandMark />

        <div className="hidden items-center gap-0.5 xl:flex">
          {navLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              // Hovering paints the same soft square as the active page, so the
              // whole row reads as a set of chips rather than bare text.
              className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-sm font-medium transition ${
                l.accent
                  ? `text-gold hover:bg-white/10 ${isActive(l) ? "bg-white/10" : ""}`
                  : isActive(l)
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
          {/* Search resolves to /stock-analysis, which is behind the gate, so a
              signed-out visitor typing a ticker would only be bounced to the
              sign-in page. Same for the alerts bell — there is no account to
              raise alerts against yet. */}
          {signedIn ? <CommandSearch className="hidden w-52 md:flex lg:w-64" /> : null}
          {/* Theme also appears inside the account menu. Both write the same
              localStorage key, and ThemeToggle watches the <html> class, so the
              two controls stay in sync. It stays in the nav for signed-out
              visitors, who have no account menu to open. */}
          <ThemeToggle />
          {signedIn ? <NotificationBell /> : null}
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
          {signedIn ? <CommandSearch className="mb-2 w-full" /> : null}
          <div className="grid grid-cols-2 gap-1">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm transition ${
                  l.accent
                    ? `text-gold hover:bg-white/10 ${isActive(l) ? "bg-white/10" : ""}`
                    : isActive(l)
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
