import {
  parseTaiwanDataset,
  type ParseResult,
  type TaiwanEventType,
  type TaiwanInsiderRecord,
  type TaiwanMarket,
} from "@/lib/taiwan/insiderParse";

// The official open-data feeds, fetched market-wide.
//
// These replace a third-party mirror (FinMind's TaiwanStockInsiderTrading). The
// mirror was the wrong source on two counts: technically it returned nothing for
// the symbols we asked about, and every one of those empty answers reached the
// page as "no insider disclosures found" — an assertion about a company that we
// had no basis for. And a third-party redistribution of exchange data carries
// none of the licence clarity the exchanges' own feeds do.
//
// Both exchanges publish under the Taiwan Government Open Data Licence 1.0,
// which permits commercial use with attribution. The attribution is rendered
// wherever this data appears; see InsiderActivity.
//
// Each dataset is one file covering the WHOLE market — which is why ingestion is
// a scheduled job over six files rather than a per-company request. A stock page
// then reads a Redis key, not the exchange.

export interface DatasetSpec {
  id: string; // t187ap11_L …
  market: TaiwanMarket;
  eventType: TaiwanEventType;
  /** Candidate URLs, tried in order. */
  urls: string[];
  /** The human-facing page for this dataset, stored on every record. */
  sourceUrl: string;
}

const TWSE_OPENAPI = "https://openapi.twse.com.tw/v1/opendata";
// The Taipei Exchange has moved its open-data host once already, and both forms
// are still served. Trying them in order costs one failed request in the worst
// case, on a job that runs a few times a day.
const TPEX_HOSTS = [
  "https://www.tpex.org.tw/openapi/v1",
  "https://wwwo.tpex.org.tw/openapi/v1",
  // The site was rebuilt and the old host still answers, so both shapes are
  // tried. A 200 that is not JSON now records what it actually was, which is
  // what will settle which of these is right.
  "https://www.tpex.org.tw/web/openapi/v1",
  "https://www.tpex.org.tw/openapi/v1/tpex",
];

export const DATASETS: DatasetSpec[] = [
  {
    id: "t187ap11_L",
    market: "TWSE",
    eventType: "holding_snapshot",
    urls: [`${TWSE_OPENAPI}/t187ap11_L`],
    sourceUrl: "https://openapi.twse.com.tw/#/",
  },
  {
    id: "t187ap12_L",
    market: "TWSE",
    eventType: "planned_transfer",
    urls: [`${TWSE_OPENAPI}/t187ap12_L`],
    sourceUrl: "https://openapi.twse.com.tw/#/",
  },
  {
    id: "t187ap13_L",
    market: "TWSE",
    eventType: "untransferred",
    urls: [`${TWSE_OPENAPI}/t187ap13_L`],
    sourceUrl: "https://openapi.twse.com.tw/#/",
  },
  {
    id: "t187ap11_O",
    market: "TPEx",
    eventType: "holding_snapshot",
    urls: TPEX_HOSTS.map((h) => `${h}/t187ap11_O`),
    sourceUrl: "https://www.tpex.org.tw/openapi/",
  },
  {
    id: "t187ap12_O",
    market: "TPEx",
    eventType: "planned_transfer",
    urls: TPEX_HOSTS.map((h) => `${h}/t187ap12_O`),
    sourceUrl: "https://www.tpex.org.tw/openapi/",
  },
  {
    id: "t187ap13_O",
    market: "TPEx",
    eventType: "untransferred",
    urls: TPEX_HOSTS.map((h) => `${h}/t187ap13_O`),
    sourceUrl: "https://www.tpex.org.tw/openapi/",
  },
];

export interface DatasetOutcome {
  dataset: string;
  market: TaiwanMarket;
  eventType: TaiwanEventType;
  /** Which candidate URL answered. */
  url?: string;
  httpStatus?: number;
  rowsIn: number;
  records: TaiwanInsiderRecord[];
  /** Present when the payload arrived but did not look like the dataset. */
  missingColumns?: string[];
  /** The payload's own column names, so a rename is one log line away. */
  seenColumns?: string[];
  error?: string;
  ok: boolean;
}

const UA =
  "Quantifi/1.0 (open-data client; https://github.com/) Mozilla/5.0 (compatible)";

/** Fetch and parse one dataset. Never throws — the outcome carries the reason. */
export async function fetchDataset(spec: DatasetSpec): Promise<DatasetOutcome> {
  const out: DatasetOutcome = {
    dataset: spec.id,
    market: spec.market,
    eventType: spec.eventType,
    rowsIn: 0,
    records: [],
    ok: false,
  };

  for (const url of spec.urls) {
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": UA },
        // The exchange publishes these once a day; an hour of caching is
        // conservative and keeps a retried job cheap.
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(20000),
      });
      out.url = url;
      out.httpStatus = res.status;
      if (!res.ok) continue;

      // Read as TEXT first, then parse. res.json() on an HTML error page throws
      // a parse error with no clue what arrived, which is how three datasets
      // came to report "fetch failed" against an HTTP 200. The body's first
      // line names the problem: a redirect page, a WAF challenge, a rename.
      const body = await res.text();
      let json: unknown;
      try {
        json = JSON.parse(body);
      } catch {
        out.error = `200 but not JSON: ${body.slice(0, 160).replace(/\s+/g, " ")}`;
        continue;
      }
      const rows = Array.isArray(json) ? (json as Record<string, unknown>[]) : null;
      if (!rows) {
        out.error = `payload was not an array: ${body.slice(0, 120).replace(/\s+/g, " ")}`;
        continue;
      }

      const parsed: ParseResult = parseTaiwanDataset({
        rows,
        market: spec.market,
        eventType: spec.eventType,
        sourceUrl: spec.sourceUrl,
      });
      out.rowsIn = parsed.rowsIn;
      out.seenColumns = parsed.seenColumns;

      // A market-wide file with no rows is not "nobody in Taiwan filed
      // anything" — every listed company has directors, and this file always
      // carries them. Treating it as a successful empty result would let one
      // bad publish wipe the store and turn the whole market silent.
      if (parsed.rowsIn === 0) {
        out.error = "empty payload";
        continue;
      }

      if (parsed.missingColumns.length) {
        // The file is there and readable, but it is not the shape we know. That
        // is a source problem, not an empty market — reporting it as "no
        // disclosures" is exactly the failure this rewrite exists to remove.
        out.missingColumns = parsed.missingColumns;
        out.error = `columns not found: ${parsed.missingColumns.join(", ")}`;
        return out;
      }

      out.records = parsed.records;
      out.ok = true;
      return out;
    } catch (e) {
      out.error = e instanceof Error ? e.message : "fetch failed";
    }
  }
  return out;
}

/**
 * Fetch one dataset per market and report what came back, WITHOUT writing
 * anything.
 *
 * This exists because the parser was written against the published schema by
 * someone who could not reach the exchange to check it. If the live column names
 * differ, the parser refuses to guess — which is right, but it leaves "source
 * unavailable" on the page with no indication of why. This answers that from a
 * deployment that does have network: the HTTP status, the row count, and the
 * payload's own column names.
 */
export async function probeTaiwanDatasets(): Promise<
  { dataset: string; url?: string; httpStatus?: number; rowsIn: number; records: number; missingColumns?: string[]; seenColumns?: string[]; error?: string; ok: boolean }[]
> {
  const specs = DATASETS.filter((d) => d.eventType === "holding_snapshot");
  const out = [];
  for (const spec of specs) {
    const o = await fetchDataset(spec);
    out.push({
      dataset: o.dataset,
      url: o.url,
      httpStatus: o.httpStatus,
      rowsIn: o.rowsIn,
      records: o.records.length,
      missingColumns: o.missingColumns,
      seenColumns: o.seenColumns,
      error: o.error,
      ok: o.ok,
    });
  }
  return out;
}

export interface MarketWideResult {
  /** companyId → records, newest first. */
  byCompany: Map<string, TaiwanInsiderRecord[]>;
  outcomes: DatasetOutcome[];
  /** True when EVERY dataset answered. A partial run must not overwrite good data. */
  complete: boolean;
  /**
   * Completeness per market.
   *
   * One flag for both exchanges was wrong: TWSE's three files ingested 27,528
   * rows and TPEx's three failed, so `complete` was false, the roster was never
   * written, and every TWSE company without filings was reported as "source
   * unavailable" indefinitely. One exchange being down says nothing about the
   * other, and the two are separate files from separate publishers.
   */
  completeByMarket: Record<TaiwanMarket, boolean>;
  /** True when at least one dataset answered. */
  any: boolean;
  totalRecords: number;
}

/** Fetch all six datasets and bucket every record by company. */
export async function fetchTaiwanInsiderMarketWide(): Promise<MarketWideResult> {
  // Six files, sequentially. Politeness towards a public-sector host matters
  // more than the few seconds saved, and this runs on a schedule where nobody
  // is waiting.
  const outcomes: DatasetOutcome[] = [];
  for (const spec of DATASETS) outcomes.push(await fetchDataset(spec));

  const byCompany = new Map<string, TaiwanInsiderRecord[]>();
  let total = 0;
  for (const o of outcomes) {
    for (const r of o.records) {
      total++;
      const list = byCompany.get(r.companyId);
      if (list) list.push(r);
      else byCompany.set(r.companyId, [r]);
    }
  }
  for (const list of byCompany.values()) {
    list.sort((a, b) => (a.filingDate < b.filingDate ? 1 : a.filingDate > b.filingDate ? -1 : 0));
  }

  const completeByMarket = {
    TWSE: outcomes.filter((o) => o.market === "TWSE").every((o) => o.ok),
    TPEx: outcomes.filter((o) => o.market === "TPEx").every((o) => o.ok),
  };

  return {
    byCompany,
    outcomes,
    completeByMarket,
    complete: outcomes.every((o) => o.ok),
    any: outcomes.some((o) => o.ok),
    totalRecords: total,
  };
}
