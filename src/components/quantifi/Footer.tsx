import Link from "next/link";

const columns: { title: string; items: { label: string; href: string }[] }[] = [
  {
    title: "Markets",
    items: [
      { label: "US: NYSE & NASDAQ", href: "/explore" },
      { label: "India: NSE & BSE", href: "/explore" },
      { label: "UK: FTSE", href: "/explore" },
      { label: "Canada: TSX", href: "/explore" },
      { label: "Australia: ASX", href: "/explore" },
      { label: "Japan: NIKKEI", href: "/explore" },
    ],
  },
  {
    title: "Investing Ideas",
    items: [
      { label: "Undervalued Companies", href: "/ideas" },
      { label: "Dividend Powerhouses", href: "/ideas" },
      { label: "Insider Activity", href: "/insider-activity" },
      { label: "Artificial Intelligence", href: "/ideas" },
      { label: "Nuclear Energy", href: "/ideas" },
      { label: "Cybersecurity", href: "/ideas" },
    ],
  },
  {
    title: "Features & Tools",
    items: [
      { label: "Portfolio Tracker", href: "/portfolio" },
      { label: "Stock Analysis", href: "/stock-analysis" },
      { label: "Stock Screener", href: "/screener" },
      { label: "Trading Ideas", href: "/ideas" },
      { label: "News Impact", href: "/news" },
      { label: "Dividend Tracker", href: "/ideas" },
    ],
  },
  {
    title: "News & Discovery",
    items: [
      { label: "Latest Stock News", href: "/news" },
      { label: "Stocks Affected", href: "/news" },
      { label: "Global Market Insights", href: "/explore" },
      { label: "Famous Takes", href: "/famous-takes" },
      { label: "Community Narratives", href: "/famous-takes" },
      { label: "What's New", href: "/" },
    ],
  },
  {
    title: "Quantifi",
    items: [
      { label: "Plans & Pricing", href: "/pricing" },
      { label: "About Us", href: "/" },
      { label: "Contact Us", href: "/" },
      { label: "Help Center", href: "/" },
      { label: "Learn Stock Investing", href: "/" },
      { label: "Business & Enterprise", href: "/" },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-white/[0.06]">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:grid-cols-5">
          {columns.map((col) => (
            <div key={col.title}>
              <h3 className="font-display text-sm font-semibold text-white">{col.title}</h3>
              <ul className="mt-4 space-y-2.5">
                {col.items.map((item) => (
                  <li key={item.label}>
                    <Link
                      href={item.href}
                      className="text-[0.82rem] text-slate-400 transition hover:text-gold"
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/[0.06] pt-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo-icon.png" alt="Quantifi" className="h-7 w-auto" />
            <span className="font-display font-semibold text-white">Quantifi</span>
          </div>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Quantifi — a market-discovery & analytics prototype.
          </p>
        </div>

        <p className="mt-6 max-w-4xl text-[0.72rem] leading-relaxed text-slate-600">
          Quantifi is an educational market research and analytics platform. The information shown
          is for general informational and educational purposes only and should not be treated as
          financial advice, investment advice, trading advice, or a recommendation to buy, sell, or
          hold any security. Data may be delayed, incomplete, or inaccurate. Always verify
          independently.
        </p>
      </div>
    </footer>
  );
}
