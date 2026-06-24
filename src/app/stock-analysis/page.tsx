import { Suspense } from "react";
import StockExplorer from "@/components/quantifi/StockExplorer";
import { Eyebrow } from "@/components/quantifi/Cards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Stock Analysis · Quantifi",
  description: "Search any stock or ETF for a live chart, key stats and — where available — the Quantifi Score.",
};

export default function StockAnalysisPage({
  searchParams,
}: {
  searchParams: { symbol?: string };
}) {
  const initial = (searchParams?.symbol ?? "NVDA").toUpperCase();
  // The page itself is open to everyone; free accounts get a couple of analyses
  // for free and StockExplorer shows a Pro upsell beyond that (metered client-side).
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
        <Eyebrow>Stock Analysis</Eyebrow>
        <h1 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Analyze any stock or ETF
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Search any symbol for a live chart and key statistics. The Quantifi
          Score shows for names we have fundamentals on, and for every stock once
          a fundamentals source is connected.
        </p>
      </section>
      <Suspense fallback={null}>
        <StockExplorer initial={initial} />
      </Suspense>
    </>
  );
}
