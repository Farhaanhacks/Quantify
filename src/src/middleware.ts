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
const PUBLIC_EXACT = new Set<string>(["/"]);
const PUBLIC_PREFIXES = [
  "/ideas",
  "/news",
  "/stock-analysis",
  "/stocks",
  "/screener",
  "/tools",
  "/explore",
  "/rare-finds",
  "/research",
  "/community", // redirects to /ideas
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

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  const signedIn = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  if (signedIn) return NextResponse.next();

  // Not signed in → start the sign-in flow (Google OAuth). The /api/auth/*
  // routes are excluded from the matcher, so this never loops.
  const url = req.nextUrl.clone();
  url.pathname = "/api/auth/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  // Run on everything except API routes, Next internals and static assets.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon.png|apple-icon.png|robots.txt|sitemap.xml|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|avif|css|js|map|txt|xml|woff|woff2|ttf)).*)",
  ],
};
