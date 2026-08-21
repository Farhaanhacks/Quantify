import type { DocumentFormat, FilingSource, ReportingScope } from "@/lib/filings/types";

// The boundary every filing source has to come through.
//
// One interface, three implementations, and the reason to write it before any
// of them work is that the differences between the sources are entirely at the
// edge. A licensed NSE drop arrives over SFTP as a batch; the BSE's API answers
// one request at a time against a contract; a person uploads a file. Once a
// document is in hand with its identity and its provenance, nothing downstream
// can tell which of the three it was, and nothing downstream should be able to.
//
// What must NOT be here is a fourth implementation that fetches public pages
// and takes what it finds. Both exchanges restrict automated access to their
// corporate data, and a scraper is a licence violation whatever it is called in
// the code. The two licensed paths and the manual one are the whole set.

export interface DiscoveredFiling {
  /** How the issuer is identified by the source, in its own terms. */
  identity: {
    isin?: string;
    cin?: string;
    nseSymbol?: string;
    bseScripCode?: string;
    legalName?: string;
  };
  source: FilingSource;
  /** The exchange's own id for the submission, where it has one. */
  exchangeFilingId?: string;
  /** The exchange's category, e.g. "Financial Results". */
  category?: string;
  /** When the company filed it. */
  filedAt?: string;
  periodStart?: string;
  periodEnd?: string;
  scope?: ReportingScope;
  format: DocumentFormat;
  sourceUrl?: string;
  /**
   * The document itself, exactly as the source gave it.
   *
   * Bytes rather than a URL, and the whole point is that it is the same bytes
   * the facts were read from. Fetching it again later is not equivalent: both
   * exchanges replace files in place when a company re-files, so a document
   * re-fetched to check a figure may not be the document that produced it.
   */
  content: string;
}

export interface AdapterResult {
  filings: DiscoveredFiling[];
  /** Set when the adapter could not run at all. */
  unavailableReason?: string;
  /** What was tried, for the processing dashboard. */
  notes?: string[];
}

export interface FilingAdapter {
  readonly name: string;
  /** False when the credentials this adapter needs are not configured. */
  configured(): boolean;
  /**
   * Documents filed for a company since a date.
   *
   * Returns an empty list and a reason rather than throwing when it cannot run,
   * because "no credentials" and "no filings" are different answers and a caller
   * ingesting a hundred companies needs to tell them apart.
   */
  discover(query: {
    isin?: string;
    nseSymbol?: string;
    bseScripCode?: string;
    since?: string;
  }): Promise<AdapterResult>;
}

/** What an adapter says when it has not been given what it needs. */
export function notConfigured(name: string, needs: string[]): AdapterResult {
  return {
    filings: [],
    unavailableReason: `${name} is not configured. Set ${needs.join(" and ")}.`,
  };
}
