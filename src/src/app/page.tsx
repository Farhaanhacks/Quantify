import ResearchPriming from "@/components/quantifi/ResearchPriming";
import PortfolioStocks from "@/components/quantifi/PortfolioStocks";
import PortfolioToday from "@/components/quantifi/PortfolioToday";
import Diversification from "@/components/quantifi/Diversification";
import NewsImpact from "@/components/quantifi/NewsImpact";
import InsiderActivity from "@/components/quantifi/InsiderActivity";
import { getMarketNews } from "@/lib/news";
import { buildMetadata } from "@/lib/seo";

export const metadata = {
  ...buildMetadata({
    title: "Quantifi — Stock Research, Portfolio Analysis & Market Theme Intelligence",
    description:
      "Quantifi helps retail investors analyse stocks, portfolio risk, valuation, market themes, news impact and investment narratives. Research only, not investment advice.",
    path: "/",
  }),
  // Absolute so the layout's "%s · Quantifi" template doesn't append a second "Quantifi".
  title: { absolute: "Quantifi — Stock Research, Portfolio Analysis & Market Theme Intelligence" },
};

// Re-render at most once a minute so the live market strip (and its
// "last updated" timestamp) stay fresh without hammering the data source.
export const revalidate = 60;

export default async function HomePage() {
  // Same live feed that powers /news — the homepage News Impact shows real,
  // current articles, not curated examples.
  const news = await getMarketNews().catch(() => []);

  return (
    <>
      {/* News Impact leads the page — the live feed is the first thing a
          visitor sees, ahead of the research framing and the portfolio
          modules. There is no hero above it. */}
      <NewsImpact items={news} limit={5} />
      <ResearchPriming />
      <PortfolioToday />
      <PortfolioStocks limit={4} />
      <Diversification />
      <InsiderActivity showFilter={false} limit={5} />
    </>
  );
}
