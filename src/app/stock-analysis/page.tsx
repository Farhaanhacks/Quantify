import { Suspense } from "react";
import StockExplorer from "@/components/quantifi/StockExplorer";
import { fromTvSymbol } from "@/lib/tvSymbol";

export const dynamic = "force-dynamic";

import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Stock Analysis. Search Any Stock or ETF",
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
    <Suspense fallback={null}>
      <StockExplorer initial={initial} />
    </Suspense>
  );
}
