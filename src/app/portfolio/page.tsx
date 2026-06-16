import PortfolioManager from "@/components/quantifi/PortfolioManager";
import NewsImpact from "@/components/quantifi/NewsImpact";
import InsiderActivity from "@/components/quantifi/InsiderActivity";
import { Eyebrow } from "@/components/quantifi/Cards";

export const metadata = {
  title: "Portfolio · Quantifi",
  description: "Build and track multiple portfolios, then see the news and insider activity around your names.",
};

export default function PortfolioPage() {
  return (
    <>
      <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
        <Eyebrow>Portfolio Command Center</Eyebrow>
        <h1 className="mt-3 max-w-2xl font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
          Your portfolios, your way
        </h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-slate-400">
          Create multiple portfolios, add holdings by hand, and watch value and
          gain/loss update as you go. Below, the market context around the kinds of
          names you track. Demo and self-entered data — educational only.
        </p>
      </section>

      <PortfolioManager />
      <NewsImpact limit={3} />
      <InsiderActivity showFilter={false} limit={5} />
    </>
  );
}
