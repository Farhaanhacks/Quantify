/** @type {import('next').NextConfig} */

// ── Security headers ─────────────────────────────────────────────────────────
// The enforcing Content-Security-Policy is set PER REQUEST in middleware.ts,
// because script-src uses a fresh nonce each request (no 'unsafe-inline'). This
// file carries the static headers that don't need a nonce, so they apply to
// every route (pages AND API/JSON responses).
const securityHeaders = [
  // Trusted Types (DOM-based XSS mitigation) in REPORT-ONLY: it reports what a
  // future enforcing policy would block, without breaking rendering today. The
  // allowlist names every policy actually created: Next's own 'nextjs' /
  // 'nextjs#bundler' (used to wrap its dynamic chunk scripts as TrustedScriptURL
  // — listing them stops the "policy violates" reports and lets Next mark its
  // scripts trusted), plus 'default' + 'dompurify' for app sinks. 'allow-
  // duplicates' because Next may (re)create its policy across navigations.
  {
    key: "Content-Security-Policy-Report-Only",
    value:
      "require-trusted-types-for 'script'; trusted-types 'allow-duplicates' nextjs nextjs#bundler default dompurify",
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
