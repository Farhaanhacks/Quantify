import StockAnalysis from "@/components/quantifi/StockAnalysis";
import CompanySnapshot from "@/components/quantifi/CompanySnapshot";
import TradingViewWidget from "@/components/quantifi/TradingViewWidget";
import { tvSymbol } from "@/lib/tvSymbol";
import { Eyebrow } from "@/components/quantifi/Cards";
import { stockAnalysis, stockByTicker } from "@/data/demo";

export const metadata = {
  title: "Stock Analysis · Quantifi",
  description: "One stock connected to its Quantifi Score, fair value, live chart, news, insiders and risk lenses.",
};

export default function StockAnalysisPage() {
  const ex = stockByTicker[stockAnalysis.ticker]?.exchange;
  return (
    <>
      <StockAnalysis />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <Eyebrow>Live Chart</Eyebrow>
        <h2 className="mt-3 font-display text-2xl font-semibold text-white">
          {stockAnalysis.ticker} price action
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Real-time chart embedded from TradingView&apos;s official widget — no scraping, attribution kept.
        </p>
        <div className="mt-5">
          <TradingViewWidget symbol={tvSymbol(stockAnalysis.ticker, ex)} height={460} />
        </div>
      </section>

      <CompanySnapshot ticker={stockAnalysis.ticker} />
    </>
  );
}
