"use client";

import { useEffect, useState } from "react";

// A company's logo, served from our own origin.
//
// The bytes come from /api/logo/<symbol>, never straight from a logo CDN — the
// Content-Security-Policy stays closed and the vendor never learns which
// companies a given visitor is looking at. See that route for the rest.
//
// Two fallbacks, and the choice matters:
//
//   "letter" — a monogram tile. Right in a list, where every row needs the same
//              shape or the names stop lining up.
//   "none"   — render nothing at all. Right in the page header, where a lone
//              two-letter square next to the company's name is just a restated
//              ticker taking up space. That capsule was in the header before and
//              was removed for exactly that reason; a real logo belongs there,
//              a stand-in for one does not.
export default function CompanyLogo({
  symbol,
  name,
  size = 36,
  fallback = "letter",
  className = "",
}: {
  symbol?: string;
  name?: string;
  size?: number;
  fallback?: "letter" | "none";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  // Which background the logo will sit on. Logo.dev serves a variant per theme,
  // and a dark wordmark on a dark row is invisible — so the theme has to travel
  // with the request, and the request has to change when the reader switches.
  // Watched rather than read once, for the same reason the theme toggle watches
  // it: the account menu can change it from elsewhere.
  const [light, setLight] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const sync = () => setLight(el.classList.contains("light"));
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => mo.disconnect();
  }, []);

  // A theme switch means a different image, so the failure flag from the old one
  // must not suppress the new one.
  useEffect(() => setFailed(false), [symbol, light]);

  const box = `flex flex-none items-center justify-center overflow-hidden rounded-md border border-white/10 bg-white/[0.05] ${className}`;
  const style = { width: size, height: size };

  if (!symbol || failed) {
    if (fallback === "none") return null;
    const letter = (name || symbol || "?").trim().charAt(0).toUpperCase();
    return (
      <span
        className={`${box} font-display font-semibold text-slate-300`}
        style={{ ...style, fontSize: Math.round(size * 0.4) }}
      >
        {letter}
      </span>
    );
  }

  return (
    <span className={box} style={style}>
      {/* eslint-disable-next-line @next/next/no-img-element -- next/image would
          route this through the optimiser for a small icon that /api/logo has
          already cached at the edge. */}
      <img
        // Ask for twice the CSS size: a 36px tile on a phone at 3x needs real
        // pixels, and stretching a 36px image is the smudge this fixed.
        src={`/api/logo/${encodeURIComponent(symbol)}?sz=${Math.min(256, size * 4)}&theme=${
          light ? "light" : "dark"
        }`}
        alt=""
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        className="h-full w-full object-contain p-1"
      />
    </span>
  );
}
