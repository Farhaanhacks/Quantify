import NewsFeed from "@/components/quantifi/NewsFeed";
import { getMarketNews } from "@/lib/news";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Market News Impact — Which Stocks a Headline Moves",
  description:
    "A live feed of market news mapped to the stocks it affects, with the reasoning and what to watch. Research only, not investment advice.",
  path: "/news",
});

// Auto-refresh: Vercel regenerates this page in the background every 30 minutes,
// so the feed stays current without anyone touching it.
export const revalidate = 600;

export default async function NewsPage() {
  const items = await getMarketNews();
  return <NewsFeed items={items} />;
}
