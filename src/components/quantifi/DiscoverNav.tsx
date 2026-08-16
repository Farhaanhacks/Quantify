"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// The second row of navigation, under the main bar, for the Discover section.
//
// Discover is one destination in the top bar with more than one thing inside it,
// and a second bar is how that reads: the top row says which part of the app you
// are in, this row says which part of Discover. Putting both tabs in the main bar
// instead would make two peers out of what is one area, and the main bar has no
// room left for it.
//
// The routes are unchanged — /ideas and /screener are where they have always
// been, so every existing link, bookmark and sitemap entry still resolves. This
// component groups them; it does not move them.
// `owns` lists the other paths a tab covers. /rare-finds keeps working as its
// own URL — it is linked from the account menu and from search — but its content
// now sits inside Investing Ideas, so that is the tab it should light up.
export const DISCOVER_TABS: { href: string; label: string; owns?: string[] }[] = [
  { href: "/ideas", label: "Investing Ideas", owns: ["/rare-finds"] },
  { href: "/screener", label: "Screener" },
];

/** Every path that lives under Discover, so the top bar can light up for them. */
export const DISCOVER_PATHS = DISCOVER_TABS.flatMap((t) => [t.href, ...(t.owns ?? [])]);

export default function DiscoverNav() {
  const pathname = usePathname();
  const covers = (p: string) => pathname === p || pathname.startsWith(`${p}/`);

  return (
    <div className="border-b border-white/[0.06] bg-ink-900">
      <nav
        aria-label="Discover sections"
        className="mx-auto flex max-w-7xl items-center gap-6 overflow-x-auto px-4 sm:px-6 lg:px-8"
      >
        {DISCOVER_TABS.map((t) => {
          const active = covers(t.href) || (t.owns ?? []).some(covers);
          return (
            <Link
              key={t.href}
              href={t.href}
              // The underline sits on the link itself rather than on a separate
              // indicator so it tracks the label's width exactly, and a
              // transparent border on the inactive state keeps the row from
              // shifting by 2px when the active tab changes.
              className={`whitespace-nowrap border-b-2 py-3 text-sm transition ${
                active
                  ? "border-gold font-semibold text-white"
                  : "border-transparent text-slate-400 hover:text-white"
              }`}
              aria-current={active ? "page" : undefined}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
