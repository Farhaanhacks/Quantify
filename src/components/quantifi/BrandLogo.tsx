"use client";

import type { CSSProperties } from "react";
import { useProStatus } from "@/lib/useProStatus";

// The brand mark lives in /logo-icon.png as a transparent-background shape, so
// we render it through a CSS mask. That lets us (a) recolour it — gold for Pro
// subscribers, white for everyone else — and (b) keep it perfectly sized with
// `mask-size: contain` against its true aspect ratio (234×182), so it never
// looks squished regardless of the height it's dropped into.
const maskStyle: CSSProperties = {
  WebkitMaskImage: "url(/logo-icon.png)",
  maskImage: "url(/logo-icon.png)",
  WebkitMaskRepeat: "no-repeat",
  maskRepeat: "no-repeat",
  WebkitMaskPosition: "center",
  maskPosition: "center",
  WebkitMaskSize: "contain",
  maskSize: "contain",
};

export default function BrandLogo({
  className = "h-8",
  forcePro,
}: {
  className?: string;
  // Optional override; when omitted the colour follows the signed-in plan.
  forcePro?: boolean;
}) {
  const { pro } = useProStatus();
  const isPro = forcePro ?? pro;

  return (
    <span
      role="img"
      aria-label="Quantifi"
      style={maskStyle}
      className={`block w-auto shrink-0 aspect-[117/91] ${className} ${
        isPro ? "bg-gradient-to-br from-gold-400 via-gold-500 to-gold-600" : "bg-white"
      }`}
    />
  );
}
