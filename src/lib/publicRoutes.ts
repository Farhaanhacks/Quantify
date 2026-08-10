// The single list of routes reachable without an account.
//
// This exists because two files were answering that question separately and
// disagreeing. The middleware gated the research pages while the sitemap went
// on advertising all of them to Google, so a crawler was handed 165 URLs that
// every one of them redirected to a noindex sign-in page. That is worse than
// not listing them: it spends crawl budget to prove the pages are dead.
//
// Both the gate and the sitemap now read from here, so the two cannot drift
// apart again.

/** Exact paths anyone may open. */
export const PUBLIC_EXACT: readonly string[] = ["/", "/login"];

/** Path prefixes anyone may open (the path itself, or anything beneath it). */
export const PUBLIC_PREFIXES: readonly string[] = [
  // Stock Analysis is public on purpose: the landing page's search opens it, so
  // a visitor can put a company they care about into the product before being
  // asked for anything. The sign-up wall sits inside the page, at the score.
  "/stock-analysis",
  "/pricing",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/refund-policy",
];

export function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.includes(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
