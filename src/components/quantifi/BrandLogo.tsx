"use client";

import { useProStatus } from "@/lib/useProStatus";

// Quantifi stacked lockup (Q-arrow icon over the "QUANTIFI" wordmark),
// swapped by plan:
//   Pro subscribers → /logo-gold.png   (all gold)
//   Free accounts   → /logo-white.png  (all white)
// `object-contain` + `w-auto` keep the aspect ratio so it never squishes.
// Default height is set for the stacked artwork so the wordmark stays legible.
export default function BrandLogo({
  className = "h-12",
  forcePro,
}: {
  className?: string;
  // Optional override; when omitted the artwork follows the signed-in plan.
  forcePro?: boolean;
}) {
  const { pro } = useProStatus();
  const isPro = forcePro ?? pro;

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={isPro ? "/logo-gold.png" : "/logo-white.png"}
      alt="Quantifi"
      className={`w-auto object-contain ${className}`}
    />
  );
}
