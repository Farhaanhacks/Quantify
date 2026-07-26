/** @type {import('next').NextConfig} */

// ── Security headers ─────────────────────────────────────────────────────────
// Content-Security-Policy + COOP + the standard hardening set. The CSP allowlist
// covers the only third parties the BROWSER loads — TradingView (charts),
// Razorpay (checkout) and Vercel Analytics. Everything else (Yahoo, SEC, NSE,
// BSE, ScraperAPI, Google token exchange…) is fetched server-side from API
// routes, which CSP does not govern, so those stay off the allowlist.
//
// 'unsafe-inline' is required in script-src because the App Router streams inline
// bootstrap/hydration scripts and we ship a tiny inline theme-flash guard; a
// nonce-based strict CSP is the next step up (see the note in the reply). We
// deliberately do NOT include 'unsafe-eval'.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'", // clickjacking: only we may frame our own pages
  "form-action 'self' https://*.razorpay.com https://accounts.google.com",
  "script-src 'self' 'unsafe-inline' https://s3.tradingview.com https://s.tradingview.com https://www.tradingview.com https://*.tradingview-widget.com https://checkout.razorpay.com https://*.razorpay.com https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://*.tradingview.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' data:",
  "worker-src 'self' blob:",
  "connect-src 'self' https://*.tradingview.com https://*.tradingview-widget.com https://*.razorpay.com https://lumberjack.razorpay.com https://va.vercel-scripts.com https://vitals.vercel-insights.com",
  "frame-src 'self' https://*.tradingview.com https://www.tradingview.com https://*.tradingview-widget.com https://*.razorpay.com https://checkout.razorpay.com https://api.razorpay.com",
  "manifest-src 'self'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  // Trusted Types (DOM-based XSS mitigation) in REPORT-ONLY: enforcing it breaks
  // Next.js chunk loading and the TradingView/Razorpay loaders (all assign
  // script.src / innerHTML), so we start by reporting violations without
  // breaking rendering. Drive it to enforcement once the sinks are wrapped in a
  // Trusted Types policy.
  {
    key: "Content-Security-Policy-Report-Only",
    value: "require-trusted-types-for 'script'; trusted-types default dompurify",
  },
  // Isolate our top-level browsing context (Spectre + cross-window tampering).
  // 'allow-popups' so Razorpay's checkout popup / Google OAuth window still work.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" }, // belt-and-suspenders with frame-ancestors
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
