import PortfolioManager from "@/components/quantifi/PortfolioManager";
import PortfolioSnowflake from "@/components/quantifi/PortfolioSnowflake";
import PortfolioNews from "@/components/quantifi/PortfolioNews";
import InsiderActivity from "@/components/quantifi/InsiderActivity";
import { Eyebrow } from "@/components/quantifi/Cards";

export const metadata = {
  title: "Portfolio · Quantifi",
  description: "Build and track multiple portfolios, then see the quality snowflake and live news around the names you actually hold.",
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
          gain/loss update as you go. Below, a quality snowflake and live news for the
          names you actually hold. Self-entered data — educational only.
        </p>
      </section>

      <PortfolioManager />
      <PortfolioSnowflake />
      <PortfolioNews />
      <InsiderActivity showFilter={false} limit={5} />
    </>
  );
}
