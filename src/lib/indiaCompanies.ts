import { kvGet, kvSet, kvConfigured } from "@/lib/kv";
import { coversAllTokens, type SearchHit } from "@/lib/searchRank";

// Every company listed on NSE, searchable locally.
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
// NSE publishes the list as a CSV on its own CDN. It is fetched once, cached in
// Redis for a week, and memoised per instance — a company listing is not
// news, and the file changes when a company lists or delists.

export interface IndiaCompany {
  symbol: string; // NSE trading symbol, e.g. HDFCLIFE
  name: string; // "HDFC Life Insurance Company Limited"
}

const KEY = "india:equity-list:v1";
const TTL = 60 * 60 * 24 * 7;
const SRC = "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

let memo: IndiaCompany[] | null = null;
let memoAt = 0;
const MEMO_MS = 60 * 60 * 1000;

/** SYMBOL,NAME OF COMPANY,SERIES,… — we need the first two columns. */
export function parseEquityCsv(text: string): IndiaCompany[] {
  const out: IndiaCompany[] = [];
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const symbol = (cols[0] ?? "").trim().toUpperCase();
    const name = (cols[1] ?? "").trim();
    if (!symbol || !name) continue;
    if (!/^[A-Z0-9&-]{1,20}$/.test(symbol)) continue;
    out.push({ symbol, name });
  }
  return out;
}

async function load(): Promise<IndiaCompany[]> {
  if (memo && Date.now() - memoAt < MEMO_MS) return memo;

  if (kvConfigured()) {
    try {
      const raw = await kvGet(KEY);
      if (raw) {
        const arr = JSON.parse(raw) as IndiaCompany[];
        if (Array.isArray(arr) && arr.length > 100) {
          memo = arr;
          memoAt = Date.now();
          return arr;
        }
      }
    } catch {
      /* unreadable cache is the same as a cold one */
    }
  }

  try {
    const r = await fetch(SRC, {
      headers: { "User-Agent": UA, Accept: "text/csv,*/*" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: TTL },
    });
    if (!r.ok) return memo ?? [];
    const list = parseEquityCsv(await r.text());
    if (list.length < 100) return memo ?? [];
    memo = list;
    memoAt = Date.now();
    if (kvConfigured()) await kvSet(KEY, JSON.stringify(list), TTL);
    return list;
  } catch {
    // Keep serving a stale list rather than losing Indian search entirely.
    return memo ?? [];
  }
}

/**
 * Companies whose name or symbol carries EVERY query word, in any order.
 *
 * The intersection happens here, over the full list, rather than over whatever
 * an upstream chose to return — which is the whole point of holding the list.
 */
export async function searchIndia(tokens: string[], limit = 12): Promise<SearchHit[]> {
  if (!tokens.length) return [];
  const list = await load();
  if (!list.length) return [];

  const hits: SearchHit[] = [];
  for (const c of list) {
    const candidate: SearchHit = {
      symbol: `${c.symbol}.NS`,
      name: c.name,
      type: "Common Stock",
      exchange: "NSE",
      flag: "🇮🇳",
      country: "IN",
      kind: "Stock",
    };
    if (coversAllTokens(candidate, tokens)) hits.push(candidate);
    if (hits.length >= limit * 4) break; // ranking narrows this further upstream
  }
  return hits.slice(0, limit * 4);
}

/** Exposed for diagnostics: how many companies the local index holds. */
export async function indiaIndexSize(): Promise<number> {
  return (await load()).length;
}
