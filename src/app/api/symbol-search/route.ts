import { NextResponse } from "next/server";
import { COUNTRY_ISO, countryForSymbol } from "@/lib/listingCountry";
import { type SearchHit, tokensOf, coversAllTokens, rank } from "@/lib/searchRank";
import { searchIndia } from "@/lib/indiaCompanies";
import {
  parseSearchQuery,
  groupListings,
  exchangeCodeOf,
  isDepositaryReceipt,
  listingPreference,
  type Listing,
} from "@/lib/listingRank";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

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
        // Kept rather than discarded: the provider's own symbol, the currency
        // the listing trades in, and the ISIN where EODHD supplies one. The
        // ISIN is the only stable identifier either feed carries, and it is
        // what lets two listings be recognised as one company without guessing
        // from the ticker.
        providerSymbol: `${code}${exCode ? `.${exCode}` : ""}`,
        currency: str(it.Currency),
        isin: str(it.ISIN),
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
async function yahooSearch(q: string, count = 12): Promise<SearchHit[]> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        q
      )}&quotesCount=${count}&newsCount=0&enableFuzzyQuery=false`,
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
          providerSymbol: symbol,
          exchangeCode: str(quote.exchange),
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
  // "NYSE:NKE" names an exchange, and that is an instruction rather than noise.
  // The prefix used to be stripped and thrown away, so the most explicit thing
  // a user can say about which listing they want had no effect at all.
  const { q, exchangeHint } = parseSearchQuery(raw);
  if (q.length < 1) return NextResponse.json({ results: [], companies: [] });

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
  // Multi-word queries are answered WORD BY WORD, always — not as a fallback.
  //
  // Both upstream indexes match roughly left to right, so "hdfc insurance"
  // returns nothing while "hdfc life" returns the company. Treating the phrase
  // as the primary query and per-word search as a rescue meant the rescue was
  // gated on the phrase having nearly worked, and that gate is unknowable from
  // here: whether Yahoo happens to return HDFC Life inside its top handful for
  // "hdfc" is not something this code can depend on.
  //
  // So every word is searched on its own, in parallel, alongside the phrase.
  // A row is kept when it matches EVERY word, in any order, comparing word by
  // word so an exchange abbreviation still counts ("insurance" ↔ "INS"). Word
  // order stops mattering because the query is never sent as a phrase to
  // something that cares about order.
  const tokens = tokensOf(q).slice(0, 4); // bound the fan-out

  // The LOCAL Indian list first, for any query.
  //
  // This is the retrieval fix. Every other source is asked a question and
  // returns the rows it feels like returning; this one is held in full, so a
  // company either carries the query's words or it does not, and no ranking
  // decision made elsewhere can hide it. Yahoo and EODHD stay for global
  // coverage, which the NSE list obviously does not have.
  const local = await searchIndia(tokens.length ? tokens : tokensOf(q));
  for (const hit of local) {
    const dedupeKey = hit.symbol.toUpperCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    merged.push(hit);
  }

  if (tokens.length > 1) {
    // Ask DEEPLY on each word. A single word is a broad query — "hdfc" matches
    // a bank, an AMC, an insurer and a dozen funds — so the company being
    // looked for is often outside the first handful. Yahoo's default of twelve
    // rows is why searching "hdfc" surfaced HDFC Bank twice and HDFC Life not
    // at all; the row existed, we just never asked for enough of them.
    const perWord = await Promise.all(
      tokens.flatMap((word) => [
        yahooSearch(word, 40),
        key ? eodhdSearch(word, key) : Promise.resolve(null),
      ])
    );
    const candidates: SearchHit[] = [];
    for (const hit of perWord.flat()) {
      if (!hit) continue;
      const dedupeKey = hit.symbol.toUpperCase();
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      candidates.push(hit);
    }

    // EVERY word, or the row does not appear.
    //
    // There is no "closest match" consolation here, and there was: a previous
    // version offered rows matching the most words when none matched all of
    // them, which answered "hdfc insurance" with Zurich, UNIQA, Goosehead and
    // The Hartford. Not one of them is an HDFC company. A list of plausible
    // wrong answers is worse than an empty one, because the reader has to
    // check each before concluding the search failed.
    for (const hit of candidates) {
      if (coversAllTokens(hit, tokens)) merged.push(hit);
    }
  }

  merged.sort((a, b) => rank(a, q) - rank(b, q));

  // One row per COMPANY, with every listing kept under it.
  //
  // This used to collapse to one row per ticker ROOT and delete the rest, so
  // NKE and NKE.SG were the same string and whichever arrived first won. That
  // is how a search for Nike returned a Stuttgart quotation and no New York
  // listing at all: nothing ranked the venues, the tie fell to name length, and
  // the loser was discarded rather than kept.
  //
  // Now the listings are grouped by company identity, ordered within the group
  // by which venue the security actually belongs to, and all of them survive.
  const groups = groupListings(merged as Listing[], { exchangeHint });

  // Companies are ordered by how well the QUERY matched, using the ranking that
  // was already there, but read from the listing the group settled on rather
  // than from whichever row happened to arrive first.
  groups.sort((a, b) => {
    const byQuery = rank(a.preferred as SearchHit, q) - rank(b.preferred as SearchHit, q);
    if (byQuery !== 0) return byQuery;
    return listingPreference(a.preferred, { exchangeHint }) - listingPreference(b.preferred, { exchangeHint });
  });

  const shaped = groups.slice(0, 8).map((g) => {
    const listing = (l: Listing) => ({
      symbol: l.symbol,
      providerSymbol: l.providerSymbol ?? l.symbol,
      name: l.name,
      exchange: l.exchange,
      exchangeCode: exchangeCodeOf(l),
      country: l.country,
      flag: l.flag,
      // Currency travels with the LISTING. An ADR in dollars and the ordinary
      // share in rupees are different prices of different securities, and
      // sharing one currency between them would misstate both.
      currency: l.currency,
      isAdr: isDepositaryReceipt(l),
      kind: l.kind,
      type: l.type,
      isin: l.isin,
      // Where the ISSUER is, versus where this LINE trades. The pair is what
      // decides which listing a company defaults to, and the client shows the
      // difference rather than making the reader infer it from a flag.
      issuerCountry: l.issuerCountry,
      listingCountry: l.listingCountry,
      securityType: l.securityType,
      isHomePrimary: l.isHomePrimary,
      underlyingSymbol: l.underlyingSymbol,
    });
    return {
      id: g.id,
      name: g.name,
      kind: g.kind,
      issuerCountry: g.issuerCountry,
      preferred: listing(g.preferred),
      listings: g.listings.map(listing),
      // Everything EXCEPT the listing on the main row. The disclosure shows
      // alternatives, so repeating the main listing inside it — and then
      // labelling that repeat "preferred" — was saying the same thing twice.
      alternatives: g.alternatives.map(listing),
      listingCount: g.listings.length,
    };
  });

  return NextResponse.json({
    // The flat list stays, and stays first: it is what every existing caller
    // reads, and it now carries the right listing per company.
    results: shaped.map((c) => ({
      ...c.preferred,
      // The alternatives, so a caller that wants them does not need a second
      // request, and one that does not can ignore the field.
      listings: c.listings,
      alternatives: c.alternatives,
      listingCount: c.listingCount,
    })),
    companies: shaped,
    exchangeHint,
  });
}
