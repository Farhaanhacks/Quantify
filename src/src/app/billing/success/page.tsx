import Link from "next/link";
import { GlassCard } from "@/components/quantifi/Cards";

export const metadata = { title: "Subscription confirmed", robots: { index: false, follow: false } };

export default function BillingSuccessPage() {
  return (
    <section className="mx-auto max-w-xl px-4 py-24 text-center sm:px-6">
      <GlassCard className="p-8">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-up/15 text-2xl text-up">
          ✓
        </div>
        <h1 className="mt-5 font-display text-2xl font-semibold text-white">
          You&apos;re all set
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">
          Your subscription is confirmed. Thanks for supporting Quantifi — every
          tool is now unlocked for your research.
        </p>
        <Link
          href="/"
          className="mt-6 inline-flex rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-6 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
        >
          Back to dashboard
        </Link>
      </GlassCard>
    </section>
  );
}
