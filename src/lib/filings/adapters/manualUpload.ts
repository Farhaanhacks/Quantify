import {
  contentHashOf,
  alreadyIngested,
  saveFiling,
  storeRawDocument,
  recordError,
  linkSymbol,
} from "@/lib/filings/store";
import { extractFromXbrl } from "@/lib/filings/extract";
import { PARSER_VERSION, type Filing, type FilingFact } from "@/lib/filings/types";
import type { IndustryType } from "@/lib/filings/concepts";

// Ingesting a filing somebody handed us.
//
// This is the FIRST adapter rather than a fallback, and the order is deliberate.
// The NSE's commercial feed is expensive and the BSE's needs a contract, so
// paying for either before the reader works would be buying a firehose to test a
// tap. Everything downstream of this function is identical whichever adapter
// filled it, so a licensed feed later is a new caller and not a new pipeline.
//
// It is also the path that stays useful afterwards. Filings go missing from
// exchange feeds, older ones were never in them, and a company's own investor
// relations page carries documents the exchange never received.

export interface IngestRequest {
  companyId: string;
  industry: IndustryType;
  /** The document, as text. */
  content: string;
  format: "xbrl" | "xhtml" | "html" | "pdf-text" | "pdf-scanned";
  source: "manual" | "investor-relations" | "nse" | "bse";
  sourceUrl?: string;
  periodEnd?: string;
  periodStart?: string;
  expectedPeriodMonths?: number;
  scope?: "standalone" | "consolidated";
  category?: string;
  submittedAt?: string;
  exchangeFilingId?: string;
  /**
   * Trading symbols this company is reached by, e.g. ["HDFCBANK.NS", "HDFCBANK.BO"].
   *
   * Filings are keyed on ISIN or CIN and pages are reached by symbol, so
   * something has to join the two. Without this, a filing ingested under a
   * proper identifier is invisible to the page that should read it, and
   * invisible silently: the card goes on saying the data is unavailable while
   * the data sits in the database.
   */
  symbols?: string[];
}

export interface IngestResult {
  ok: boolean;
  filingId?: string;
  contentHash?: string;
  /** True when this exact document was already held. Not an error. */
  duplicate?: boolean;
  facts?: number;
  rejected?: number;
  unmapped?: string[];
  issues?: { concept: string; reason: string }[];
  /** Whether the untouched original was actually written somewhere. */
  rawStored?: boolean;
  rawStoreReason?: string;
  error?: string;
}

export async function ingestFiling(req: IngestRequest): Promise<IngestResult> {
  if (!req.content || !req.content.trim()) return { ok: false, error: "Empty document." };
  if (!req.companyId) return { ok: false, error: "No company id." };

  const contentHash = await contentHashOf(req.content);

  // The same results go to both exchanges, and a company re-uploads its own
  // documents. Ingesting twice would double every fact, and because the copies
  // agree exactly, nothing downstream would notice.
  if (await alreadyIngested(req.companyId, contentHash)) {
    return { ok: true, duplicate: true, contentHash };
  }

  const filingId = `filing_${contentHash.slice(0, 16)}`;

  // The original is written BEFORE it is parsed. Every fact this pipeline
  // publishes claims to come from a specific place in a specific document, and
  // that claim is only checkable while the document still exists as it was read
  // — re-fetching later is not the same thing, because exchanges replace files
  // in place when a company re-files.
  const raw = await storeRawDocument(contentHash, req.content);

  if (req.format !== "xbrl") {
    // Honest rather than partial. An HTML or PDF reader that guessed at tables
    // would produce facts indistinguishable from tagged ones, and the whole
    // design here rests on knowing how a figure was read.
    await recordError({
      at: new Date().toISOString(),
      companyId: req.companyId,
      filingId,
      stage: "parse",
      message: `No reader for ${req.format} yet; the document is stored but not parsed.`,
    });
    return {
      ok: false,
      filingId,
      contentHash,
      rawStored: raw.stored,
      rawStoreReason: raw.reason,
      error: `Stored, but there is no ${req.format} reader yet. Only XBRL is parsed today.`,
    };
  }

  const extracted = extractFromXbrl(req.content, {
    filingId,
    companyId: req.companyId,
    industry: req.industry,
    periodEnd: req.periodEnd,
    expectedPeriodMonths: req.expectedPeriodMonths,
    scope: req.scope,
  });

  if (extracted.errors.length && !extracted.facts.length) {
    await recordError({
      at: new Date().toISOString(),
      companyId: req.companyId,
      filingId,
      stage: "parse",
      message: extracted.errors.join("; "),
    });
    return {
      ok: false,
      filingId,
      contentHash,
      rawStored: raw.stored,
      rawStoreReason: raw.reason,
      error: extracted.errors.join("; "),
    };
  }

  const filing: Filing = {
    id: filingId,
    companyId: req.companyId,
    source: req.source,
    exchangeFilingId: req.exchangeFilingId,
    category: req.category,
    submittedAt: req.submittedAt ?? new Date().toISOString(),
    periodStart: req.periodStart,
    periodEnd: req.periodEnd,
    sourceUrl: req.sourceUrl,
    format: req.format,
    contentHash,
    storageKey: raw.storageKey,
    parserVersion: PARSER_VERSION,
    processingStatus: extracted.facts.length ? "validated" : "parsed",
  };

  // Rejected facts are stored alongside the good ones. They are the record of
  // what the document said and why it was not published, which is what makes a
  // gap explainable instead of merely empty.
  const all: FilingFact[] = [...extracted.facts, ...extracted.rejected];
  const saved = await saveFiling(filing, all);

  // Written after the facts, so a symbol never points at a company whose
  // filings have not landed yet.
  for (const sym of req.symbols ?? []) await linkSymbol(sym, req.companyId);

  if (!saved) {
    return {
      ok: false,
      filingId,
      contentHash,
      error: "Parsed, but storage is not configured; nothing was kept.",
      facts: extracted.facts.length,
      rejected: extracted.rejected.length,
      rawStored: raw.stored,
      rawStoreReason: raw.reason,
    };
  }

  return {
    ok: true,
    filingId,
    contentHash,
    facts: extracted.facts.length,
    rejected: extracted.rejected.length,
    unmapped: extracted.unmapped,
    issues: extracted.issues,
    rawStored: raw.stored,
    rawStoreReason: raw.reason,
  };
}
