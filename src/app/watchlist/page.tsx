import Watchlist from "@/components/quantifi/Watchlist";

export const metadata = {
  title: "Watchlist",
  description: "Saved stocks, themes, and your research alerts.",
  robots: { index: false, follow: false },
};

export default function WatchlistPage() {
  return <Watchlist />;
}
