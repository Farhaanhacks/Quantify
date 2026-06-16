import PortfolioStocks from "@/components/quantifi/PortfolioStocks";
import Diversification from "@/components/quantifi/Diversification";
import NewsImpact from "@/components/quantifi/NewsImpact";
import InsiderActivity from "@/components/quantifi/InsiderActivity";
import { Eyebrow, GlassCard, SectionHeading, TickerChip } from "@/components/quantifi/Cards";
import { stocksToReview } from "@/data/demo";

export const metadata = {
  title: "Portfolio · Quantifi",
  description: "Your portfolio command center — holdings, concentration, diversification and the news that moves them.",
};

export default function PortfolioPage() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
        <Eyebrow>Portfolio Command Center</Eyebrow>
        <h1 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
          What&apos;s happening inside your portfolio
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Holdings, concentration risk, diversification and the news and insider
          activity touching your names — all in one research view. Demo data.
        </p>
      </section>

      <PortfolioStocks heading={false} />
      <Diversification heading={false} />

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Stocks to review"
          title="On your risk lens"
          subtitle="Names worth a closer look based on weight, momentum and recent activity. Not a recommendation."
        />
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {stocksToReview.map((s) => (
            <GlassCard key={s.ticker} className="p-5">
              <TickerChip ticker={s.ticker} />
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{s.reason}</p>
            </GlassCard>
          ))}
        </div>
      </section>

      <NewsImpact limit={3} />
      <InsiderActivity showFilter={false} limit={5} />
    </>
  );
}
