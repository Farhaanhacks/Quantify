import PricingPlans from "@/components/quantifi/PricingPlans";
import { Eyebrow } from "@/components/quantifi/Cards";

export const metadata = {
  title: "Pricing · Quantifi",
  description: "Simple plans for market discovery and portfolio research.",
};

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <Eyebrow>Pricing</Eyebrow>
        <h1 className="mt-3 font-display text-3xl font-semibold text-white sm:text-4xl">
          Research that pays for itself in clarity
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
          Start free, upgrade when you want the full picture. Educational research
          tools only — Quantifi never gives buy, sell or hold advice.
        </p>
      </div>

      <div className="mt-10">
        <PricingPlans />
      </div>

      <p className="mt-8 text-center text-xs text-slate-600">
        Payments are processed securely by Stripe. Prices shown in INR are illustrative for the prototype.
      </p>
    </section>
  );
}
