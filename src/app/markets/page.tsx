import Markets from "@/components/quantifi/Markets";
import DiscoverNav from "@/components/quantifi/DiscoverNav";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Market Analysis & Valuation — Sectors, Returns and Movers",
  description:
    "How a whole market is priced and how it has traded: aggregate P/E, index performance, sector returns and the companies driving them — built bottom-up from live company quotes. Research only, not investment advice.",
  path: "/markets",
});

export default function MarketsPage() {
  return (
    <>
      <DiscoverNav />
      <Markets />
    </>
  );
}
