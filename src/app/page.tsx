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

export default function HomePage() {
  return (
    <>
      <Hero />
      <MarketPulse />
      <ResearchPriming />
      <PortfolioToday />
      <PortfolioStocks limit={4} />
      <Diversification />
      <TradingIdeas showFilter={false} limit={6} />
      <NewsImpact limit={4} />
      <InsiderActivity showFilter={false} limit={5} />
      <ExploreCompanies preview />
    </>
  );
}
