import PricingPlans from "@/components/quantifi/PricingPlans";
import { Eyebrow } from "@/components/quantifi/Cards";
import { QUANTIFI_PRO } from "@/data/plans";

export const metadata = {
  title: "Quantifi Pro · Pricing",
  description: `Quantifi Pro — ${QUANTIFI_PRO.price}/month (standard price ₹500). Stock Analysis, Insider Activity and Rare Finds.`,
};

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <Eyebrow>Quantifi Pro</Eyebrow>
        <h1 className="mt-3 font-display text-3xl font-semibold text-white sm:text-4xl">
          Unlock Quantifi Pro
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
          Just {QUANTIFI_PRO.price}/month (standard price ₹500) — cancel anytime.
          Everything else in Quantifi stays free. Pro adds the deep-research surfaces —
          Stock Analysis, Insider Activity and Rare Finds. Educational research tools
          only — Quantifi never gives buy, sell or hold advice.
        </p>
      </div>

      <div className="mt-10">
        <PricingPlans />
      </div>

      <p className="mt-8 text-center text-xs text-slate-600">
        Payments are processed securely by Razorpay. You can cancel anytime.
      </p>
    </section>
  );
}
