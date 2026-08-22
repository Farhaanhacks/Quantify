import { NextResponse } from "next/server";
import { adminOr404, isNextResponse } from "@/lib/adminGuard";
import { discoverBseResults } from "@/lib/filings/adapters/bseAnnouncements";
import { ingestFiling } from "@/lib/filings/adapters/manualUpload";
import { INDIAN_BANKS } from "@/data/indianBanks";
import type { IndustryType } from "@/lib/filings/concepts";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Find and ingest a company's results filings, without leaving the browser.
//
// Diagnostic first, ingest second. The default is to report what the BSE
// returned and stop, because the questions that matter when this does not work
// are all answerable from that report and from nothing else: was the request
// blocked, did the company file in this window, was there an XBRL attachment,
// and which categories came back. An endpoint that returned "0 filings" for all
// four would be worse than useless.

export async function POST(req: Request) {
  const gate = adminOr404();
  if (isNextResponse(gate)) return gate;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* an empty body is fine; the symbol can come from the query string */
  }
  const url = new URL(req.url);
  const symbol = String(body.symbol ?? url.searchParams.get("symbol") ?? "").trim();
  if (!symbol) return NextResponse.json({ error: "symbol is required." }, { status: 400 });

  const ingest = body.ingest === true || url.searchParams.get("ingest") === "1";
  const days = Number(body.days ?? url.searchParams.get("days") ?? 400);

  const found = await discoverBseResults({ symbol, days: isFinite(days) ? days : 400 });

  // The industry decides which tags mean what, so it is looked up rather than
  // assumed. A company that is not in the bank master is not a bank, and giving
  // it a bank's concept table would map its treasury income to interest earned.
  const bank = INDIAN_BANKS.find(
    (b) => b.symbol.toUpperCase().replace(/\.(NS|BO)$/, "") === symbol.toUpperCase().replace(/\.(NS|BO)$/, "")
  );
  const industry: IndustryType = bank ? "bank" : "ordinary";

  const report = {
    symbol,
    industry,
    knownAsBank: !!bank,
    found: found.filings.length,
    unavailableReason: found.unavailableReason,
    notes: found.notes,
    documents: found.filings.map((f) => ({
      exchangeFilingId: f.exchangeFilingId,
      category: f.category,
      filedAt: f.filedAt,
      sourceUrl: f.sourceUrl,
      bytes: f.content.length,
    })),
    ingested: [] as unknown[],
  };

  if (!ingest || !found.filings.length) return NextResponse.json(report);

  for (const f of found.filings) {
    const result = await ingestFiling({
      companyId: bank?.companyId ?? `provisional:nse:${symbol.toUpperCase().replace(/\.(NS|BO)$/, "")}`,
      industry,
      content: f.content,
      format: "xbrl",
      source: "bse",
      sourceUrl: f.sourceUrl,
      exchangeFilingId: f.exchangeFilingId,
      category: f.category,
      submittedAt: f.filedAt,
      symbols: bank ? [bank.symbol] : [symbol.toUpperCase()],
    });
    report.ingested.push({ sourceUrl: f.sourceUrl, ...result });
  }
  return NextResponse.json(report);
}
