// The shapes a filing takes on its way from an exchange to a number on screen.
//
// No imports, so scripts/test-filings.mjs can compile and drive this.
//
// Everything here exists to answer one question about every figure the site
// shows: where did it come from. The balance-sheet work made that question
// unavoidable — a bank scored "Insufficient data" because gross NPAs are in the
// company's filings and not in a quote feed — and the answer cannot be bolted
// on afterwards. A number that arrives without its reporting date, its scope
// and its source document cannot be checked, cannot be compared against another
// number, and cannot be cited. So provenance travels with the value from the
// moment it is read out of the document.

/** Where a filing came from. Two exchanges publish the same filing. */
export type FilingSource = "nse" | "bse" | "manual" | "investor-relations";

/** Standalone and consolidated accounts are different books, not variants. */
export type ReportingScope = "standalone" | "consolidated";

/** The document formats, in the order they should be preferred. */
export type DocumentFormat = "xbrl" | "xhtml" | "html" | "pdf-text" | "pdf-scanned";

/**
 * How a fact was obtained, and therefore how much it can be trusted.
 *
 * The ladder is the point. An XBRL fact is a tagged number the filer asserted;
 * an OCR fact is a guess about pixels. They must never be indistinguishable
 * once they are in the database, because the only way to decide whether a
 * figure is publishable is to know how it was read.
 *
 * "llm" is last and is deliberately barred from authoritative financials: a
 * model asked to read a balance sheet will produce a plausible number whether
 * or not one is there, which is the single worst failure mode available here.
 */
export type ExtractionMethod = "xbrl" | "html-table" | "pdf-text" | "ocr" | "llm";

export const EXTRACTION_RANK: Record<ExtractionMethod, number> = {
  xbrl: 0,
  "html-table": 1,
  "pdf-text": 2,
  ocr: 3,
  llm: 4,
};

/**
 * One issuer, identified by things that do not change.
 *
 * The primary identity is ISIN or CIN, never the ticker. A ticker is a string
 * an exchange assigns to a listing, so it is not unique across exchanges, it is
 * reassigned when companies delist, and keying on it is what let a New York
 * depositary receipt be mistaken for an Indian bank's shares. ISIN identifies
 * the security and CIN identifies the incorporated company; between them they
 * survive renames, re-listings and secondary lines.
 */
export interface CompanyIdentity {
  /** Stable internal id. Derived from ISIN or CIN, never from a ticker. */
  id: string;
  legalName: string;
  /** Corporate Identity Number, from the Registrar of Companies. */
  cin?: string;
  isin?: string;
  nseSymbol?: string;
  bseScripCode?: string;
  /** Which checklist this company's balance sheet is read under. */
  industryType?: IndustryType;
  homeCountry: string;
  /** Other names the same issuer files under, for matching. */
  aliases?: string[];
}

/**
 * The classification that decides which facts matter.
 *
 * The same five buckets the balance-sheet checklists use, and for the same
 * reason: deposits and capital adequacy are the substance of a bank's accounts
 * and do not exist in a manufacturer's, so an ingestion pipeline that treats
 * every filer alike will collect the wrong facts from four fifths of them.
 */
export type IndustryType =
  | "ordinary"
  | "bank"
  | "nbfc"
  | "life-insurer"
  | "general-insurer";

/** One document, stored exactly as it arrived. */
export interface Filing {
  id: string;
  companyId: string;
  source: FilingSource;
  /** The exchange's own id for this submission, where it has one. */
  exchangeFilingId?: string;
  /** The exchange's category, e.g. "Financial Results". */
  category?: string;
  submittedAt?: string;
  /** The reporting period this document covers. */
  periodStart?: string;
  periodEnd?: string;
  sourceUrl?: string;
  format: DocumentFormat;
  /**
   * SHA-256 of the raw bytes.
   *
   * This is what stops NSE's and BSE's copies of the same document being
   * ingested as two filings and every fact in them being counted twice. It is
   * computed over the bytes, not the text, so a re-encoded copy is caught too.
   */
  contentHash: string;
  /** Where the untouched original lives. */
  storageKey?: string;
  parserVersion: string;
  processingStatus: "stored" | "parsed" | "validated" | "failed";
  /** Why it failed, when it failed. Never an empty status with no reason. */
  error?: string;
}

/**
 * One number, with everything needed to know what it is.
 *
 * `value` is optional and its absence is meaningful: a fact that failed
 * validation is kept, with its reason, rather than deleted or coerced to zero.
 * That is the whole lesson of the 0/10 bug — a missing figure and a zero figure
 * are different claims, and only one of them is about the company.
 */
export interface FilingFact {
  filingId: string;
  companyId: string;
  /** The stable Quantifi name, not the filer's tag. */
  concept: string;
  /** The tag as it appeared in the document, kept so the mapping is auditable. */
  sourceConcept?: string;
  numericValue?: number;
  textValue?: string;
  unit?: string;
  currency?: string;
  periodStart?: string;
  periodEnd?: string;
  scope?: ReportingScope;
  /** Where in the document, so a reader can be sent to it. */
  sourcePage?: number;
  sourceXPath?: string;
  method: ExtractionMethod;
  /** 0 to 1. Only ever below 1 for OCR and narrative extraction. */
  confidence: number;
  /** Set when the fact did not survive validation. Publishing is then barred. */
  rejectedReason?: string;
}

/** A fact that passed every check and may be shown. */
export interface ValidatedFact extends FilingFact {
  numericValue: number;
  rejectedReason?: undefined;
}

export const PARSER_VERSION = "filings-1";
