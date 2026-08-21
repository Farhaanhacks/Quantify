import { kvConfigured, kvGet, kvSet, kvSAdd, kvSMembers } from "@/lib/kv";
import type { Filing, FilingFact } from "@/lib/filings/types";

// Where filings and their facts are kept.
//
// The storage this deployment actually has is Upstash Redis over REST, so that
// is what this uses. The shape below is deliberately the shape a relational
// database would want — a filings table keyed by content hash, a facts table
// keyed by filing — so moving to Postgres later is a change of driver rather
// than a change of design. What must not move is the rule the keys encode: one
// document is one row, identified by the hash of its bytes.
//
// Raw documents are the exception. A filing runs to megabytes and a Redis value
// should not, so the original is written to object storage (R2, S3, Supabase)
// and only its key is kept here. Until that bucket is configured, storeRaw says
// so rather than silently keeping nothing: a pipeline that believes it has an
// immutable copy of a document it never wrote is worse than one that knows it
// has not.

const KEY = {
  filing: (id: string) => `filings:doc:${id}`,
  hashes: (companyId: string) => `filings:hash:${companyId}`,
  index: (companyId: string) => `filings:index:${companyId}`,
  facts: (filingId: string) => `filings:facts:${filingId}`,
  errors: () => `filings:errors`,
  symbol: (symbol: string) => `filings:symbol:${symbol.toUpperCase()}`,
};

/** Redis values are not a document store; this is the line. */
const MAX_KV_VALUE = 400 * 1024;

export interface RawStoreResult {
  stored: boolean;
  storageKey?: string;
  reason?: string;
}

/**
 * Keep the original document, untouched.
 *
 * Immutability is the point rather than a nicety. Every fact this pipeline
 * publishes claims to come from a specific page of a specific document, and that
 * claim is only checkable while the document still exists in the form it was
 * parsed from. Re-fetching it later is not the same thing: exchanges replace
 * files in place when a company re-files.
 */
export async function storeRawDocument(
  contentHash: string,
  bytes: string
): Promise<RawStoreResult> {
  const bucketUrl = process.env.FILINGS_BUCKET_URL;
  const bucketToken = process.env.FILINGS_BUCKET_TOKEN;
  if (bucketUrl && bucketToken) {
    try {
      const key = `filings/${contentHash}`;
      const res = await fetch(`${bucketUrl.replace(/\/$/, "")}/${key}`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${bucketToken}`, "Content-Type": "application/octet-stream" },
        body: bytes,
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) return { stored: false, reason: `Object store responded ${res.status}.` };
      return { stored: true, storageKey: key };
    } catch (e) {
      return { stored: false, reason: `Object store unreachable: ${(e as Error).message}` };
    }
  }
  if (bytes.length <= MAX_KV_VALUE && kvConfigured()) {
    const ok = await kvSet(KEY.filing(`raw:${contentHash}`), bytes);
    return ok
      ? { stored: true, storageKey: `kv:raw:${contentHash}` }
      : { stored: false, reason: "KV write failed." };
  }
  return {
    stored: false,
    reason: bytes.length > MAX_KV_VALUE
      ? "No object storage configured and the document is too large for KV. Set FILINGS_BUCKET_URL and FILINGS_BUCKET_TOKEN."
      : "No storage configured.",
  };
}

/** True when this exact document has already been ingested for this company. */
export async function alreadyIngested(companyId: string, contentHash: string): Promise<boolean> {
  if (!kvConfigured()) return false;
  const seen = await kvSMembers(KEY.hashes(companyId));
  return seen.includes(contentHash);
}

export async function saveFiling(filing: Filing, facts: FilingFact[]): Promise<boolean> {
  if (!kvConfigured()) return false;
  const wrote = await kvSet(KEY.filing(filing.id), JSON.stringify(filing));
  // Facts are written before the hash is recorded, so a crash between the two
  // leaves a filing that will be re-ingested rather than one whose facts are
  // missing and which will never be retried.
  await kvSet(KEY.facts(filing.id), JSON.stringify(facts));
  await kvSAdd(KEY.index(filing.companyId), filing.id);
  await kvSAdd(KEY.hashes(filing.companyId), filing.contentHash);
  return wrote;
}

export async function getFiling(filingId: string): Promise<Filing | null> {
  const raw = await kvGet(KEY.filing(filingId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as Filing;
  } catch {
    return null;
  }
}

/** Every fact held for a company, newest filing first. */
export async function getCompanyFacts(companyId: string): Promise<FilingFact[]> {
  if (!kvConfigured()) return [];
  const ids = await kvSMembers(KEY.index(companyId));
  if (!ids.length) return [];
  const out: FilingFact[] = [];
  for (const id of ids) {
    const raw = await kvGet(KEY.facts(id));
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw) as FilingFact[];
      if (Array.isArray(parsed)) out.push(...parsed);
    } catch {
      /* one unreadable filing must not take the rest with it */
    }
  }
  return out.sort((a, b) => (b.periodEnd ?? "").localeCompare(a.periodEnd ?? ""));
}

/**
 * Point a trading symbol at the company its filings are stored under.
 *
 * This exists because the two halves of the system identify a company
 * differently, and correctly. Filings are keyed on ISIN or CIN, because that is
 * what survives a rename and what both exchanges agree on. Pages are reached by
 * symbol, because that is what a reader types. Without something joining them,
 * a filing ingested as isin:INE040A01034 is invisible to the page for
 * HDFCBANK.NS, and invisible in the worst way: no error, no empty result to
 * investigate, just a card that goes on saying the data is not available while
 * the data sits in the database.
 *
 * The link is written at ingest, when both identifiers are in hand.
 */
export async function linkSymbol(symbol: string, companyId: string): Promise<void> {
  if (!kvConfigured() || !symbol || !companyId) return;
  await kvSet(KEY.symbol(symbol), companyId);
}

/**
 * The company id a symbol's filings live under.
 *
 * The alias first, then the provisional key a symbol-only ingest would have
 * minted for itself. The fallback is what makes an ingest that carried no
 * identifier still reachable; the alias is what makes a properly identified one
 * reachable too.
 */
export async function companyIdForSymbol(symbol: string): Promise<string> {
  const s = (symbol ?? "").toUpperCase().trim();
  if (!s) return "";
  if (kvConfigured()) {
    const linked = await kvGet(KEY.symbol(s));
    if (linked) return linked;
    // The bare root, so HDFCBANK.NS finds a link written for HDFCBANK.
    const root = s.replace(/\.[A-Z]{1,3}$/, "");
    if (root !== s) {
      const byRoot = await kvGet(KEY.symbol(root));
      if (byRoot) return byRoot;
    }
  }
  return provisionalIdForSymbol(s);
}

/** The key a symbol-only ingest mints, matching companyMaster's own rule. */
export function provisionalIdForSymbol(symbol: string): string {
  const s = (symbol ?? "").toUpperCase().trim();
  if (/\.BO$/.test(s)) return `provisional:bse:${s.replace(/\.BO$/, "")}`;
  return `provisional:nse:${s.replace(/\.NS$/, "")}`;
}

export interface ProcessingError {
  at: string;
  companyId?: string;
  filingId?: string;
  stage: "fetch" | "store" | "parse" | "validate";
  message: string;
}

/**
 * The error log the processing dashboard reads.
 *
 * Kept because the interesting failures in an ingestion pipeline are the quiet
 * ones: a taxonomy that changed its tag names, a company that started filing in
 * a different format, a document that parses to zero facts. None of those raise
 * an exception anywhere, and without a record they present as a company whose
 * data simply stopped updating.
 */
export async function recordError(err: ProcessingError): Promise<void> {
  if (!kvConfigured()) return;
  try {
    await kvSAdd(KEY.errors(), JSON.stringify(err));
  } catch {
    /* the error log failing must never fail the ingest */
  }
}

export async function recentErrors(): Promise<ProcessingError[]> {
  if (!kvConfigured()) return [];
  const raw = await kvSMembers(KEY.errors());
  const out: ProcessingError[] = [];
  for (const r of raw) {
    try {
      out.push(JSON.parse(r) as ProcessingError);
    } catch {
      /* skip */
    }
  }
  return out.sort((a, b) => (b.at ?? "").localeCompare(a.at ?? "")).slice(0, 200);
}

/** SHA-256 of a document's bytes, as hex. */
export async function contentHashOf(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
