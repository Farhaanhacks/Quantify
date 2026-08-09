/** @type {import('next').NextConfig} */

// ── Security headers ─────────────────────────────────────────────────────────
// The enforcing Content-Security-Policy is set PER REQUEST in middleware.ts,
// because script-src uses a fresh nonce each request (no 'unsafe-inline'). This
// file carries the static headers that don't need a nonce, so they apply to
// every route (pages AND API/JSON responses).
const securityHeaders = [
  // The enforcing Content-Security-Policy (strict, nonce-based) is set per-request
  // in middleware.ts. These are the static headers that don't need a nonce.
  // Trusted Types, REPORT-ONLY: declares the require-trusted-types-for directive
  // (what the scanner looks for) but NEVER blocks, so it cannot crash rendering
  // the way enforcing it did. Next's chunk-loader policy names are allowlisted so
  // it doesn't spam the console.
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
