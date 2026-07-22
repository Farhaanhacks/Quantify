"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import AuthButton from "@/components/quantifi/AuthButton";
import ThemeToggle from "@/components/quantifi/ThemeToggle";
import BrandLogo from "@/components/quantifi/BrandLogo";
import NotificationBell from "@/components/quantifi/NotificationBell";

const links = [
  { href: "/", label: "Home" },
  { href: "/news", label: "News Impact" },
  { href: "/ideas", label: "Ideas" },
  { href: "/rare-finds", label: "Rare Finds" },
  { href: "/screener", label: "Screener" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/tools", label: "Tools" },
  { href: "/watchlist", label: "Watchlist" },
  { href: "/pricing", label: "Subscribe" },
];

// Search a company/ticker → lands on the same Stock Analysis page as before.
function SearchBox({ onGo, className = "" }: { onGo?: () => void; className?: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const go = () => {
    const term = q.trim();
    if (!term) return;
    router.push(`/stock-analysis?symbol=${encodeURIComponent(term.toUpperCase())}`);
    onGo?.();
  };
  return (
    <div className={`flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 ${className}`}>
      <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 flex-none text-slate-500" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="m21 21-4.3-4.3" strokeLinecap="round" />
      </svg>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && go()}
        placeholder="Search a stock or ticker…"
        aria-label="Search a stock or ticker"
        className="w-full bg-transparent px-2 py-1.5 text-[0.72rem] text-white placeholder:text-slate-500 outline-none"
      />
    </div>
  );
}

function BrandMark() {
  return (
    <Link href="/" className="flex items-center" aria-label="Quantifi home">
      <BrandLogo className="h-12" />
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
              className={`whitespace-nowrap rounded-full px-1.5 py-1.5 text-[0.72rem] transition ${
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
          <SearchBox className="hidden w-52 md:flex" />
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
