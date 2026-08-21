import { kvGet, kvSet, kvConfigured } from "@/lib/kv";
import type { TaiwanInsiderRecord, TaiwanMarket } from "@/lib/taiwan/insiderParse";

// Redis store for the Taiwan insider datasets, and the vocabulary the API uses
// to describe what it found.
//
// A stock page reads one key from here. It never contacts the exchange: the
// datasets are market-wide files, so fetching one per page view would download
// every listed company's filings to show one company's, and would put a public
// exchange in the request path of every reader.
//
// ── The statuses, and why there are five of them ────────────────────────────
//
// The whole point of this rewrite is that these are different facts and the
// reader is entitled to know which one they are looking at:
//
//   available          we have this company's filings
//   no_filings         the ingest ran, this company was in the market-wide file,
//                      and it disclosed nothing in the window
//   source_unavailable the exchange did not answer, or answered in a shape we
//                      did not recognise. We know nothing about this company.
//   unsupported        not a TWSE/TPEx listing
//   stale              we have data, but it is older than it should be — shown,
//                      dated, and flagged rather than presented as current
//
// The old adapter collapsed all of these into "no insider disclosures found",
// which states something false about a real company whenever the true answer was
// any of the others.

export type TaiwanInsiderStatus =
  | "available"
  | "no_filings"
  | "source_unavailable"
  | "unsupported"
  | "stale";

export { kvConfigured };

const KEY_PREFIX = "insider:tw:v1:";
const META_KEY = "insider:tw:v1:_meta";
const MAX_PER_COMPANY = 60;

/**
 * Companies present in the last successful ingest, per market: the set we are
 * entitled to say "no filings" about.
 *
 * Per market because the two exchanges are separate publishers and fail
 * separately. One shared flag meant TWSE's 27,528 rows counted for nothing
 * while TPEx was down: the roster was never written, so every TWSE company with
 * no filings reported "source unavailable" indefinitely.
 */
const rosterKey = (market: TaiwanMarket) => `insider:tw:v1:_roster:${market}`;

/** How old the store may be before it is called stale rather than current. */
export const STALE_AFTER_HOURS = 48;

export interface TaiwanIngestMeta {
  lastRun: string; // ISO
  /** Only set when EVERY dataset answered — a partial run must not look complete. */
  lastCompleteRun?: string;
  /** Per market, so one exchange's outage does not mute the other. */
  lastCompleteByMarket?: Partial<Record<TaiwanMarket, string>>;
  companies: number;
  records: number;
  datasets: {
    dataset: string;
    ok: boolean;
    rowsIn: number;
    httpStatus?: number;
    error?: string;
    /** Kept so a column rename is visible without re-running anything. */
    seenColumns?: string[];
  }[];
}

/** "2330.TW" / "2330.TWO" → "2330". Both markets key on the board number. */
export function taiwanCompanyId(ticker: string): string | null {
  const m = ticker.toUpperCase().trim().match(/^(\d{4,6})\.(TW|TWO)$/);
  return m ? m[1] : null;
}

/** Which exchange a ticker belongs to. .TW is the main board, .TWO is TPEx. */
export function taiwanMarketOf(ticker: string): TaiwanMarket | null {
  const m = ticker.toUpperCase().trim().match(/^\d{4,6}\.(TW|TWO)$/);
  if (!m) return null;
  return m[1] === "TWO" ? "TPEx" : "TWSE";
}

const keyFor = (companyId: string) => `${KEY_PREFIX}${companyId}`;

export async function getStoredTaiwanInsider(
  companyId: string
): Promise<TaiwanInsiderRecord[] | null> {
  if (!kvConfigured()) return null;
  const raw = await kvGet(keyFor(companyId));
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as TaiwanInsiderRecord[]) : null;
  } catch {
    return null;
  }
}

export async function setStoredTaiwanInsider(
  companyId: string,
  records: TaiwanInsiderRecord[]
): Promise<boolean> {
  return kvSet(keyFor(companyId), JSON.stringify(records.slice(0, MAX_PER_COMPANY)));
}

export async function getTaiwanIngestMeta(): Promise<TaiwanIngestMeta | null> {
  if (!kvConfigured()) return null;
  const raw = await kvGet(META_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as TaiwanIngestMeta;
  } catch {
    return null;
  }
}

export async function setTaiwanIngestMeta(meta: TaiwanIngestMeta): Promise<void> {
  await kvSet(META_KEY, JSON.stringify(meta));
}

/**
 * The set of companies the last complete ingest saw.
 *
 * This is what makes "no filings" sayable. Without it, a company absent from the
 * store is indistinguishable from a company we never had data for — and guessing
 * is how the previous version came to tell people a company had disclosed
 * nothing when the truth was that the fetch had failed.
 */
export async function setTaiwanRoster(market: TaiwanMarket, companyIds: string[]): Promise<void> {
  await kvSet(rosterKey(market), JSON.stringify(companyIds));
}

export async function getTaiwanRoster(market: TaiwanMarket): Promise<Set<string> | null> {
  if (!kvConfigured()) return null;
  const raw = await kvGet(rosterKey(market));
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr as string[]) : null;
  } catch {
    return null;
  }
}

export interface TaiwanLookup {
  status: TaiwanInsiderStatus;
  records: TaiwanInsiderRecord[];
  /** When the data was last ingested, so the UI can date what it shows. */
  asOf?: string;
  /** Hours since the last complete ingest, when known. */
  ageHours?: number;
}

/**
 * Everything the API needs about one ticker, in one call — including the reason
 * when there is nothing to show.
 */
export async function lookupTaiwanInsider(ticker: string): Promise<TaiwanLookup> {
  const companyId = taiwanCompanyId(ticker);
  if (!companyId) return { status: "unsupported", records: [] };

  // No store configured means no ingest has ever run, which is a source problem,
  // not a company that filed nothing.
  if (!kvConfigured()) return { status: "source_unavailable", records: [] };

  const market = taiwanMarketOf(ticker) ?? "TWSE";
  const [records, meta, roster] = await Promise.all([
    getStoredTaiwanInsider(companyId),
    getTaiwanIngestMeta(),
    getTaiwanRoster(market),
  ]);

  // Dated by this market's own last complete run. Using the global one would
  // date TWSE's fresh data by TPEx's failure.
  const asOf = meta?.lastCompleteByMarket?.[market] ?? meta?.lastCompleteRun ?? meta?.lastRun;
  const ageHours =
    asOf != null ? (Date.now() - new Date(asOf).getTime()) / 3_600_000 : undefined;
  const stale = ageHours != null && ageHours > STALE_AFTER_HOURS;

  if (records && records.length) {
    return { status: stale ? "stale" : "available", records, asOf, ageHours };
  }

  // Nothing stored. Only the roster licenses the claim that the company filed
  // nothing: it means the last complete ingest covered this company and found
  // no rows for it.
  if (roster?.has(companyId) && !stale) {
    return { status: "no_filings", records: [], asOf, ageHours };
  }

  return { status: "source_unavailable", records: [], asOf, ageHours };
}
