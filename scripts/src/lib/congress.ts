// Congressional (US House & Senate) stock trades, disclosed under the STOCK Act.
// Two sources, in priority order:
//   1) Financial Modeling Prep (small, fast JSON) when FMP_API_KEY is set —
//      reliable within serverless time limits. Free tier works.
//   2) The public Stock Watcher dumps (keyless) as a fallback. These are large
//      (~15MB) and can exceed a serverless function's time limit, which is why
//      the keyless path may return nothing on small hosting tiers.
// Server-side only. If nothing is reachable we return [] — never fake data.

const FMP_BASE = "https://financialmodelingprep.com/stable";

const SENATE_URLS = [
  "https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json",
  "https://senate-stock-watcher-data.s3.amazonaws.com/aggregate/all_transactions.json",
];
const HOUSE_URLS = [
  "https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json",
  "https://house-stock-watcher-data.s3.amazonaws.com/data/all_transactions.json",
];

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

let CACHE: { ts: number; trades: CongressTrade[] } | null = null;
const TTL_MS = 6 * 60 * 60 * 1000; // 6h

export interface CongressTrade {
  id: string;
  person: string;
  chamber: "Senate" | "House";
  ticker: string;
  asset: string;
  action: "Buy" | "Sell" | "Exchange";
  amount: string;
  owner?: string;
  transactionDate: string;
  disclosureDate?: string;
  ms: number;
  link?: string;
}

function toIso(d: string | undefined): { iso: string; ms: number } {
  if (!d) return { iso: "", ms: 0 };
  let ms = Date.parse(d);
  if (isNaN(ms) && /\d{2}\/\d{2}\/\d{4}/.test(d)) {
    const [mm, dd, yy] = d.split("/");
    ms = Date.parse(`${yy}-${mm}-${dd}`);
  }
  if (isNaN(ms)) return { iso: d, ms: 0 };
  return { iso: new Date(ms).toISOString().slice(0, 10), ms };
}

function actionOf(type: string | undefined): CongressTrade["action"] {
  const t = (type || "").toLowerCase();
  if (t.includes("purchase") || t === "buy") return "Buy";
  if (t.includes("sale") || t.includes("sell")) return "Sell";
  return "Exchange";
}

function cleanTicker(t: string | undefined): string {
  const s = (t || "").trim().toUpperCase();
  if (!s || s === "--" || s === "N/A" || s.length > 6) return "";
  return s;
}

// ── Source 1: Financial Modeling Prep (preferred) ───────────────────────────
function fmpKey(): string {
  return process.env.FMP_API_KEY || process.env.NEXT_PUBLIC_FMP_API_KEY || "";
}

async function fmpFetch(path: string): Promise<Record<string, string>[] | null> {
  const key = fmpKey();
  if (!key) return null;
  const sep = path.includes("?") ? "&" : "?";
  try {
    const r = await fetch(`${FMP_BASE}/${path}${sep}apikey=${key}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? (j as Record<string, string>[]) : null;
  } catch {
    return null;
  }
}

function fromFmp(row: Record<string, string>, chamber: CongressTrade["chamber"], i: number): CongressTrade | null {
  const ticker = cleanTicker(row.symbol);
  if (!ticker) return null;
  const { iso, ms } = toIso(row.transactionDate);
  const person =
    `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim() ||
    (chamber === "Senate" ? "U.S. Senator" : "U.S. Representative");
  return {
    id: `${chamber[0]}-${person}-${ticker}-${row.transactionDate}-${i}`,
    person,
    chamber,
    ticker,
    asset: row.assetDescription || ticker,
    action: actionOf(row.type),
    amount: row.amount || "—",
    owner: row.owner,
    transactionDate: iso,
    disclosureDate: toIso(row.disclosureDate).iso,
    ms,
    link: row.link,
  };
}

async function loadFromFmp(ticker?: string): Promise<CongressTrade[] | null> {
  if (!fmpKey()) return null;
  const [sen, hou] = await Promise.all([
    fmpFetch(ticker ? `senate-trades?symbol=${encodeURIComponent(ticker)}` : "senate-latest?page=0&limit=100"),
    fmpFetch(ticker ? `house-trades?symbol=${encodeURIComponent(ticker)}` : "house-latest?page=0&limit=100"),
  ]);
  if (sen == null && hou == null) return null; // FMP unreachable
  const out: CongressTrade[] = [];
  (sen ?? []).forEach((r, i) => {
    const t = fromFmp(r, "Senate", i);
    if (t) out.push(t);
  });
  (hou ?? []).forEach((r, i) => {
    const t = fromFmp(r, "House", i);
    if (t) out.push(t);
  });
  return out.sort((a, b) => b.ms - a.ms);
}

// ── Source 2: Stock Watcher dumps (keyless fallback) ────────────────────────
async function fetchJson(urls: string[]): Promise<unknown[] | null> {
  for (const url of urls) {
    try {
      const r = await fetch(url, {
        headers: { "User-Agent": UA, Accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) continue;
      const j = await r.json();
      if (Array.isArray(j)) return j;
    } catch {
      /* next candidate */
    }
  }
  return null;
}

async function loadFromStockWatcher(): Promise<CongressTrade[]> {
  if (CACHE && Date.now() - CACHE.ts < TTL_MS && CACHE.trades.length) return CACHE.trades;

  const [senate, house] = await Promise.all([fetchJson(SENATE_URLS), fetchJson(HOUSE_URLS)]);
  const out: CongressTrade[] = [];

  if (senate) {
    for (const row of senate as Record<string, string>[]) {
      const ticker = cleanTicker(row.ticker);
      if (!ticker) continue;
      const { iso, ms } = toIso(row.transaction_date);
      out.push({
        id: `s-${row.senator}-${ticker}-${row.transaction_date}-${out.length}`,
        person: row.senator || "U.S. Senator",
        chamber: "Senate",
        ticker,
        asset: row.asset_description || ticker,
        action: actionOf(row.type),
        amount: row.amount || "—",
        owner: row.owner,
        transactionDate: iso,
        disclosureDate: toIso(row.disclosure_date).iso,
        ms,
        link: row.ptr_link,
      });
    }
  }
  if (house) {
    for (const row of house as Record<string, string>[]) {
      const ticker = cleanTicker(row.ticker);
      if (!ticker) continue;
      const { iso, ms } = toIso(row.transaction_date);
      out.push({
        id: `h-${row.representative}-${ticker}-${row.transaction_date}-${out.length}`,
        person: (row.representative || "U.S. Representative").replace(/^Hon\.\s*/i, ""),
        chamber: "House",
        ticker,
        asset: row.asset_description || ticker,
        action: actionOf(row.type),
        amount: row.amount || "—",
        owner: row.owner,
        transactionDate: iso,
        disclosureDate: toIso(row.disclosure_date).iso,
        ms,
        link: row.ptr_link,
      });
    }
  }

  const sorted = out.sort((a, b) => b.ms - a.ms).slice(0, 4000);
  if (sorted.length) CACHE = { ts: Date.now(), trades: sorted };
  return sorted;
}

// Public entry: latest trades, optionally filtered to one ticker.
export async function getCongressTrades(opts: { limit?: number; ticker?: string } = {}): Promise<CongressTrade[]> {
  const { limit = 30, ticker } = opts;

  // 1) Preferred: FMP (small + fast). Handles ticker search server-side.
  const fmp = await loadFromFmp(ticker);
  if (fmp && fmp.length) return fmp.slice(0, limit);

  // 2) Fallback: the keyless Stock Watcher dump.
  const all = await loadFromStockWatcher();
  const filtered = ticker ? all.filter((t) => t.ticker === ticker.toUpperCase()) : all;
  return filtered.slice(0, limit);
}
