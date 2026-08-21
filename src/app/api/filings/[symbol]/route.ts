import { NextResponse } from "next/server";
import { getCompanyFacts } from "@/lib/filings/store";
import { cacheHeaders } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

// What we hold from a company's own filings, and what we do not.
//
// Rejected facts are returned alongside the published ones, with their reasons.
// That is the point of keeping them: a reader who wants to know why a bank has
// no capital-adequacy figure is owed "the filing tagged it for a period we could
// not match" rather than an absence, and a developer looking at an empty card
// needs to see whether the pipeline read nothing or read something and refused
// it.

function companyIdForSymbol(symbol: string): string {
  const s = symbol.toUpperCase().trim();
  if (/\.NS$/.test(s)) return `provisional:nse:${s.replace(/\.NS$/, "")}`;
  if (/\.BO$/.test(s)) return `provisional:bse:${s.replace(/\.BO$/, "")}`;
  return `provisional:nse:${s}`;
}

export async function GET(
  _req: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = (params.symbol ?? "").slice(0, 32);
  if (!symbol) return NextResponse.json({ error: "No symbol." }, { status: 400 });

  const companyId = companyIdForSymbol(symbol);
  let facts;
  try {
    facts = await getCompanyFacts(companyId);
  } catch {
    return NextResponse.json({ symbol, companyId, available: false, facts: [], rejected: [] });
  }

  const published = facts.filter((f) => !f.rejectedReason);
  const rejected = facts.filter((f) => !!f.rejectedReason);

  return NextResponse.json(
    {
      symbol,
      companyId,
      available: published.length > 0,
      periods: Array.from(new Set(published.map((f) => f.periodEnd).filter(Boolean))).sort().reverse(),
      facts: published,
      rejected: rejected.map((f) => ({
        concept: f.concept,
        sourceConcept: f.sourceConcept,
        periodEnd: f.periodEnd,
        scope: f.scope,
        reason: f.rejectedReason,
      })),
    },
    { headers: cacheHeaders(120, 600) }
  );
}
