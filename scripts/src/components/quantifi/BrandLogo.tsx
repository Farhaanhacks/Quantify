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
      // ?v= is a cache-buster. Both files are served straight from public/ with
      // a long-lived cache header, so a device or CDN edge that once stored a
      // bad copy would keep serving it indefinitely — bumping this is the only
      // way to force everyone onto a fresh fetch. Bump it if the art changes.
      src={isPro ? "/logo-gold.png?v=2" : "/logo-white.png?v=2"}
      alt="Quantifi"
      // `brand-logo` + plan modifier let globals.css recolour the white
      // (free) wordmark to dark ink in light mode so it stays visible.
      className={`brand-logo ${isPro ? "brand-logo--pro" : "brand-logo--free"} w-auto object-contain ${className}`}
    />
  );
}
