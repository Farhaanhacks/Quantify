// Real insider transactions from SEC EDGAR (Form 4 filings) — public-domain US
// government data, no API key. Per-company and a curated market feed. Each trade
// carries the 10b5-1 flag (and plan adoption date when the footnote states it),
// which is the disclosed signal that a sale/purchase was pre-arranged.
//
// Scope: US filers only. Non-US symbols (e.g. ".NS" India) won't be in EDGAR.
// All network access is wrapped so a failure simply yields an empty list and the
// UI falls back to its demo set — nothing here can break the build or a page.

import * as cheerio from "cheerio";
import { politeFetch } from "@/lib/ingest/politeFetch";

const UA =
  process.env.EDGAR_USER_AGENT ||
  "Quantifi/1.0 (personal research app; quantifi-app@users.noreply.github.com)";

export interface InsiderTrade {
  id: string;
  ticker: string;
  company: string;
  person: string;
  role: string;
  action: string; // Buy / Sell / Grant / Exercise / Gift / Tax / Acquire / Dispose
  acquired: boolean; // true = shares acquired (bullish tone), false = disposed
  shares: number;
  price: number;
  value: number;
  date: string; // YYYY-MM-DD
  planned: boolean; // executed under a Rule 10b5-1 plan
  planDate?: string; // plan adoption date, if disclosed in a footnote
  code: string; // raw SEC transaction code
}

const clean = (s: string) => (s || "").replace(/\s+/g, " ").trim();
const num = (s: string) => {
  const n = parseFloat((s || "").replace(/[, $]/g, ""));
  return isFinite(n) ? n : 0;
};

function actionFor(code: string, ad: string): string {
  switch (code) {
    case "P": return "Buy";
    case "S": return "Sell";
    case "A": return "Grant";
    case "M": return "Exercise";
    case "G": return "Gift";
    case "F": return "Tax";
    case "C": return "Conversion";
    default: return ad === "A" ? "Acquire" : ad === "D" ? "Dispose" : code || "Other";
  }
}

interface TickerRow {
  cik_str: number;
  ticker: string;
  title: string;
}

let cikMap: Record<string, { cik: string; name: string }> | null = null;

export async function loadCikMap(): Promise<Record<string, { cik: string; name: string }>> {
  if (cikMap) return cikMap;
  const res = await politeFetch("https://www.sec.gov/files/company_tickers.json", {
    userAgent: UA,
    revalidateSeconds: 86400,
  });
  if (!res.ok) throw new Error(`EDGAR ticker map ${res.status}`);
  const data = (await res.json()) as Record<string, TickerRow>;
  const map: Record<string, { cik: string; name: string }> = {};
  for (const key of Object.keys(data)) {
    const row = data[key];
    if (row?.ticker) map[row.ticker.toUpperCase()] = { cik: String(row.cik_str).padStart(10, "0"), name: row.title };
  }
  cikMap = map;
  return map;
}

function parseForm4(xml: string, fallbackTicker: string, fallbackCompany: string, acc: string): InsiderTrade[] {
  try {
    const $ = cheerio.load(xml, { xmlMode: true });

    const owner = $("reportingOwner").first();
    const person = clean(owner.find("rptOwnerName").first().text()) || "Insider";
    const isDir = owner.find("isDirector").first().text().trim();
    const isOff = owner.find("isOfficer").first().text().trim();
    const isTen = owner.find("isTenPercentOwner").first().text().trim();
    const offTitle = clean(owner.find("officerTitle").first().text());
    const truthy = (v: string) => v === "1" || v.toLowerCase() === "true";
    const roles: string[] = [];
    if (truthy(isOff)) roles.push(offTitle || "Officer");
    if (truthy(isDir)) roles.push("Director");
    if (truthy(isTen)) roles.push("10% Owner");
    const role = roles.join(" · ") || "Insider";

    const issuerSym = clean($("issuerTradingSymbol").first().text()) || fallbackTicker;
    const issuerName = clean($("issuerName").first().text()) || fallbackCompany;

    const footText = clean($("footnotes").text() + " " + $("remarks").text());
    const planned =
      /10b5[- ]?1/i.test(footText) || $("aff10b5One").length > 0 || $("rule10b5_1").length > 0;
    const m = footText.match(/adopted\s+(?:on\s+)?([A-Za-z]+\s+\d{1,2},?\s+\d{4})/i);
    const planDate = m ? m[1] : undefined;

    const out: InsiderTrade[] = [];
    $("nonDerivativeTransaction").each((idx, el) => {
      const node = $(el);
      const code = clean(node.find("transactionCode").first().text());
      const ad = clean(node.find("transactionAcquiredDisposedCode value").first().text());
      const shares = num(node.find("transactionShares value").first().text());
      const price = num(node.find("transactionPricePerShare value").first().text());
      const date = clean(node.find("transactionDate value").first().text());
      if (!shares && !price) return;
      out.push({
        id: `${acc}-${idx}`,
        ticker: issuerSym.toUpperCase(),
        company: issuerName,
        person,
        role,
        action: actionFor(code, ad),
        acquired: ad === "A",
        shares,
        price,
        value: Math.round(shares * price),
        date,
        planned,
        planDate,
        code,
      });
    });
    return out;
  } catch {
    return [];
  }
}

interface Submissions {
  name?: string;
  filings?: {
    recent?: {
      accessionNumber?: string[];
      filingDate?: string[];
      form?: string[];
      primaryDocument?: string[];
    };
  };
}

export interface EdgarDebug {
  /** Whether the ticker resolved to a CIK at all. */
  cik?: string;
  /** HTTP status of the submissions request — the usual point of failure. */
  submissionsStatus?: number;
  /** Form 4 filings found in the submissions index. */
  form4Found?: number;
  /** Filings actually fetched and parsed. */
  fetched?: number;
  /** Non-200s while fetching the individual filings. */
  filingErrors?: number;
  reason?: string;
  /** True when SEC has no declared contact for us and may be throttling. */
  userAgentDeclared?: boolean;
  /**
   * The source failed, as opposed to answering that there is nothing.
   *
   * Set explicitly rather than inferred downstream from which debug fields
   * happen to be populated: the ticker-map failure sets none of them, so an
   * inference read it as "this company has no filings" — the exact confusion
   * this whole object exists to prevent.
   */
  sourceFailed?: boolean;
}

/**
 * Company trades, WITH the reason when there are none.
 *
 * Home Depot is the case that forced this. It has Form 4 filings — a CFO sale
 * in March 2026 among them — and the page showed nothing at all, because every
 * failure in here returned the same empty array that a genuinely quiet company
 * would, and the section then hid itself. An unreachable EDGAR and a company
 * whose officers have not traded are not the same fact, and the reader could
 * not tell which they were looking at.
 *
 * The likeliest cause of an empty result is the first line of this debug
 * object: SEC asks every automated client to declare a real contact address in
 * its User-Agent and throttles or refuses those that do not. Set
 * EDGAR_USER_AGENT.
 */
export async function getCompanyInsiderTradesWithDebug(
  ticker: string,
  limit = 15
): Promise<{ trades: InsiderTrade[]; debug: EdgarDebug }> {
  const debug: EdgarDebug = {
    userAgentDeclared: Boolean(process.env.EDGAR_USER_AGENT?.trim()),
  };
  try {
    const t = ticker.toUpperCase();
    if (/\.[A-Z]{1,4}$/i.test(t)) {
      debug.reason = "not a US listing";
      return { trades: [], debug };
    }
    const map = await loadCikMap().catch(() => null);
    if (!map) {
      debug.sourceFailed = true;
      debug.reason = "EDGAR ticker map unavailable";
      return { trades: [], debug };
    }
    const entry = map[t];
    if (!entry) {
      debug.reason = "ticker not in EDGAR's company list";
      return { trades: [], debug };
    }
    debug.cik = entry.cik;
    const cikInt = String(parseInt(entry.cik, 10));

    const subRes = await politeFetch(`https://data.sec.gov/submissions/CIK${entry.cik}.json`, {
      userAgent: UA,
      revalidateSeconds: 3600,
    });
    debug.submissionsStatus = subRes.status;
    if (!subRes.ok) {
      debug.sourceFailed = true;
      debug.reason = `SEC responded ${subRes.status} to the submissions request`;
      return { trades: [], debug };
    }
    const sub = (await subRes.json()) as Submissions;
    const rec = sub?.filings?.recent;
    const forms = rec?.form;
    const accs = rec?.accessionNumber;
    const docs = rec?.primaryDocument;
    if (!forms || !accs || !docs) {
      debug.sourceFailed = true;
      debug.reason = "submissions payload had no filing index";
      return { trades: [], debug };
    }
    const companyName = sub.name || t;

    const idxs: number[] = [];
    // "4" and "4/A": an amendment is still the disclosure, and skipping them
    // dropped corrected filings entirely.
    for (let i = 0; i < forms.length && idxs.length < 12; i++) {
      if (forms[i] === "4" || forms[i] === "4/A") idxs.push(i);
    }
    debug.form4Found = idxs.length;
    if (!idxs.length) {
      debug.reason = "no Form 4 filings in the recent index";
      return { trades: [], debug };
    }

    let fetched = 0;
    let filingErrors = 0;
    const trades: InsiderTrade[] = [];
    for (const i of idxs) {
      const accNo = accs[i];
      const acc = accNo.replace(/-/g, "");
      let doc = docs[i] || "";
      doc = doc.replace(/^xslF345X\d+\//, ""); // strip XSL render prefix -> raw ownership XML
      if (!doc.toLowerCase().endsWith(".xml")) continue;
      const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${cikInt}/${acc}/${doc}`;
      try {
        const xr = await politeFetch(xmlUrl, {
          userAgent: UA,
          revalidateSeconds: 86400,
          accept: "application/xml",
        });
        if (!xr.ok) {
          filingErrors++;
          continue;
        }
        fetched++;
        trades.push(...parseForm4(await xr.text(), t, companyName, accNo));
      } catch {
        filingErrors++;
      }
      if (trades.length >= limit) break;
    }
    debug.fetched = fetched;
    debug.filingErrors = filingErrors;
    if (!trades.length && filingErrors > 0) {
      debug.sourceFailed = true;
      debug.reason = `every Form 4 fetch failed (${filingErrors} of them)`;
    }
    return { trades: trades.slice(0, limit), debug };
  } catch (e) {
    debug.sourceFailed = true;
    debug.reason = e instanceof Error ? e.message : "request failed";
    return { trades: [], debug };
  }
}

export async function getCompanyInsiderTrades(ticker: string, limit = 15): Promise<InsiderTrade[]> {
  return (await getCompanyInsiderTradesWithDebug(ticker, limit)).trades;
}

const FEED_TICKERS = ["NVDA", "MSFT", "AAPL", "TSLA", "AMD", "META", "AMZN", "NFLX"];

export async function getRecentInsiderTrades(limit = 18): Promise<InsiderTrade[]> {
  try {
    const lists = await Promise.all(
      FEED_TICKERS.map((t) => getCompanyInsiderTrades(t, 3).catch(() => [] as InsiderTrade[]))
    );
    const all = lists.flat();
    all.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
    return all.slice(0, limit);
  } catch {
    return [];
  }
}
