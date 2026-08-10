import { NextResponse } from "next/server";
import { COUNTRY_ISO, countryForSymbol } from "@/lib/listingCountry";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

export interface SearchHit {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  flag: string;
  /** ISO-3166 alpha-2, so the client can draw a flag rather than rely on emoji. */
  country?: string;
  /** Normalised class: what this listing actually is. */
  kind?: "Stock" | "ETF" | "Fund" | "Index";
}

// Yahoo and EODHD each describe the same thing several ways ("Common Stock",
// "EQUITY", "FUND", "Mutual Fund", "ETF"). One label, so the UI can say what a
// row is without repeating the vendor's vocabulary.
function kindOf(type: string, symbol: string): SearchHit["kind"] {
  const t = (type || "").toLowerCase();
  if (/index/.test(t)) return "Index";
  if (/etf|exchange.traded/.test(t)) return "ETF";
  // 0P-prefixed codes are Morningstar's identifiers for mutual funds. They come
  // back from EODHD carrying an exchange suffix, so they look like listings and
  // sort among real companies unless they're recognised for what they are.
  if (/fund|mutual|oeic|sicav|unit trust/.test(t) || /^0P[0-9A-Z]{6,}/i.test(symbol)) return "Fund";
  return "Stock";
}

// Rank so a search for a company finds the company.
//
// EODHD returns matches in its own order, which put six Morningstar fund codes
// above Kotak Mahindra Bank for the query "kotak". Nothing was sorting them;
// the route simply truncated whatever arrived. Ordering, most significant
// first: what the thing is, how squarely the name matches, and whether the
// symbol is one a human would recognise.
function rank(hit: SearchHit, q: string): number {
  const name = hit.name.toLowerCase();
  const sym = hit.symbol.toUpperCase();
  const query = q.toLowerCase().trim();
  let score = 0;

  // 1. Companies first, then ETFs, then funds. This is the whole complaint.
  score += { Stock: 0, ETF: 300, Fund: 600, Index: 450 }[hit.kind ?? "Stock"];

  // 2. A name that starts with the query beats one that merely contains it.
  if (name === query) score -= 120;
  else if (name.startsWith(query)) score -= 80;
  else if (new RegExp(`\\b${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(name)) score -= 40;

  // 3. An exact ticker match is almost always what was meant.
  if (sym === query.toUpperCase() || sym.split(".")[0] === query.toUpperCase()) score -= 150;

  // 4. A row whose name is just its own code tells the reader nothing —
  //    "0P0000GBDS.BO" is not a search result, it is an identifier. These sink
  //    below anything with a real name, including other funds.
  const nameIsJustTheCode =
    name.replace(/\.[a-z]{1,4}$/, "") === sym.replace(/\.[A-Z]{1,4}$/, "").toLowerCase();
  if (nameIsJustTheCode) score += 400;
  else if (/^0P[0-9A-Z]{6,}/i.test(sym)) score += 60; // named, but still an opaque ticker

  // 5. Primary listings over OTC/pink-sheet cross-listings. Kept well below the
  //    no-name penalty, so a named OTC fund still beats an unnamed local one.
  if (/otc|pink|grey/i.test(hit.exchange)) score += 50;

  // 6. Shorter names are usually the parent company rather than a share class.
  score += Math.min(40, name.length / 4);

  return score;
}

// Map a Yahoo symbol's exchange suffix to a country flag so users can eyeball the
// right listing — e.g. TRENT.NS 🇮🇳 vs SVT.L 🇬🇧. US symbols carry no suffix.
const SUFFIX_FLAG: Record<string, string> = {
  NS: "🇮🇳", BO: "🇮🇳", L: "🇬🇧", TO: "🇨🇦", V: "🇨🇦", AX: "🇦🇺", NZ: "🇳🇿",
  DE: "🇩🇪", F: "🇩🇪", PA: "🇫🇷", AS: "🇳🇱", BR: "🇧🇪", MI: "🇮🇹", MC: "🇪🇸",
  SW: "🇨🇭", ST: "🇸🇪", OL: "🇳🇴", CO: "🇩🇰", HE: "🇫🇮", LS: "🇵🇹", VI: "🇦🇹",
  IR: "🇮🇪", HK: "🇭🇰", T: "🇯🇵", SS: "🇨🇳", SZ: "🇨🇳", KS: "🇰🇷", KQ: "🇰🇷",
  TW: "🇹🇼", TWO: "🇹🇼", SI: "🇸🇬", KL: "🇲🇾", BK: "🇹🇭", JK: "🇮🇩", SA: "🇧🇷",
  MX: "🇲🇽", BA: "🇦🇷", SR: "🇸🇦", TA: "🇮🇱", IS: "🇹🇷", CA: "🇪🇬", JO: "🇿🇦",
};

// The suffix→ISO and name→ISO maps live in lib/listingCountry because the search
// dropdown needs the same answer for rows it loaded from localStorage. Emoji
// flags are regional-indicator pairs that Windows has no font for — they render
// there as the bare letters "IN"/"US", which is what the ISO code + drawn SVG
// replaced.
const countryFor = countryForSymbol;

function flagFor(symbol: string): string {
  const dot = symbol.lastIndexOf(".");
  if (dot === -1) return "🇺🇸"; // no suffix → US listing
  return SUFFIX_FLAG[symbol.slice(dot + 1).toUpperCase()] ?? "🌐";
}

const isEquityType = (type: string) =>
  /equity|etf|fund|index|common|preferred|share|stock|dr\b/i.test(type || "");

// ─── EODHD search (primary when EODHD_API_KEY is set) ────────────────────────
// EODHD indexes company NAMES and exchange CODES (incl. BSE numeric scrip codes),
// so "mini" → Mini Diamonds India and "523373" → Mini Diamonds India both resolve
// — the coverage Yahoo's search lacks for Indian names. We convert EODHD's
// `Code`+`Exchange` into the Yahoo-style symbol (`.BO`/`.NS`/…) the rest of the
// app already speaks, so the chosen result stays navigable by /api/quote etc.
const EODHD_SUFFIX: Record<string, string> = {
  US: "", NYSE: "", NASDAQ: "", AMEX: "", BATS: "", NMFQS: "", OTC: "", OTCQB: "", OTCQX: "", PINK: "",
  BSE: ".BO", NSE: ".NS", LSE: ".L", TO: ".TO", V: ".V", AU: ".AX", NZ: ".NZ",
  TW: ".TW", TWO: ".TWO", KO: ".KS", KQ: ".KQ", SHG: ".SS", SHE: ".SZ", HK: ".HK",
  XETRA: ".DE", F: ".F", PA: ".PA", AS: ".AS", MI: ".MI", MC: ".MC", SW: ".SW", LU: ".LU",
  ST: ".ST", OL: ".OL", CO: ".CO", HE: ".HE", VI: ".VI", IR: ".IR", BR: ".BR", SA: ".SA",
};

const COUNTRY_FLAG: Record<string, string> = {
  USA: "🇺🇸", "United States": "🇺🇸", India: "🇮🇳", Taiwan: "🇹🇼",
  "South Korea": "🇰🇷", Korea: "🇰🇷", China: "🇨🇳", "Hong Kong": "🇭🇰",
  UK: "🇬🇧", "United Kingdom": "🇬🇧", Canada: "🇨🇦", Australia: "🇦🇺",
  Japan: "🇯🇵", Germany: "🇩🇪", France: "🇫🇷", Singapore: "🇸🇬", Brazil: "🇧🇷",
};

async function eodhdSearch(q: string, key: string): Promise<SearchHit[] | null> {
  try {
    const url = `https://eodhd.com/api/search/${encodeURIComponent(
      q
    )}?api_token=${encodeURIComponent(key)}&fmt=json&limit=50`;
    const r = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return null;
    const arr = (await r.json()) as Record<string, unknown>[];
    if (!Array.isArray(arr)) return null;

    const out: SearchHit[] = [];
    for (const it of arr) {
      const code = str(it.Code);
      const name = str(it.Name);
      if (!code || !name) continue;
      const type = str(it.Type) ?? "";
      if (!isEquityType(type)) continue;
      const exCode = (str(it.Exchange) ?? "").toUpperCase();
      const suffix = exCode in EODHD_SUFFIX ? EODHD_SUFFIX[exCode] : "";
      const symbol = `${code}${suffix}`;
      const country = str(it.Country) ?? "";
      out.push({
        symbol,
        name,
        type,
        exchange: str(it.Exchange) ?? "",
        flag: COUNTRY_FLAG[country] ?? flagFor(symbol),
        country: COUNTRY_ISO[country] ?? countryFor(symbol),
        kind: kindOf(type, symbol),
      });
    }
    // Every candidate, unranked and untruncated. The caller merges this with
    // Yahoo's results and ranks the union — cutting to 8 here would throw away
    // the company before anything had a chance to sort it above the funds.
    return out;
  } catch {
    return null;
  }
}

// ─── Yahoo fallback ──────────────────────────────────────────────────────────
async function yahooSearch(q: string): Promise<SearchHit[]> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        q
      )}&quotesCount=12&newsCount=0&enableFuzzyQuery=false`,
      { headers: { "User-Agent": UA }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(7000) }
    );
    if (!r.ok) return [];
    const j = (await r.json()) as { quotes?: Record<string, unknown>[] };
    return (j?.quotes ?? [])
      .map((quote): SearchHit | null => {
        const symbol = str(quote.symbol);
        if (!symbol) return null;
        const name = str(quote.shortname) ?? str(quote.longname) ?? symbol;
        const type = str(quote.typeDisp) ?? str(quote.quoteType) ?? "";
        const exchange = str(quote.exchDisp) ?? str(quote.exchange) ?? "";
        return {
          symbol, name, type, exchange,
          flag: flagFor(symbol),
          country: countryFor(symbol),
          kind: kindOf(type, symbol),
        };
      })
      .filter((x): x is SearchHit => !!x && isEquityType(x.type))
      .sort((a, b) => rank(a, q) - rank(b, q))
      .slice(0, 8);
  } catch {
    return [];
  }
}

// Yahoo's SEARCH doesn't index bare BSE scrip codes, but its QUOTE endpoint does
// resolve `<code>.BO` to a name — so a user typing "523373" (or "BSE:523373")
// still finds the company even without EODHD.
async function resolveBseCode(code: string): Promise<SearchHit | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${code}.BO?range=1d&interval=1d`,
      { headers: { "User-Agent": UA }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { chart?: { result?: { meta?: Record<string, unknown> }[] } };
    const meta = j?.chart?.result?.[0]?.meta;
    const name = str(meta?.longName) ?? str(meta?.shortName);
    if (!name) return null;
    return {
      symbol: `${code}.BO`, name, type: "Equity", exchange: "BSE",
      flag: "🇮🇳", country: "IN", kind: "Stock",
    };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const raw = (new URL(req.url).searchParams.get("q") ?? "").trim();
  // Accept "BSE:523373" / "NSE:RELIANCE" / "NASDAQ:AAPL" — strip the exchange
  // prefix so both the code and the bare symbol resolve.
  const q = raw.replace(/^[A-Za-z]{2,6}:\s*/, "").trim();
  if (q.length < 1) return NextResponse.json({ results: [] });

  // Both sources, always, then rank the union.
  //
  // EODHD used to short-circuit this: if it returned anything at all, Yahoo was
  // never asked. That is backwards for a query like "kotak", where EODHD's
  // index is full of fund share classes — hundreds of them — and the bank fell
  // outside the results entirely. Yahoo's search is weak on Indian micro-caps
  // and strong on large companies, so the two cover each other's gaps; asking
  // only the first one to answer meant a user had to type "kotak bank" to find
  // Kotak Mahindra Bank.
  const key = process.env.EODHD_API_KEY;
  const numeric = /^\d{4,6}$/.test(q);
  const [eod, yahoo, bse] = await Promise.all([
    key ? eodhdSearch(q, key) : Promise.resolve(null),
    yahooSearch(q),
    numeric ? resolveBseCode(q) : Promise.resolve(null),
  ]);

  const merged: SearchHit[] = [];
  const seen = new Set<string>();
  // Yahoo first on ties: for a name every source knows, its symbol is the one
  // the rest of the app resolves most reliably.
  for (const hit of [...(bse ? [bse] : []), ...yahoo, ...(eod ?? [])]) {
    const dedupeKey = hit.symbol.toUpperCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    merged.push(hit);
  }
  merged.sort((a, b) => rank(a, q) - rank(b, q));
  return NextResponse.json({ results: merged.slice(0, 8) });
}
