import ExploreCompanies from "@/components/quantifi/ExploreCompanies";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Explore Companies, ETFs & Markets",
  description: "Browse stocks, ETFs and market themes across the US and India. Research only, not investment advice.",
  path: "/explore",
});

export default function ExplorePage() {
  return <ExploreCompanies />;
}
