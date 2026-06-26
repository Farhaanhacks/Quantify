import TradingIdeas from "@/components/quantifi/TradingIdeas";

export const metadata = {
  title: "Research Maps · Quantifi",
  description: "Global research themes — not recommendations. Each map lays out the investment question, value chain, bull/base/bear case, thesis tests and source pack.",
};

export default function IdeasPage() {
  return <TradingIdeas showFilter limit={undefined} />;
}
