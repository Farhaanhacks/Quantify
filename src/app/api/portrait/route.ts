// Portraits from Wikimedia Commons, relayed through our own origin.
//
// Same reasoning as /api/logo: the CSP names every host the app will load an
// image from, and widening it for a photograph is a permanent change for one
// feature. Coming through here, `img-src 'self'` already covers it.
//
// The caller passes a Commons FILE NAME, never a URL. Commons derives a
// thumbnail path from the file name's MD5, so the address is computed here and
// the request can only ever go to upload.wikimedia.org. A caller-supplied URL
// would make this an open proxy — anything on the internet fetched by our
// server, with our egress address.

import { createHash } from "crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 15;

const UA = "Quantifi/1.0 (stock research; contact via site)";

const notFound = () =>
  new Response(null, { status: 404, headers: { "Cache-Control": "public, max-age=3600" } });

/**
 * Commons stores a file at /wikipedia/commons/<a>/<ab>/<name>, where a/ab are
 * the first characters of the MD5 of the underscored file name.
 */
function commonsThumb(file: string, width: number): string {
  const name = file.replace(/\s/g, "_");
  const md5 = createHash("md5").update(name).digest("hex");
  const dir = `${md5[0]}/${md5.slice(0, 2)}`;
  const enc = encodeURIComponent(name);
  return `https://upload.wikimedia.org/wikipedia/commons/thumb/${dir}/${enc}/${width}px-${enc}`;
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const file = (sp.get("file") || "").trim();
  // A file name, not a path and not a URL.
  if (!file || file.length > 200 || /[\/\\:?#]/.test(file)) return notFound();
  if (!/\.(jpe?g|png|gif|webp)$/i.test(file)) return notFound();

  const width = Math.min(512, Math.max(64, Number(sp.get("w")) || 160));

  try {
    const res = await fetch(commonsThumb(file, width), {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 604800 },
    });
    if (!res.ok) return notFound();
    const type = res.headers.get("content-type") ?? "";
    if (!type.startsWith("image/")) return notFound();
    return new Response(await res.arrayBuffer(), {
      headers: {
        "Content-Type": type,
        "Cache-Control": "public, max-age=604800, s-maxage=2592000, stale-while-revalidate=86400",
      },
    });
  } catch {
    return notFound();
  }
}
