import Link from "next/link";
import type { ReactNode } from "react";
import { GlassCard, Eyebrow } from "@/components/quantifi/Cards";
import { currentUser } from "@/lib/serverSession";
import { isEmailPro } from "@/lib/access";
import {
  QUANTIFI_PRO,
  FREE_LAUNCH_OFFER,
  FREE_LAUNCH_DAYS,
  PRO_PRICE_LABEL,
  PRO_PRICE_NOTE,
  PRO_STANDARD_PRICE,
} from "@/data/plans";

// Server-side gate around Quantifi Pro features. Renders children only for an
// active Pro subscriber; otherwise shows an upgrade wall.
export default async function ProGate({
  feature,
  children,
}: {
  feature: string;
  children: ReactNode;
}) {
  const user = currentUser();
  const pro = await isEmailPro(user?.email);
  if (pro) return <>{children}</>;

  const signedIn = Boolean(user?.email);

  return (
    <section className="mx-auto max-w-2xl px-4 py-20 sm:px-6">
      <GlassCard className="border-gold/30 bg-gold/[0.04] p-8 text-center">
        <Eyebrow>Quantifi Pro</Eyebrow>
        <h1 className="mt-4 font-display text-2xl font-semibold text-white sm:text-3xl">
          {feature} is part of Quantifi Pro
        </h1>
        {/* Same fix as the analysis wall: this quoted the paid price even while
            the launch offer made Pro free. */}
        {FREE_LAUNCH_OFFER ? (
          <>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
              Unlock {feature} along with the rest of the Pro research suite —{" "}
              <span className="font-semibold text-gold">free</span> for your first{" "}
              {FREE_LAUNCH_DAYS} days, no card needed.
            </p>
            <div className="mt-5 inline-flex items-baseline gap-2.5 rounded-lg border border-gold/30 bg-gold/[0.07] px-4 py-2.5">
              <span className="font-display text-3xl font-semibold text-gold">{PRO_PRICE_LABEL}</span>
              <span className="font-display text-lg font-medium text-slate-500 line-through decoration-slate-400/70">
                {PRO_STANDARD_PRICE}
              </span>
              <span className="text-xs text-slate-400">{PRO_PRICE_NOTE}</span>
            </div>
          </>
        ) : (
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-400">
            Unlock {feature} along with the rest of the Pro research suite for{" "}
            <span className="font-semibold text-gold">
              {QUANTIFI_PRO.price}/{QUANTIFI_PRO.period}
            </span>
            . Everything else in Quantifi stays free.
          </p>
        )}

        {signedIn ? (
          <p className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-slate-500">
            Signed in as <span className="text-slate-300">{user!.email}</span>. If you
            just upgraded (or were granted Pro), refresh this page — it can take a
            moment. Still locked? Make sure this is the exact email on your Pro plan.
          </p>
        ) : null}

        <ul className="mx-auto mt-6 inline-flex flex-col gap-2 text-left text-sm text-slate-300">
          {QUANTIFI_PRO.proFeatures.map((f) => (
            <li key={f} className="flex items-center gap-2.5">
              <span className="text-gold">★</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/pricing"
            className="rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-6 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            {FREE_LAUNCH_OFFER ? "Claim free Pro" : signedIn ? "Upgrade to Pro" : "See Quantifi Pro"}
          </Link>
          {!signedIn ? (
            <a
              href="/api/auth/login"
              className="rounded-full border border-white/15 px-6 py-2.5 text-sm font-medium text-white transition hover:border-gold/40"
            >
              Sign in
            </a>
          ) : null}
        </div>
      </GlassCard>
    </section>
  );
}
