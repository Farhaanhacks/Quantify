/** @type {import('next').NextConfig} */

// ───────────────────────────────────────────────────────────────────────────
// Content Security Policy
// ───────────────────────────────────────────────────────────────────────────
// Scoped to the exact third parties Quantifi's *browser* loads:
//   • TradingView embed widgets ....... s3./www.tradingview.com  (script + iframe)
//   • Razorpay Checkout ............... *.razorpay.com            (script + iframe + xhr)
//   • Vercel Analytics ................ va.vercel-scripts.com     (script + beacon)
//   • Your own /api/* routes .......... 'self'
// Server-side fetches (Yahoo, SEC, NSE, BSE, FMP, etc.) run in API routes on
// the server and are NOT subject to CSP — they deliberately stay out of it.
//
// Fonts (Lora + Source Serif 4) are self-hosted at build time by next/font, so
// 'self' covers them — no fonts.googleapis / fonts.gstatic entries required.
//
// NOTE on 'unsafe-inline' in script-src: the app ships small inline scripts
// (the pre-paint theme toggle in layout.tsx, JSON-LD blocks) plus Next.js's own
// hydration bootstrap. The clickjacking protection you asked about comes from
// `frame-ancestors` below and is fully effective regardless of this. If you
// later want strict inline-XSS protection too, see SECURITY-HEADERS.md for the
// nonce-based upgrade path.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://s3.tradingview.com https://checkout.razorpay.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://va.vercel-scripts.com https://vitals.vercel-insights.com https://*.tradingview.com https://*.razorpay.com https://lumberjack.razorpay.com",
  "frame-src 'self' https://*.tradingview.com https://*.razorpay.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'self'",   // anti-clickjacking: only your own origin may iframe your pages
  "base-uri 'self'",
  "form-action 'self' https://*.razorpay.com",
  "object-src 'none'",
  "upgrade-insecure-requests",
].join("; ");

// Flip to `true` once to roll CSP out safely: it emits
// Content-Security-Policy-Report-Only, which LOGS violations without blocking.
// Watch the console for a few days, then set back to false to enforce.
const CSP_REPORT_ONLY = false;

const securityHeaders = [
  {
    key: CSP_REPORT_ONLY
      ? "Content-Security-Policy-Report-Only"
      : "Content-Security-Policy",
    value: csp,
  },
  // Cross-Origin-Opener-Policy — isolates your browsing context from windows
  // you open / that open you. `same-origin-allow-popups` (not the stricter
  // `same-origin`) keeps Razorpay's payment/3-D-Secure popups working while
  // still giving you the isolation scanners look for. Google sign-in is a
  // full-page redirect here, so it's unaffected either way.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },

  // Legacy clickjacking header — belt-and-suspenders alongside frame-ancestors.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },

  // Stop MIME-type sniffing (a classic content-confusion/XSS vector).
  { key: "X-Content-Type-Options", value: "nosniff" },

  // Don't leak full URLs (which can carry tickers/query state) to third parties.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },

  // Deny powerful APIs the app never uses.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },

  // Force HTTPS for 2 years. Safe on Vercel (HTTPS-only). Drop
  // `includeSubDomains` if any subdomain is served over plain HTTP; add
  // `; preload` only once you're certain and want to submit to the preload list.
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
];

// Deliberately NOT set: Cross-Origin-Embedder-Policy: require-corp. It would
// give full cross-origin isolation but immediately break TradingView, Razorpay
// and remote images, which don't send the CORP/CORS headers it demands.

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*", // every route: pages, API and static assets
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
