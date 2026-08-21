import { kvGet, kvSet, kvConfigured } from "@/lib/kv";
import { coversAllTokens, type SearchHit } from "@/lib/searchRank";

// Every company listed on NSE and BSE, searchable locally.
//
// This exists because retrieval, not matching, was the thing that kept failing.
// Asking Yahoo for "hdfc" and hoping HDFC Life is inside the rows it chooses to
// return is not a search — it is a bet, and it lost repeatedly on exactly the
// Indian listings this app is for. Keyword logic downstream cannot rescue a
// candidate that was never fetched.
//
// So the whole list is held locally and every word of a query is matched
// against all of it. Two thousand-odd rows is nothing to filter in memory, and
// the answer stops depending on a third party's ranking.
//
// Both exchanges publish a security master. They are fetched once, cached in
// Redis for a week, and memoised per instance — a company listing is not news,
// and the masters change when a company lists or delists. Their shared ISIN is
// carried downstream so NSE and BSE lines group as one company without guessing.

export interface IndiaCompany {
  symbol: string; // trading symbol/code, e.g. HDFCLIFE or 500180
  name: string; // "HDFC Life Insurance Company Limited"
  exchange: "NSE" | "BSE";
  isin?: string;
}

const NSE_KEY = "india:nse-equity-list:v2";
const BSE_KEY = "india:bse-equity-list:v1";
const TTL = 60 * 60 * 24 * 7;
const NSE_SRC = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv";
const BSE_SRC =
  "https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?Group=&Scripcode=&industry=&segment=Equity&status=Active";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

let nseMemo: IndiaCompany[] | null = null;
let nseMemoAt = 0;
let bseMemo: IndiaCompany[] | null = null;
let bseMemoAt = 0;
const MEMO_MS = 60 * 60 * 1000;

// Tiny last-resort seed for the HDFC family that exposed this retrieval bug.
// The normal path is always the complete exchange master below. These stable
// exchange identifiers keep the reported companies usable if both master-data
// providers block a cold server before the weekly cache has been populated.
const BSE_BOOTSTRAP: IndiaCompany[] = [
  { symbol: "500180", name: "HDFC Bank Limited", exchange: "BSE", isin: "INE040A01034" },
  { symbol: "541729", name: "HDFC Asset Management Company Limited", exchange: "BSE", isin: "INE127D01025" },
  { symbol: "540777", name: "HDFC Life Insurance Company Limited", exchange: "BSE", isin: "INE795G01014" },
];

/** Parse one RFC-4180-style CSV row, including quoted company names. */
function csvRow(line: string): string[] {
  const out: string[] = [];
  let value = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"';
        i++;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      out.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  out.push(value);
  return out;
}

/** NSE: SYMBOL, NAME OF COMPANY, …, ISIN NUMBER, … */
export function parseEquityCsv(text: string): IndiaCompany[] {
  const out: IndiaCompany[] = [];
  const lines = text.split(/\r?\n/);
  const header = csvRow(lines[0] ?? "").map((value) => value.trim().toUpperCase());
  const symbolColumn = Math.max(0, header.indexOf("SYMBOL"));
  const nameColumn = header.indexOf("NAME OF COMPANY");
  const isinColumn = header.indexOf("ISIN NUMBER");
  for (let i = 1; i < lines.length; i++) {
    const cols = csvRow(lines[i]);
    const symbol = (cols[symbolColumn] ?? "").trim().toUpperCase();
    const name = (cols[nameColumn >= 0 ? nameColumn : 1] ?? "").trim();
    const rawIsin = (cols[isinColumn] ?? "").trim().toUpperCase();
    const isin = /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(rawIsin) ? rawIsin : undefined;
    if (!symbol || !name) continue;
    if (!/^[A-Z0-9&-]{1,20}$/.test(symbol)) continue;
    out.push({ symbol, name, exchange: "NSE", isin });
  }
  return out;
}

/** BSE's official active-equity master is JSON with a `Table` row collection. */
export function parseBseScripData(payload: unknown): IndiaCompany[] {
  const envelope = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const rows = Array.isArray(payload)
    ? payload
    : Array.isArray(envelope.Table)
      ? envelope.Table
      : Object.values(envelope).find(Array.isArray) ?? [];
  const out: IndiaCompany[] = [];
  for (const value of rows) {
    if (!value || typeof value !== "object") continue;
    const row = value as Record<string, unknown>;
    const text = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v).trim() : "");
    const symbol = text(row.SCRIP_CD ?? row.Scrip_Cd ?? row.Scripcode ?? row.scrip_cd ?? row.Code);
    const name = text(row.Scrip_Name ?? row.Security_Name ?? row.Scrip_ID ?? row.scrip_name ?? row.Name);
    const rawIsin = text(row.ISIN_NUMBER ?? row.ISIN ?? row.isin ?? row.Isin).toUpperCase();
    const isin = /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(rawIsin) ? rawIsin : undefined;
    if (!/^\d{5,6}$/.test(symbol) || !name) continue;
    out.push({ symbol, name, exchange: "BSE", isin });
  }
  return out;
}

async function fromCache(key: string): Promise<IndiaCompany[] | null> {
  if (!kvConfigured()) return null;
  try {
    const raw = await kvGet(key);
    if (!raw) return null;
    const arr = JSON.parse(raw) as IndiaCompany[];
    return Array.isArray(arr) && arr.length > 100 ? arr : null;
  } catch {
    return null;
  }
}

async function loadNse(): Promise<IndiaCompany[]> {
  if (nseMemo && Date.now() - nseMemoAt < MEMO_MS) return nseMemo;

  const cached = await fromCache(NSE_KEY);
  if (cached) {
    nseMemo = cached;
    nseMemoAt = Date.now();
    return cached;
  }

  try {
    const r = await fetch(NSE_SRC, {
      headers: { "User-Agent": UA, Accept: "text/csv,*/*" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: TTL },
    });
    if (!r.ok) return nseMemo ?? [];
    const list = parseEquityCsv(await r.text());
    if (list.length < 100) return nseMemo ?? [];
    nseMemo = list;
    nseMemoAt = Date.now();
    if (kvConfigured()) await kvSet(NSE_KEY, JSON.stringify(list), TTL);
    return list;
  } catch {
    return nseMemo ?? [];
  }
}

async function loadBse(): Promise<IndiaCompany[]> {
  if (bseMemo && Date.now() - bseMemoAt < MEMO_MS) return bseMemo;

  const cached = await fromCache(BSE_KEY);
  if (cached) {
    bseMemo = cached;
    bseMemoAt = Date.now();
    return cached;
  }

  const sources: { url: string; headers: Record<string, string> }[] = [];
  const eodhdKey = process.env.EODHD_API_KEY;
  if (eodhdKey) {
    sources.push({
      url: `https://eodhd.com/api/exchange-symbol-list/BSE?api_token=${encodeURIComponent(eodhdKey)}&fmt=json`,
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
  }
  sources.push({
    url: BSE_SRC,
    headers: {
      "User-Agent": UA,
      Accept: "application/json,text/plain,*/*",
      Referer: "https://www.bseindia.com/",
      Origin: "https://www.bseindia.com",
    },
  });

  for (const source of sources) {
    try {
      const r = await fetch(source.url, {
        headers: source.headers,
        signal: AbortSignal.timeout(4000),
        next: { revalidate: TTL },
      });
      if (!r.ok) continue;
      const list = parseBseScripData(await r.json());
      if (list.length < 100) continue;
      bseMemo = list;
      bseMemoAt = Date.now();
      if (kvConfigured()) await kvSet(BSE_KEY, JSON.stringify(list), TTL);
      return list;
    } catch {
      // Try the next complete master before falling back to the small seed.
    }
  }

  bseMemo = BSE_BOOTSTRAP;
  bseMemoAt = Date.now();
  return bseMemo;
}

/**
 * Companies whose name or symbol carries EVERY query word, in any order.
 *
 * The intersection happens here, over the full list, rather than over whatever
 * an upstream chose to return — which is the whole point of holding the list.
 */
export async function searchIndia(tokens: string[], limit = 12): Promise<SearchHit[]> {
  if (!tokens.length) return [];
  const [nse, bse] = await Promise.all([loadNse(), loadBse()]);
  const matching = (list: IndiaCompany[]) => {
    const hits: SearchHit[] = [];
    for (const c of list) {
      const candidate: SearchHit = {
        symbol: `${c.symbol}.${c.exchange === "NSE" ? "NS" : "BO"}`,
        name: c.name,
        type: "Equity",
        exchange: c.exchange,
        flag: "🇮🇳",
        country: "IN",
        kind: "Stock",
        isin: c.isin,
      };
      if (coversAllTokens(candidate, tokens)) hits.push(candidate);
      if (hits.length >= limit * 4) break;
    }
    return hits;
  };

  // Cap each venue independently. A broad query such as "bank" can fill the
  // NSE allowance on its own; one shared cap would then hide every BSE line.
  return [...matching(nse), ...matching(bse)];
}

/** Exposed for diagnostics: how many companies the local index holds. */
export async function indiaIndexSize(): Promise<number> {
  const [nse, bse] = await Promise.all([loadNse(), loadBse()]);
  return nse.length + bse.length;
}
