import Link from "next/link";
import { GlassCard } from "@/components/quantifi/Cards";

export const metadata = { title: "Checkout cancelled · Quantifi" };

export default function BillingCancelPage() {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <GlassCard className="p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] text-2xl text-slate-400">
          ←
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold text-white">
          No charge made
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Your checkout was cancelled, so nothing was charged. You can pick a plan
          whenever you&apos;re ready.
        </p>
        <Link
          href="/pricing"
          className="mt-6 inline-flex rounded-full border border-white/15 px-6 py-2.5 text-sm font-medium text-white transition hover:border-gold/40"
        >
          Back to pricing
        </Link>
      </GlassCard>
    </section>
  );
}
