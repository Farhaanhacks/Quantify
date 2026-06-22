"use client";

import { useProStatus } from "@/lib/useProStatus";

// Renders the Quantifi wordmark logo, swapping artwork by plan:
//   Pro subscribers  → /logo-gold.png   (gold)
//   Free accounts    → /logo-white.png  (white)
// `object-contain` + `w-auto` keep the true aspect ratio, so it never squishes
// no matter what height it's dropped into.
export default function BrandLogo({
  className = "h-9",
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
