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
          Good company, or good investment?
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Quantifi separates the two. Search any symbol for a live chart, key
          statistics and — where we have fundamentals — a scorecard that pressures
          the thesis, not just the price.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {[
            "Business quality",
            "Valuation comfort",
            "Cash-flow quality",
            "What's priced in?",
          ].map((t) => (
            <span
              key={t}
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs text-slate-300"
            >
              {t}
            </span>
          ))}
        </div>
      </section>
      <Suspense fallback={null}>
        <StockExplorer initial={initial} />
      </Suspense>
    </>
  );
}
