import { notConfigured, type AdapterResult, type FilingAdapter } from "@/lib/filings/adapters/types";

// The NSE's licensed corporate-data feed.
//
// NOT a scraper, and the distinction is the reason this file is mostly a
// boundary. The NSE restricts automated access to its corporate data and sells
// the feed as a product delivered over SFTP under a subscription agreement.
// Taking the same data from the public site with a script is a licence
// violation whatever the code calls itself, so there is no such path here and
// there should not be one added.
//
// What the licensed feed actually is: a batch drop, not a request-response API.
// Files land in a directory on a schedule and a subscriber collects them. That
// shape is why this adapter reads from a staging directory rather than making
// HTTP calls — the fetch is a separate concern, handled by whatever moves files
// off the SFTP host, and this side of the boundary only has to turn a batch of
// documents into filings.
//
// Until the subscription exists it reports that it is not configured. That is a
// different answer from "this company has no filings" and callers can tell them
// apart, which matters when the ingest runs across hundreds of companies and
// one silent adapter would look exactly like a market with nothing to report.

export const nseLicensedAdapter: FilingAdapter = {
  name: "NSE corporate data (licensed)",

  configured() {
    return !!(process.env.NSE_FEED_STAGING_URL && process.env.NSE_FEED_TOKEN);
  },

  async discover(): Promise<AdapterResult> {
    if (!this.configured()) {
      return notConfigured(this.name, ["NSE_FEED_STAGING_URL", "NSE_FEED_TOKEN"]);
    }
    // The staging endpoint is whatever the SFTP collector writes to: an object
    // store prefix, a queue, a small service. It is deliberately not modelled
    // here beyond "somewhere the batch has already been put", because the
    // collector is infrastructure and this is a parser boundary.
    return {
      filings: [],
      unavailableReason:
        "The NSE staging collector is configured but not implemented. It must place documents where discover() can read them, with the ISIN or symbol they belong to.",
      notes: ["Subscription required: NSE Corporate Data, delivered over SFTP."],
    };
  },
};
