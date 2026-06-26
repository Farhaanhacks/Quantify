import Hero from "@/components/quantifi/Hero";
import MarketPulse from "@/components/quantifi/MarketPulse";
import ResearchPriming from "@/components/quantifi/ResearchPriming";
import PortfolioStocks from "@/components/quantifi/PortfolioStocks";
import PortfolioToday from "@/components/quantifi/PortfolioToday";
import Diversification from "@/components/quantifi/Diversification";
import TradingIdeas from "@/components/quantifi/TradingIdeas";
import NewsImpact from "@/components/quantifi/NewsImpact";
import InsiderActivity from "@/components/quantifi/InsiderActivity";
import ExploreCompanies from "@/components/quantifi/ExploreCompanies";
import { getMarketNews } from "@/lib/news";

// Re-render at most once a minute so the live market strip (and its
// "last updated" timestamp) stay fresh without hammering the data source.
export const revalidate = 60;

export default async function HomePage() {
  // Same live feed that powers /news — the homepage News Impact shows real,
  // current articles, not curated examples.
  const news = await getMarketNews().catch(() => []);

  return (
    <>
      <Hero />
      <MarketPulse />
      <ResearchPriming />
      <PortfolioToday />
      <PortfolioStocks limit={4} />
      <Diversification />
      <TradingIdeas showFilter={false} limit={6} />
      <NewsImpact items={news} limit={5} />
      <InsiderActivity showFilter={false} limit={5} />
      <ExploreCompanies preview />
    </>
  );
}
