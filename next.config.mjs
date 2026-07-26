/** @type {import('next').NextConfig} */

// ── Security headers ─────────────────────────────────────────────────────────
// The enforcing Content-Security-Policy is set PER REQUEST in middleware.ts,
// because script-src uses a fresh nonce each request (no 'unsafe-inline'). This
// file carries the static headers that don't need a nonce, so they apply to
// every route (pages AND API/JSON responses).
const securityHeaders = [
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
