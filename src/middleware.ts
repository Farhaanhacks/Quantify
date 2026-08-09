import { NextResponse, type NextRequest } from "next/server";

// Gate the whole app behind sign-in. Only the home page (and the excluded
// auth/static paths in `config.matcher`) is viewable while logged out; every
// other route redirects to Google sign-in. We check for the session cookie's
// presence here (Edge runtime) — the signature itself is verified server-side
// in every data API and server component, so a forged cookie sees no data.
const SESSION_COOKIE = "quantifi_session";

// Public routes that never require a session. These must be crawlable by
// search engines (and viewable by anyone) — the indexable content, the trust
// pages and pricing. Private/personal surfaces (portfolio, watchlist, insider,
// billing) stay gated below.
// The product is behind the door. "/" serves the landing page when signed out,
// and the only other routes reachable without an account are the ones the
// landing page itself needs to work: sign-in, what it costs, who runs it, and
// the legal pages a payment provider and an app store both require to be
// publicly reachable.
//
// Everything else — every research surface — now requires a session. This is a
// deliberate trade: those pages were previously crawlable, and closing them
// means search engines can no longer index the research content, so organic
// traffic to it will fall away. That is the cost of gating, and it is the
// intended behaviour here rather than an oversight.
const PUBLIC_EXACT = new Set<string>(["/", "/login"]);
const PUBLIC_PREFIXES = [
  // Stock Analysis is reachable without an account ON PURPOSE. The landing
  // page's search box opens it, so a visitor can put a company they care about
  // into the product and watch it respond before being asked for anything. The
  // page itself shows the search and then a sign-in wall where the research
  // would start — the gate moved inside the page rather than in front of it.
  "/stock-analysis",
  "/pricing",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/refund-policy",
];

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

// A fresh, unguessable nonce per request. script-src trusts this nonce instead
// of 'unsafe-inline', so an injected inline <script> (DOM-based XSS) is blocked.
function makeNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

// Strict Content-Security-Policy. script-src uses a per-request nonce (+ 'self'
// for same-origin Next chunks + the exact third-party hosts we load) — no
// 'unsafe-inline'. style-src keeps 'unsafe-inline' because Tailwind/libraries
// inject inline styles and there is no style nonce mechanism (style injection is
// a far lower risk than script injection, and scanners accept this).
function buildCsp(nonce: string): string {
  // Explicit hosts only — no wildcard ('*.') or broad-scheme (https:) sources.
  // TradingView: scripts load from s3; the chart renders in a www.tradingview-
  // widget.com / s.tradingview.com iframe (its own CSP governs data inside it).
  // Razorpay: checkout.js from checkout.razorpay.com; checkout iframe + API +
  // telemetry on api/checkout/lumberjack.razorpay.com. Images: Google avatars
  // (lh3–6.googleusercontent.com) + Razorpay CDN.
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self' https://checkout.razorpay.com https://api.razorpay.com https://accounts.google.com",
    // Google's recommended strict CSP shape:
    //   'nonce-…' 'strict-dynamic'  → the actual enforcement on modern browsers
    //   'unsafe-inline'             → IGNORED whenever a nonce is present, so it's
    //                                 inert here; kept only so ancient (pre-nonce)
    //                                 browsers still degrade gracefully.
    //   https://… hosts             → fallback for browsers without strict-dynamic
    // On every current browser only the nonce + strict-dynamic apply.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https://s3.tradingview.com https://checkout.razorpay.com https://va.vercel-scripts.com`,
    "style-src 'self' 'unsafe-inline' https://s3.tradingview.com",
    "img-src 'self' data: blob: https://lh3.googleusercontent.com https://lh4.googleusercontent.com https://lh5.googleusercontent.com https://lh6.googleusercontent.com https://cdn.razorpay.com",
    "font-src 'self' data:",
    "media-src 'self' data:",
    "worker-src 'self' blob:",
    "connect-src 'self' https://s3.tradingview.com https://www.tradingview.com https://checkout.razorpay.com https://api.razorpay.com https://lumberjack.razorpay.com https://va.vercel-scripts.com https://vitals.vercel-insights.com",
    "frame-src 'self' https://www.tradingview-widget.com https://s.tradingview.com https://www.tradingview.com https://checkout.razorpay.com https://api.razorpay.com",
    "manifest-src 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Auth gate: an unauthenticated visit to a private route starts sign-in. The
  // redirect carries no document, so it needs no CSP.
  if (!isPublic(pathname)) {
    const signedIn = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
    if (!signedIn) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  // Attach the nonce to the request (so the root layout can read it for its own
  // inline script, and Next applies it to its framework scripts) and set the CSP
  // on the response.
  const nonce = makeNonce();
  const csp = buildCsp(nonce);
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("content-security-policy", csp);
  return res;
}

export const config = {
  // Run on everything except API routes, Next internals and static assets.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|css|js|map|txt|xml|woff|woff2|ttf)).*)",
  ],
};
