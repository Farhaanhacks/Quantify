import { NextResponse } from "next/server";

// Edge/CDN caching for read-only market-data route handlers. Setting a
// `Cache-Control` header lets Vercel serve repeat requests straight from its CDN
// WITHOUT re-invoking the function — which is what keeps Fluid Active CPU down
// (e.g. the Undervalued Finds scanner fires ~35 /api/score calls at once; with a
// shared cache, only the first cold request per ticker runs the function).
//
//   s-maxage               — how long the CDN serves the cached copy as fresh.
//   stale-while-revalidate — how long it may serve a slightly-stale copy while
//                            ONE background refresh runs (users never wait).
export function cacheHeaders(sMaxAge: number, swr = sMaxAge * 3): Record<string, string> {
  return {
    "Cache-Control": `public, s-maxage=${sMaxAge}, stale-while-revalidate=${swr}`,
  };
}

// NextResponse.json with the CDN cache header attached.
export function jsonCached(data: unknown, sMaxAge: number, swr?: number) {
  return NextResponse.json(data, { headers: cacheHeaders(sMaxAge, swr) });
}
