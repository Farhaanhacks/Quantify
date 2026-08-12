import { Suspense } from "react";
import StockExplorer from "@/components/quantifi/StockExplorer";
import { fromTvSymbol } from "@/lib/tvSymbol";

export const dynamic = "force-dynamic";

import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Stock Analysis — Search Any Stock or ETF",
  description:
    "Analyse any stock or ETF on Quantifi: live chart, valuation, analyst targets, financial summary, ownership and risks. Research only, not investment advice.",
  path: "/stock-analysis",
});

export default function StockAnalysisPage({
  searchParams,
}: {
  searchParams: { symbol?: string; tvwidgetsymbol?: string };
}) {
  // `tvwidgetsymbol` is what the home-page heatmap sends when a tile is
  // clicked — TradingView appends it in EXCHANGE:TICKER form. Mapping it here
  // is what keeps those clicks inside Quantifi instead of bouncing the reader
  // out to tradingview.com. Our own `symbol` param wins if both are present.
  const initial = (
    searchParams?.symbol?.toUpperCase() ||
    fromTvSymbol(searchParams?.tvwidgetsymbol) ||
    "NVDA"
  ).toUpperCase();
  // The page itself is open to everyone; free accounts get a couple of analyses
  // for free and StockExplorer shows a Pro upsell beyond that (metered client-side).
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
        {/* A page title, not a gold micro-label. This was a bare Eyebrow — 0.7rem
            uppercase in gold with nothing under it — so the page opened with
            text smaller than its own body copy, in a font and colour used
            nowhere else as a heading. font-display at h1 size is what every
            other page here leads with. */}
        <h1 className="font-display text-[1.9rem] font-bold leading-[1.15] tracking-tight text-white sm:text-[2.3rem]">
          Stock analysis
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          {/* "Quantifi separates the two" used to open this paragraph, with no
              antecedent anywhere on the page — the sentence it referred to had
              been removed. */}
          Search any symbol for a live chart, key statistics and — where we have
          fundamentals — a scorecard that pressures the thesis, not just the
          price.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            "Business quality",
            "Valuation comfort",
            "Cash-flow quality",
            "What's priced in?",
          ].map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300"
            >
              {t}
            </span>
          ))}
        </div>
      </section>
      <Suspense fallback={null}>
        <StockExplorer initial={initial} />
      </Suspense>
    </>
  );
}
