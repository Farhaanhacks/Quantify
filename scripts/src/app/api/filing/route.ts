import { politeFetch } from "@/lib/ingest/politeFetch";
import { jsonCached } from "@/lib/httpCache";
import { htmlToText, focusOnItem } from "@/lib/filingText";

export const dynamic = "force-dynamic";

const UA =
  process.env.EDGAR_USER_AGENT ||
  "Quantifi/1.0 (personal research app; quantifi-app@users.noreply.github.com)";

// This endpoint takes a URL from the client, so it is a server-side request
// forgery risk by construction. The allowlist below is the whole defence and
// must stay strict: EDGAR's document archive on sec.gov, over https, nothing
// else. Never widen this to "any sec.gov path" or "any host the caller sends".
function isAllowedFilingUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== "https:") return false;
  if (u.hostname !== "www.sec.gov") return false;
  if (!u.pathname.startsWith("/Archives/edgar/data/")) return false;
  // No credentials, no alternate port — both are smuggling vectors.
  if (u.username || u.password || u.port) return false;
  return true;
}

// The readable text of a single EDGAR filing document, for the event detail
// modal. Public-domain government data — no key, no licence.
export async function GET(req: Request) {
  const params = new URL(req.url).searchParams;
  const url = params.get("url") || "";
  // Optional: the 8-K item code this event was classified from, so we can open
  // the document at the relevant section.
  const rawItem = params.get("item") || "";
  const item = /^\d\.\d\d$/.test(rawItem) ? rawItem : undefined;

  if (!isAllowedFilingUrl(url)) {
    return jsonCached({ ok: false, reason: "unsupported-url", text: "" }, 60);
  }

  try {
    // redirect: "manual" is part of the allowlist, not an optimisation. fetch
    // follows redirects by default, so without this the host check would only
    // guard the FIRST hop — a 3xx anywhere under /Archives/ would carry the
    // request off sec.gov and we would return whatever answered.
    const r = await politeFetch(url, {
      userAgent: UA,
      revalidateSeconds: 86400,
      accept: "text/html",
      timeoutMs: 9000,
      redirect: "manual",
    });
    if (r.status >= 300 && r.status < 400) {
      return jsonCached({ ok: false, reason: "redirected", text: "" }, 300);
    }
    if (!r.ok) return jsonCached({ ok: false, reason: `status-${r.status}`, text: "" }, 300);

    const html = await r.text();
    const text = focusOnItem(htmlToText(html), item);
    // Filings are immutable once accepted, so this can cache hard.
    return jsonCached({ ok: true, url, text: text.slice(0, 12000) }, 86400, 604800);
  } catch {
    return jsonCached({ ok: false, reason: "fetch-failed", text: "" }, 300);
  }
}
