import { NextResponse } from "next/server";
import { adminOr404, isNextResponse } from "@/lib/adminGuard";
import { ingestFiling } from "@/lib/filings/adapters/manualUpload";
import type { IndustryType } from "@/lib/filings/concepts";

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
  const gate = adminOr404();
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
  });

  // A duplicate is a success. It means the document was already held, which is
  // exactly what should happen when the same results arrive from both exchanges.
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
