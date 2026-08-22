import { bseFetchJson, bseFetchText, resolveScripCode, ymd, usingProxy } from "@/lib/insiderIndia";
import type { AdapterResult, DiscoveredFiling } from "@/lib/filings/adapters/types";

// Financial results from the BSE's announcements feed.
//
// This is the piece that was missing, and the reason the balance-sheet card
// stayed empty while everything around it worked. The app already talks to
// api.bseindia.com — the insider-trading page has done it for months, through
// the same ScraperAPI proxy, with the same session headers, against the same
// AnnGetData endpoint. What nothing did was ask that endpoint for the RESULTS
// category and hand the attachment to the XBRL parser. The transport existed,
// the parser existed, and the wire between them did not.
//
// So this file is short on purpose. It is a query and a filter over machinery
// that is already proven, rather than a new integration.
//
// One caveat worth stating plainly rather than burying: this reads the public
// announcements API, the same one the insider page reads. The BSE also sells a
// licensed corporate-data feed, and bseLicensed.ts is the adapter for it. If
// the volume here ever goes beyond occasional per-company reads, the licensed
// feed is the correct route and this one should retire.

/** Category names the BSE files quarterly and annual results under. */
const RESULT_CATEGORIES = /result|financial\s*result/i;

/** Headlines that are results but are filed under a general category. */
const RESULT_HEADLINES =
  /(?:audited|unaudited|quarterly|half\s*yearly|annual)\s+(?:financial\s+)?results|financial\s+results\s+for/i;

const isRec = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);

const pick = (row: Record<string, unknown>, ...keys: string[]): string => {
  for (const k of keys) {
    const v = row[k];
    if (typeof v === "string" && v.trim()) return v.trim();
    if (typeof v === "number") return String(v);
  }
  return "";
};

/**
 * Which of a row's attachments is the XBRL.
 *
 * The BSE files a results announcement with a PDF and, separately, an XBRL
 * document. Only the second is worth fetching: a PDF would be stored and not
 * parsed, and pulling hundreds of them before there is a reader is bandwidth
 * spent on documents nothing can use.
 */
function xbrlAttachment(row: Record<string, unknown>): string | undefined {
  const candidates = [
    pick(row, "XBRLATTACHMENTNAME", "XmlAttachmentName", "XBRL_ATTACHMENT"),
    pick(row, "ATTACHMENTNAME", "Attachment", "ATTACHMENT"),
  ].filter(Boolean);
  return candidates.find((a) => /\.(xml|xbrl)$/i.test(a));
}

function isResultsRow(category: string, headline: string): boolean {
  if (RESULT_CATEGORIES.test(category)) return true;
  return RESULT_HEADLINES.test(headline);
}

export interface BseResultsQuery {
  /** A ticker or a six-digit scrip code. */
  symbol: string;
  /** How far back to look. Results are quarterly, so a year covers four. */
  days?: number;
  /** Stop after this many documents. */
  limit?: number;
}

/**
 * Results filings for one company.
 *
 * Returns a reason rather than an empty list when it could not run, because
 * "blocked" and "this company filed nothing" are different answers and the
 * import that runs across the whole market has to be able to tell them apart.
 * That distinction is what makes a failure visible instead of looking like a
 * market with nothing to report.
 */
export async function discoverBseResults(query: BseResultsQuery): Promise<AdapterResult> {
  const notes: string[] = [];
  const scrip = await resolveScripCode(query.symbol);
  if (!scrip) {
    return { filings: [], unavailableReason: `No BSE scrip code for ${query.symbol}.` };
  }

  const days = query.days ?? 400;
  const to = new Date();
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  // strCat=-1 asks for every category and the filter happens here, which is what
  // the insider path does: the BSE's category codes have changed before, and a
  // hardcoded one that stops matching returns an empty list rather than an error.
  const url =
    `https://api.bseindia.com/BseIndiaAPI/api/AnnGetData/w?pageno=1&strCat=-1` +
    `&strPrevDate=${ymd(from)}&strScrip=${scrip}&strSearch=P&strToDate=${ymd(to)}&strType=C`;

  const res = await bseFetchJson(url);
  if (res.status == null || res.status >= 400) {
    return {
      filings: [],
      unavailableReason:
        res.status == null
          ? `BSE announcements timed out${usingProxy() ? " through the proxy" : ""}.`
          : `BSE announcements responded ${res.status}. ${res.bodySnippet ?? ""}`.trim(),
    };
  }

  const rows: unknown[] = isRec(res.json) && Array.isArray(res.json.Table)
    ? (res.json.Table as unknown[])
    : Array.isArray(res.json)
      ? (res.json as unknown[])
      : [];
  if (!rows.length) {
    return { filings: [], unavailableReason: "BSE returned no announcements for this company." };
  }

  const filings: DiscoveredFiling[] = [];
  const seenCategories = new Set<string>();
  for (const raw of rows) {
    if (!isRec(raw)) continue;
    const category = pick(raw, "CATEGORYNAME", "Category", "NEWSCATEGORYNAME", "News_Category");
    const headline = pick(raw, "NEWSSUB", "HEADLINE", "NEWS_SUB", "Headline", "NEWSSUBJECT");
    if (category) seenCategories.add(category);
    if (!isResultsRow(category, headline)) continue;

    const attachment = xbrlAttachment(raw);
    if (!attachment) {
      notes.push(`${headline || category}: results announcement with no XBRL attachment.`);
      continue;
    }
    const docUrl = `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${attachment}`;
    // Through the proxy, like everything else: the block that stops the API
    // stops the file server too.
    const doc = await bseFetchText(docUrl);
    if (!doc.text) {
      notes.push(`${attachment}: ${doc.status == null ? "timed out" : `responded ${doc.status}`}.`);
      continue;
    }
    const content = doc.text;

    const filedAt = pick(raw, "NEWS_DT", "News_submission_dt", "DT_TM", "News_Dt", "NEWSDATE");
    filings.push({
      identity: {
        bseScripCode: scrip,
        legalName: pick(raw, "SLONGNAME", "Sname", "SNAME") || undefined,
      },
      source: "bse",
      exchangeFilingId: pick(raw, "NEWSID", "NEWS_ID") || undefined,
      category: category || "Financial Results",
      filedAt: filedAt || undefined,
      format: "xbrl",
      sourceUrl: docUrl,
      content,
    });
    if (filings.length >= (query.limit ?? 4)) break;
  }

  if (!filings.length) {
    notes.push(`Categories seen: ${Array.from(seenCategories).slice(0, 12).join(", ") || "none"}`);
    return {
      filings: [],
      unavailableReason: "No results announcement with an XBRL attachment in this window.",
      notes,
    };
  }
  return { filings, notes };
}
