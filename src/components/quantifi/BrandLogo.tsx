"use client";

import { useProStatus } from "@/lib/useProStatus";

// Quantifi brand mark — the compact Q icon, swapped by plan:
//   Pro subscribers → /logo-icon-gold.png  (gold)
//   Free accounts   → /logo-icon.png       (white)
// Both files are the same 234×182 artwork, so the size never changes between
// plans. `object-contain` + `w-auto` keep the aspect ratio at any height.
export default function BrandLogo({
  className = "h-8",
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
      src={isPro ? "/logo-icon-gold.png" : "/logo-icon.png"}
      alt="Quantifi"
      className={`w-auto object-contain ${className}`}
    />
  );
}
