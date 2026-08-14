import { kvGet, kvSet, kvConfigured } from "@/lib/kv";
import { yahooQuoteSummary } from "@/lib/yahooCrumb";
import { aliasSymbol } from "@/lib/symbolAlias";

// Company logos, served from our own origin.
//
// The obvious way to do this is <img src="https://some-logo-cdn/…"> in the row.
// Two reasons not to:
//
//   1. The app's Content-Security-Policy lists every host it will load an image
//      from, and that list is short on purpose. Adding a logo CDN widens it for
//      every page, permanently.
//   2. A third-party image URL per row tells that third party which companies
//      each visitor is looking at. A search box is a stream of intent, and it
//      is not ours to hand over.
//
// So the bytes come through here instead. `img-src 'self'` already covers it,
// the CSP is untouched, and the upstream sees this deployment rather than a
// user. The response is cached hard — a logo is about as static as data gets.
//
// A miss returns 404 rather than a placeholder, so the client can fall back to
// its monogram. A grey box served as a "logo" would look like a broken image;
// a letter tile looks deliberate.

export const dynamic = "force-dynamic";
export const maxDuration = 15;

/** Cache the resolved domain, not the image — the image is cached by HTTP. */
const domainKey = (symbol: string) => `logo:domain:${symbol.toUpperCase()}`;
/** Per-instance memo, so a warm lambda skips even the Redis round trip. */
const memo = new Map<string, string | null>();

function hostOf(url: string): string | null {
  try {
    const h = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return h.replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** The company's own domain, from Yahoo's profile. */
async function resolveDomain(symbol: string): Promise<string | null> {
  if (memo.has(symbol)) return memo.get(symbol) ?? null;

  if (kvConfigured()) {
    const cached = await kvGet(domainKey(symbol));
    // "-" is a remembered miss: without it, every symbol Yahoo has no website
    // for would re-query on every single request.
    if (cached) {
      const val = cached === "-" ? null : cached;
      memo.set(symbol, val);
      return val;
    }
  }

  let domain: string | null = null;
  try {
    const result = await yahooQuoteSummary(symbol, "assetProfile", 86400);
    const ap = (result?.assetProfile ?? {}) as Record<string, unknown>;
    const site = typeof ap.website === "string" ? ap.website : "";
    domain = site ? hostOf(site) : null;
  } catch {
    domain = null;
  }

  memo.set(symbol, domain);
  // kvSet has no TTL in this codebase, and a company's website is stable
  // enough that a permanent key is the honest choice rather than pretending
  // to expire it.
  if (kvConfigured()) await kvSet(domainKey(symbol), domain ?? "-");
  return domain;
}

const notFound = () =>
  new Response(null, {
    status: 404,
    // Cache the miss briefly too. Without this a company with no logo costs a
    // Yahoo lookup on every render of every list it appears in.
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });

export async function GET(req: Request, { params }: { params: { symbol: string } }) {
  const symbol = aliasSymbol(decodeURIComponent(params.symbol || "").trim());
  if (!symbol || symbol.length > 24) return notFound();

  // Ask for a size the DISPLAY can use, not the size the box is in CSS pixels.
  // A 36px tile on a phone at 3x needs 108 real pixels; serving 64 and letting
  // the browser stretch it is exactly the smudge that showed up on mobile.
  // Google's favicon service only serves certain sizes, so the request is
  // snapped up to the next one it supports rather than passed through.
  const want = Number(new URL(req.url).searchParams.get("sz")) || 128;
  const size = [16, 32, 64, 128, 256].find((s) => s >= want) ?? 256;

  const domain = await resolveDomain(symbol);
  if (!domain) return notFound();

  // Google's favicon service, which serves a company's own site icon at a size
  // we ask for. The domain comes from Yahoo's profile, never from the caller,
  // so this cannot be pointed at an arbitrary host.
  const url = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=${size}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), cache: "no-store" });
    if (!res.ok) return notFound();
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return notFound();
    const body = await res.arrayBuffer();
    // Google answers an unknown domain with a tiny generic globe, and this
    // rejects it so the row falls back to a letter tile rather than showing the
    // same grey planet beside a dozen companies.
    //
    // The floor is a flat 120 bytes and must stay low. It was briefly scaled
    // with the requested size — 400 bytes at 128px — on the assumption that a
    // real logo is always heavier than a placeholder. That is not true: a
    // simple flat-colour mark like AMD's compresses to very little at any size,
    // so raising the floor deleted real logos that had been showing. A stray
    // globe is a cosmetic flaw; a missing logo is the thing that was reported.
    if (body.byteLength < 120) return notFound();
    return new Response(body, {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=86400, s-maxage=2592000, stale-while-revalidate=86400",
      },
    });
  } catch {
    return notFound();
  }
}
