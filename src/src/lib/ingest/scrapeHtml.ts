// Generic HTML extraction helper — the extension point for adding your own
// ingestion sources.
//
// ⚠️ READ BEFORE USING ON ANY SITE:
// Check the site's robots.txt and Terms of Service first. Many finance sites
// (Yahoo Finance, Google Finance, most screeners) PROHIBIT scraping, and their
// data is itself licensed from exchanges/vendors — using them to power a
// commercial product is a real legal risk. Prefer official/public sources:
// SEC EDGAR (US), regulatory filings (NSE/BSE/MCA in India), and companies'
// own investor-relations pages.
//
// To add a source: write an adapter (like edgar.ts) that calls scrapeHtml on a
// URL you're permitted to use, then maps the parsed nodes into a typed shape.

import * as cheerio from "cheerio";
import { politeFetch } from "@/lib/ingest/politeFetch";

export async function scrapeHtml(url: string, userAgent?: string) {
  const res = await politeFetch(url, { userAgent, accept: "text/html" });
  if (!res.ok) throw new Error(`scrape responded ${res.status}`);
  const html = await res.text();
  return cheerio.load(html); // returns a jQuery-like selector API
}
