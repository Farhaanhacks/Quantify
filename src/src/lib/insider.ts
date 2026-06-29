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

async function loadCikMap(): Promise<Record<string, { cik: string; name: string }>> {
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

export async function getCompanyInsiderTrades(ticker: string, limit = 15): Promise<InsiderTrade[]> {
  try {
    const t = ticker.toUpperCase();
    if (/\.(NS|BO|L|TO|HK|AX|DE|PA|SW)$/i.test(t)) return []; // non-US: not in EDGAR
    const map = await loadCikMap();
    const entry = map[t];
    if (!entry) return [];
    const cikInt = String(parseInt(entry.cik, 10));

    const subRes = await politeFetch(`https://data.sec.gov/submissions/CIK${entry.cik}.json`, {
      userAgent: UA,
      revalidateSeconds: 3600,
    });
    if (!subRes.ok) return [];
    const sub = (await subRes.json()) as Submissions;
    const rec = sub?.filings?.recent;
    const forms = rec?.form;
    const accs = rec?.accessionNumber;
    const docs = rec?.primaryDocument;
    if (!forms || !accs || !docs) return [];
    const companyName = sub.name || t;

    const idxs: number[] = [];
    for (let i = 0; i < forms.length && idxs.length < 10; i++) {
      if (forms[i] === "4") idxs.push(i);
    }

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
        if (!xr.ok) continue;
        const xml = await xr.text();
        trades.push(...parseForm4(xml, t, companyName, accNo));
      } catch {
        /* skip this filing */
      }
      if (trades.length >= limit) break;
    }
    return trades.slice(0, limit);
  } catch {
    return [];
  }
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
