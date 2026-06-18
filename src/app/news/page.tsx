import NewsFeed from "@/components/quantifi/NewsFeed";
import { getMarketNews } from "@/lib/news";

export const metadata = {
  title: "News Impact · Quantifi",
  description: "A live, continuously updating feed of market news from multiple sources.",
};

// Auto-refresh: Vercel regenerates this page in the background every 30 minutes,
// so the feed stays current without anyone touching it.
export const revalidate = 1800;

export default async function NewsPage() {
  const items = await getMarketNews();
  return <NewsFeed items={items} />;
}
