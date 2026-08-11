import { Suspense } from "react";
import { cookies } from "next/headers";
import Landing from "@/components/quantifi/Landing";
import MarketHeatmap from "@/components/quantifi/MarketHeatmap";
import { SectionHeading } from "@/components/quantifi/Cards";
import { SESSION_COOKIE, verifySession, authConfig } from "@/lib/auth";
import ResearchPriming from "@/components/quantifi/ResearchPriming";
import PortfolioStocks from "@/components/quantifi/PortfolioStocks";
import PortfolioToday from "@/components/quantifi/PortfolioToday";
import Diversification from "@/components/quantifi/Diversification";
import NewsImpact from "@/components/quantifi/NewsImpact";
import InsiderActivity from "@/components/quantifi/InsiderActivity";
import { getMarketNews } from "@/lib/news";
import { buildMetadata } from "@/lib/seo";

export const metadata = {
  ...buildMetadata({
    title: "Quantifi · Stock Research, Portfolio Analysis & Market Theme Intelligence",
    description:
      "Quantifi helps retail investors analyse stocks, portfolio risk, valuation, market themes, news impact and investment narratives. Research only, not investment advice.",
    path: "/",
  }),
  // Absolute so the layout's "%s · Quantifi" template doesn't append a second "Quantifi".
  title: { absolute: "Quantifi · Stock Research, Portfolio Analysis & Market Theme Intelligence" },
};

// Re-render at most once a minute so the live market strip (and its
// "last updated" timestamp) stay fresh without hammering the data source.
export const revalidate = 60;

// The news feed, split out so it can be suspended.
//
// This await used to sit in HomePage itself, which meant the page returned no
// HTML at all until every RSS feed had been fetched and 60 headlines had been
// scanned for ticker mentions. The route reads cookies, so it is dynamic and
// that work ran on every single request — which is why clicking "Home" from
// another page sat there doing nothing for a beat. Behind a Suspense boundary
// the rest of the page ships immediately and the feed streams in when ready.
async function NewsSection() {
  const news = await getMarketNews().catch(() => []);
  return <NewsImpact items={news} limit={5} />;
}

function NewsSkeleton() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
      <div className="h-5 w-40 animate-pulse rounded bg-white/[0.06]" />
      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-lg bg-white/[0.04]" />
          ))}
        </div>
        <div className="hidden h-[26rem] animate-pulse rounded-lg bg-white/[0.03] lg:block" />
      </div>
    </section>
  );
}

export default async function HomePage() {
  // Signed out, "/" is the front door rather than the product. The session is
  // verified here (not just sniffed for presence, as the edge middleware does)
  // because this decides what content renders, not merely where to redirect.
  const { secret } = authConfig();
  const signedIn = secret
    ? verifySession(cookies().get(SESSION_COOKIE)?.value, secret) != null
    : false;
  if (!signedIn) return <Landing />;

  return (
    <>
      {/* The market, in one picture. This leads the page: it needs no reading
          to interpret, it renders without waiting on our own APIs, and it
          answers "what happened today" before any headline does. */}
      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Market heatmap"
          title="Where the money moved today"
          subtitle="Every S&P 500 company, sized by market cap and coloured by the day's move. Hover any tile for its price, size and change; use the controls to switch index, grouping or measure."
        />
        <div className="mt-6">
          <MarketHeatmap />
        </div>
      </section>

      <Suspense fallback={<NewsSkeleton />}>
        <NewsSection />
      </Suspense>
      <ResearchPriming />
      <PortfolioToday />
      <PortfolioStocks limit={4} />
      <Diversification />
      <InsiderActivity showFilter={false} limit={5} />
    </>
  );
}
