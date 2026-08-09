import Screener from "@/components/quantifi/Screener";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Stock Screener — Filter by Score, Valuation, Sector & Region",
  description:
    "Screen stocks live by Quantifi score, valuation gap, sector and region — computed from current fundamentals. Research only, not investment advice.",
  path: "/screener",
});

export default function ScreenerPage() {
  return <Screener />;
}
