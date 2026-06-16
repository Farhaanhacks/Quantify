import StockAnalysis from "@/components/quantifi/StockAnalysis";
import CompanySnapshot from "@/components/quantifi/CompanySnapshot";
import { stockAnalysis } from "@/data/demo";

export const metadata = {
  title: "Stock Analysis · Quantifi",
  description: "One stock connected to its Quantifi Score, fair value, news, insiders and risk lenses.",
};

export default function StockAnalysisPage() {
  return (
    <>
      <StockAnalysis />
      <CompanySnapshot ticker={stockAnalysis.ticker} />
    </>
  );
}
