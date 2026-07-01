import Link from "next/link";
import PricingPlans from "@/components/quantifi/PricingPlans";
import { Eyebrow } from "@/components/quantifi/Cards";
import { QUANTIFI_PRO } from "@/data/plans";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: `Pricing — Quantifi Pro (${QUANTIFI_PRO.price}/month)`,
  description: `Quantifi Pro — ${QUANTIFI_PRO.price}/month (standard ₹500). Unlimited stock analysis, all research ideas, full source packs and portfolio diagnosis. Research only, not investment advice.`,
  path: "/pricing",
});

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center">
        <Eyebrow>Quantifi Pro</Eyebrow>
        <h1 className="mt-3 font-display text-3xl font-semibold text-white sm:text-4xl">
          Built for better market thinking.
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-slate-400">
          Just {QUANTIFI_PRO.price}/month (standard price ₹500) — cancel anytime.
          Everything else in Quantifi stays free. Pro adds the deep-research surfaces —
          Stock Analysis, Insider Activity and Rare Finds. Because better market
          thinking should be more accessible. Educational research tools only —
          Quantifi never gives buy, sell or hold advice.
        </p>
      </div>

      <div className="mt-10">
        <PricingPlans />
      </div>

      <div className="mt-8 space-y-3 text-center">
        <p className="text-xs text-slate-500">
          🔒 Payments are securely processed by <span className="text-slate-300">Razorpay</span>. Quantifi
          never sees or stores your card, UPI or bank details. Quantifi Pro auto-renews monthly; cancel
          anytime.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-slate-500">
          {[
            { href: "/terms", label: "Terms of Service" },
            { href: "/privacy", label: "Privacy Policy" },
            { href: "/refund-policy", label: "Refund & Cancellation" },
            { href: "/contact", label: "Contact" },
          ].map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-gold">
              {l.label}
            </Link>
          ))}
        </div>
        <p className="text-[0.7rem] text-slate-600">
          Quantifi is for research and education only. Not investment advice.
        </p>
      </div>
    </section>
  );
}
