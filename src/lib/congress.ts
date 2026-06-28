// Congressional (US House & Senate) stock trades, disclosed under the STOCK Act.
// Pulled from the public, free Stock Watcher datasets (community mirrors of the
// official House/Senate financial-disclosure filings). Server-side only, cached.
// No API key. If a source is unreachable we return nothing — never fake data.

const SENATE_URL =
  "https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json";
const HOUSE_URL =
  "https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export interface CongressTrade {
  id: string;
  person: string;
  chamber: "Senate" | "House";
  ticker: string;
  asset: string;
  action: "Buy" | "Sell" | "Exchange";
  amount: string; // disclosed dollar range
  owner?: string;
  transactionDate: string; // ISO yyyy-mm-dd
  disclosureDate?: string;
  ms: number; // transaction timestamp for sorting
  link?: string;
}

function toIso(d: string | undefined): { iso: string; ms: number } {
  if (!d) return { iso: "", ms: 0 };
  // Senate: MM/DD/YYYY ; House: YYYY-MM-DD
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

async function fetchJson(url: string): Promise<unknown[] | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      next: { revalidate: 21600 }, // 6h — these update slowly
      signal: AbortSignal.timeout(9000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch {
    return null;
  }
}

export async function getCongressTrades(limit = 30): Promise<CongressTrade[]> {
  const [senate, house] = await Promise.all([fetchJson(SENATE_URL), fetchJson(HOUSE_URL)]);
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

  return out.sort((a, b) => b.ms - a.ms).slice(0, limit);
}
