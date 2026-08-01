import { politeFetch } from "@/lib/ingest/politeFetch";
import { jsonCached } from "@/lib/httpCache";

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

// EDGAR documents are HTML with heavy inline styling and (on older filings)
// nested tables. We want the prose, so scripts/styles go first, block-level tags
// become newlines, and the rest is stripped and collapsed.
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&rsquo;|&apos;/gi, "’")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, "\"")
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

// The readable text of a single EDGAR filing document, for the event detail
// modal. Public-domain government data — no key, no licence.
export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url") || "";

  if (!isAllowedFilingUrl(url)) {
    return jsonCached({ ok: false, reason: "unsupported-url", text: "" }, 60);
  }

  try {
    const r = await politeFetch(url, {
      userAgent: UA,
      revalidateSeconds: 86400,
      accept: "text/html",
      timeoutMs: 9000,
    });
    if (!r.ok) return jsonCached({ ok: false, reason: `status-${r.status}`, text: "" }, 300);

    const html = await r.text();
    const text = htmlToText(html);
    // Filings are immutable once accepted, so this can cache hard.
    return jsonCached({ ok: true, url, text: text.slice(0, 12000) }, 86400, 604800);
  } catch {
    return jsonCached({ ok: false, reason: "fetch-failed", text: "" }, 300);
  }
}
