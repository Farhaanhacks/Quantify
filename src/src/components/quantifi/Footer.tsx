import Link from "next/link";
import BrandLogo from "@/components/quantifi/BrandLogo";

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
    title: "Research Themes",
    items: [
      { label: "AI Power Bottleneck", href: "/ideas?theme=ai-power-bottleneck" },
      { label: "Sovereign AI Stacks", href: "/ideas?theme=sovereign-ai-stacks" },
      { label: "Global Defence Re-Armament", href: "/ideas?theme=global-defence-rearmament" },
      { label: "GLP-1 Health Repricing", href: "/ideas?theme=glp1-health-repricing" },
      { label: "Market Toll Booths", href: "/ideas?theme=market-toll-booths" },
      { label: "Post-Hype IPO Survivors", href: "/ideas?theme=post-hype-ipo-survivors" },
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
      { label: "Research Playbooks", href: "/ideas" },
      { label: "What's New", href: "/" },
    ],
  },
  {
    title: "Quantifi",
    items: [
      { label: "Plans & Pricing", href: "/pricing" },
      { label: "About", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Privacy Policy", href: "/privacy" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Refund & Cancellation", href: "/refund-policy" },
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
          <div className="flex items-center">
            <BrandLogo className="h-14" />
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-500">
            {[
              { href: "/about", label: "About" },
              { href: "/privacy", label: "Privacy" },
              { href: "/terms", label: "Terms" },
              { href: "/refund-policy", label: "Refund & Cancellation" },
              { href: "/contact", label: "Contact" },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="transition hover:text-gold">
                {l.label}
              </Link>
            ))}
          </div>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          © {new Date().getFullYear()} Quantifi — educational market research &amp; analytics. Payments processed securely by Razorpay.
        </p>

        <p className="mt-3 max-w-4xl text-[0.72rem] leading-relaxed text-slate-600">
          <strong className="text-slate-500">Quantifi is for research and education only. Not investment advice.</strong>{" "}
          Everything shown is for informational and educational purposes only and is not financial,
          investment or trading advice, nor a recommendation to buy, sell or hold any security. Quantifi
          is not a broker, exchange or registered investment adviser and is not affiliated with any
          broker or exchange. Market data is provided on a best-efforts basis and may be delayed; always
          verify independently before acting.
        </p>
      </div>
    </footer>
  );
}
