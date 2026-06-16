import TradingIdeas from "@/components/quantifi/TradingIdeas";

export const metadata = {
  title: "Investing Ideas · Quantifi",
  description: "Themed investing and trading ideas to research — filter by category.",
};

export default function IdeasPage() {
  return <TradingIdeas showFilter limit={undefined} />;
}
