import { notConfigured, type AdapterResult, type FilingAdapter } from "@/lib/filings/adapters/types";

// The BSE's authenticated corporate-data API.
//
// Also not a scraper. The BSE publishes announcements on its public site and
// sells the same content as an authenticated data feed; this adapter uses the
// second. The public site is out of bounds for automated collection regardless
// of how easy it would be, and the difference is a contract rather than a
// technique.
//
// Unlike the NSE's batch drop this one is request-response, so the shape below
// is a real call. It is nonetheless unverified: no key was available to test it
// against, so the request is written to the documented contract and every
// failure is reported with the status and body rather than swallowed. An
// adapter that returns an empty list on a 401 is indistinguishable from a
// company that filed nothing, which is the failure mode most likely to waste a
// day.

interface BseAnnouncement {
  scripcode?: string | number;
  isin?: string;
  company_name?: string;
  news_id?: string;
  category?: string;
  news_dt?: string;
  period_end?: string;
  attachment_url?: string;
  file_type?: string;
}

export const bseLicensedAdapter: FilingAdapter = {
  name: "BSE corporate data (authenticated)",

  configured() {
    return !!(process.env.BSE_API_URL && process.env.BSE_API_KEY);
  },

  async discover(query): Promise<AdapterResult> {
    if (!this.configured()) {
      return notConfigured(this.name, ["BSE_API_URL", "BSE_API_KEY"]);
    }
    const base = (process.env.BSE_API_URL ?? "").replace(/\/$/, "");
    const params = new URLSearchParams({ category: "Result" });
    if (query.bseScripCode) params.set("scripcode", query.bseScripCode);
    if (query.isin) params.set("isin", query.isin);
    if (query.since) params.set("from", query.since);

    let listing: BseAnnouncement[];
    try {
      const res = await fetch(`${base}/announcements?${params}`, {
        headers: { Authorization: `Bearer ${process.env.BSE_API_KEY}`, Accept: "application/json" },
        signal: AbortSignal.timeout(20000),
      });
      if (!res.ok) {
        // The status is the whole message. A 401 means the key is wrong and a
        // 404 means the path is, and both used to look like "no filings".
        return {
          filings: [],
          unavailableReason: `BSE responded ${res.status} to the announcements request.`,
        };
      }
      const json = (await res.json()) as { Table?: BseAnnouncement[] } | BseAnnouncement[];
      listing = Array.isArray(json) ? json : (json.Table ?? []);
    } catch (e) {
      return { filings: [], unavailableReason: `BSE unreachable: ${(e as Error).message}` };
    }

    const notes: string[] = [];
    const filings = [];
    for (const row of listing) {
      const url = row.attachment_url;
      // Only XBRL. A PDF result would be stored and not parsed, and pulling
      // hundreds of them before there is a reader is bandwidth spent on
      // documents nothing can use.
      if (!url || !/\.(xml|xbrl)$/i.test(url)) {
        if (url) notes.push(`Skipped ${row.news_id ?? url}: not XBRL.`);
        continue;
      }
      try {
        const doc = await fetch(url, {
          headers: { Authorization: `Bearer ${process.env.BSE_API_KEY}` },
          signal: AbortSignal.timeout(30000),
        });
        if (!doc.ok) {
          notes.push(`Document ${row.news_id ?? url} responded ${doc.status}.`);
          continue;
        }
        filings.push({
          identity: {
            isin: row.isin,
            bseScripCode: row.scripcode != null ? String(row.scripcode) : undefined,
            legalName: row.company_name,
          },
          source: "bse" as const,
          exchangeFilingId: row.news_id,
          category: row.category,
          filedAt: row.news_dt,
          periodEnd: row.period_end,
          format: "xbrl" as const,
          sourceUrl: url,
          content: await doc.text(),
        });
      } catch (e) {
        notes.push(`Document ${row.news_id ?? url} failed: ${(e as Error).message}`);
      }
    }
    return { filings, notes };
  },
};
