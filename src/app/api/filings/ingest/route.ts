import { NextResponse } from "next/server";
import { adminOr404, isNextResponse } from "@/lib/adminGuard";
import { ingestFiling } from "@/lib/filings/adapters/manualUpload";
import type { IndustryType } from "@/lib/filings/concepts";

/**
 * Two ways in, for two kinds of caller.
 *
 * A bearer token is what the ingest actually runs on: a cron job, an SFTP
 * drop, a script on a laptop. A cookie is the wrong credential for any of them
 * — it belongs to a browser session, it cannot be handed to a scheduler, and a
 * route that accepts one is a route a cross-site form post can reach.
 *
 * The admin session is still accepted, and only for the panel on /admin, which
 * has a signed-in human in front of it and no token to carry. That path is
 * additionally gated on the request looking like a fetch from this origin
 * rather than a form submission from someone else's page, which is the whole of
 * what makes a cookie dangerous here.
 */
function authorise(req: Request): { ok: true; via: "token" | "session" } | NextResponse {
  const secret = process.env.FILINGS_INGEST_SECRET;
  const header = req.headers.get("authorization") ?? "";
  const presented = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";

  if (secret && presented) {
    // Constant time, so a wrong token cannot be narrowed down by timing it.
    if (presented.length === secret.length && timingSafeEqual(presented, secret)) {
      return { ok: true, via: "token" };
    }
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // A browser POST from the admin panel. Cross-site form posts cannot set this
  // header, so requiring it is what stops a cookie being usable from elsewhere.
  const sameOrigin = req.headers.get("x-quantifi-ingest") === "1";
  if (!sameOrigin) return NextResponse.json({ error: "not found" }, { status: 404 });
  const gate = adminOr404();
  if (isNextResponse(gate)) return gate;
  return { ok: true, via: "session" };
}

/** Compare two strings without leaking how far they matched. */
function timingSafeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i % b.length);
  return diff === 0;
}

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Ingesting one filing by hand.
//
// Admin only, and not because the data is secret: this endpoint takes a document
// and writes facts that the company pages then present as sourced from the
// filer. Anyone who can post here can put a number on the site with a citation
// attached to it, which is a more consequential power than most write endpoints
// have.
//
// A filing is a few megabytes, so the body limit is generous by this codebase's
// standards and still bounded. An unbounded parser fed by an upload box is how a
// service is taken down by one request.

const MAX_BODY = 24 * 1024 * 1024;

const INDUSTRIES: IndustryType[] = ["ordinary", "bank", "nbfc", "life-insurer", "general-insurer"];

export async function POST(req: Request) {
  const gate = authorise(req);
  if (isNextResponse(gate)) return gate;

  const length = Number(req.headers.get("content-length") ?? 0);
  if (length > MAX_BODY) {
    return NextResponse.json({ error: "Document too large." }, { status: 413 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
  }

  const str = (k: string): string | undefined =>
    typeof body[k] === "string" && (body[k] as string).trim() ? (body[k] as string).trim() : undefined;

  const content = typeof body.content === "string" ? body.content : "";
  const companyId = str("companyId");
  const industry = str("industry") as IndustryType | undefined;

  if (!content) return NextResponse.json({ error: "No document content." }, { status: 400 });
  if (content.length > MAX_BODY) return NextResponse.json({ error: "Document too large." }, { status: 413 });
  if (!companyId) return NextResponse.json({ error: "companyId is required." }, { status: 400 });
  // The industry decides which tags mean what, so it cannot be guessed and it
  // cannot be read out of the document: a filing full of deposit tags does not
  // prove the filer is a bank, it proves the document says so.
  if (!industry || !INDUSTRIES.includes(industry)) {
    return NextResponse.json(
      { error: `industry must be one of: ${INDUSTRIES.join(", ")}` },
      { status: 400 }
    );
  }

  const format = (str("format") ?? "xbrl") as "xbrl" | "xhtml" | "html" | "pdf-text" | "pdf-scanned";
  const source = (str("source") ?? "manual") as "manual" | "investor-relations" | "nse" | "bse";

  const result = await ingestFiling({
    companyId,
    industry,
    content,
    format,
    source,
    sourceUrl: str("sourceUrl"),
    periodEnd: str("periodEnd"),
    periodStart: str("periodStart"),
    expectedPeriodMonths:
      typeof body.expectedPeriodMonths === "number" ? body.expectedPeriodMonths : undefined,
    scope: str("scope") as "standalone" | "consolidated" | undefined,
    category: str("category"),
    submittedAt: str("submittedAt"),
    exchangeFilingId: str("exchangeFilingId"),
    // Without these the filing is stored correctly and read by nothing: the
    // page looks a company up by symbol and the filing is keyed by identifier.
    symbols: Array.isArray(body.symbols)
      ? (body.symbols as unknown[]).filter((x): x is string => typeof x === "string").slice(0, 8)
      : undefined,
  });

  // A duplicate is a success. It means the document was already held, which is
  // exactly what should happen when the same results arrive from both exchanges.
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
