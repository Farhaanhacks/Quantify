"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const links = [
  { href: "/", label: "Home" },
  { href: "/news", label: "News Impact" },
  { href: "/ideas", label: "Ideas" },
  { href: "/insider-activity", label: "Insider Activity" },
  { href: "/famous-takes", label: "Famous Takes" },
  { href: "/explore", label: "Explore" },
  { href: "/screener", label: "Screener" },
  { href: "/stock-analysis", label: "Stock Analysis" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/currencies", label: "Currencies" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/pricing", label: "Pricing" },
];

function BrandMark() {
  return (
    <Link href="/" className="flex items-center gap-2" aria-label="Quantifi home">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-icon.png" alt="Quantifi" className="h-8 w-auto" />
      <span className="font-display text-lg font-semibold tracking-tight text-white">
        Quantifi
      </span>
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

        <div className="hidden items-center gap-0.5 lg:flex">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap rounded-full px-2 py-1.5 text-[0.72rem] transition ${
                isActive(l.href)
                  ? "bg-white/10 text-white"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/watchlist"
            className="hidden rounded-full bg-gradient-to-r from-gold/90 to-gold-600 px-4 py-2 text-sm font-medium text-ink transition hover:opacity-90 sm:inline-flex"
          >
            My Watchlist
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle menu"
            aria-expanded={open}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-200 lg:hidden"
          >
            <span className="text-lg leading-none">{open ? "✕" : "≡"}</span>
          </button>
        </div>
      </nav>

      {open ? (
        <div className="border-t border-white/[0.06] bg-ink/95 px-4 pb-4 pt-2 lg:hidden">
          <div className="grid grid-cols-2 gap-1">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded-lg px-3 py-2 text-sm ${
                  isActive(l.href) ? "bg-white/10 text-white" : "text-slate-300"
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
