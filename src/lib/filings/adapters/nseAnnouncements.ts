import { nseFetch, nseSession } from "@/lib/insiderIndiaNSE";
import type { AdapterResult, DiscoveredFiling } from "@/lib/filings/adapters/types";

// Financial results from the NSE's corporate-filings API.
//
// The counterpart to bseAnnouncements.ts, and it exists because one exchange is
// not a source: a company files with both, the two feeds go down at different
// times, and a filing that is missing from one is usually present in the other.
// A pipeline with a single exchange behind it reports "no filings" for outages.
//
// The NSE's difficulty is entirely in the handshake. A plain GET against its API
// returns 200 with an empty array — not an error, not a block, an empty list
// that looks exactly like a company that has filed nothing. The fix is a
// rendered warm-up on the homepage inside a pinned proxy session whose cookies
// then authorise the call, which is why this imports nseSession rather than
// opening its own.
//
// Same caveat as the BSE path: this reads the public API, the same one the
// insider page reads. The NSE sells a licensed corporate-data feed and
// nseLicensed.ts is the adapter for it; at market-wide polling volumes that is
// the correct route.

const isRec = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const str = (row: Record<string, unknown>, ...keys: string[]): string => {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
};

const ddmmyyyy = (d: Date): string =>
  `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;

export interface NseResultsQuery {
  /** The NSE symbol, with or without a .NS suffix. */
  symbol: string;
  days?: number;
  limit?: number;
}

/**
 * Results filings for one company, from the NSE.
 *
 * The XBRL link is what this is after. The NSE publishes each result with a PDF
 * and, separately, an XBRL document, and only the second can be read
 * deterministically; a PDF would be stored and not parsed.
 */
export async function discoverNseResults(query: NseResultsQuery): Promise<AdapterResult> {
  const symbol = query.symbol.toUpperCase().replace(/\.(NS|BO)$/i, "").trim();
  if (!symbol) return { filings: [], unavailableReason: "No symbol." };

  const session = await nseSession();
  const to = new Date();
  const from = new Date(Date.now() - (query.days ?? 400) * 24 * 60 * 60 * 1000);

  // Two shapes of the same endpoint. The NSE has moved this more than once and
  // an unrecognised path returns an empty list rather than a 404, so both are
  // tried and the first that answers wins.
  const urls = [
    `https://www.nseindia.com/api/corporates-financial-results?index=equities&symbol=${encodeURIComponent(symbol)}&period=Quarterly`,
    `https://www.nseindia.com/api/corporates-corporateActions?index=equities&symbol=${encodeURIComponent(symbol)}` +
      `&from_date=${ddmmyyyy(from)}&to_date=${ddmmyyyy(to)}`,
  ];

  let rows: unknown[] = [];
  let lastStatus: number | null = null;
  let lastSnippet: string | undefined;
  for (const url of urls) {
    const res = await nseFetch(url, session);
    lastStatus = res.status;
    lastSnippet = res.snippet;
    const data = Array.isArray(res.json)
      ? (res.json as unknown[])
      : isRec(res.json) && Array.isArray(res.json.data)
        ? (res.json.data as unknown[])
        : [];
    if (data.length) {
      rows = data;
      break;
    }
  }

  if (!rows.length) {
    return {
      filings: [],
      unavailableReason:
        lastStatus == null
          ? "NSE timed out."
          : lastStatus >= 400
            ? `NSE responded ${lastStatus}. ${lastSnippet ?? ""}`.trim()
            : // The one that looks like success and is not.
              "NSE returned an empty list. If this persists for a company that has clearly filed, the session cookies are not being established.",
    };
  }

  const notes: string[] = [];
  const filings: DiscoveredFiling[] = [];
  for (const raw of rows) {
    if (!isRec(raw)) continue;
    const xbrl = str(raw, "xbrl", "xbrlAttachment", "xbrlFile");
    if (!xbrl || !/\.(xml|xbrl)$/i.test(xbrl)) {
      const label = str(raw, "toDate", "period", "seqNumber") || "row";
      notes.push(`${label}: no XBRL attachment.`);
      continue;
    }
    // The document itself is served from the NSE's static host, which does not
    // need the session cookies the API does.
    let content: string;
    try {
      const r = await fetch(xbrl, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) {
        notes.push(`${xbrl}: responded ${r.status}.`);
        continue;
      }
      content = await r.text();
    } catch (e) {
      notes.push(`${xbrl}: ${(e as Error).message}`);
      continue;
    }

    filings.push({
      identity: {
        nseSymbol: symbol,
        legalName: str(raw, "companyName", "company", "sm_name") || undefined,
      },
      source: "nse",
      exchangeFilingId: str(raw, "seqNumber", "seq_id") || undefined,
      category: "Financial Results",
      filedAt: str(raw, "creationDate", "broadcastDate", "exchdisstime") || undefined,
      periodEnd: str(raw, "toDate", "to_date") || undefined,
      format: "xbrl",
      sourceUrl: xbrl,
      content,
    });
    if (filings.length >= (query.limit ?? 4)) break;
  }

  if (!filings.length) {
    return {
      filings: [],
      unavailableReason: "Results found, but none carried an XBRL attachment.",
      notes,
    };
  }
  return { filings, notes };
}
