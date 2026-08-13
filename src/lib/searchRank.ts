// Pure ranking/matching for symbol search, kept out of the route so it can be
// tested without reaching Yahoo or EODHD — neither of which is available from
// a test environment, which is exactly why the ordering bugs here kept
// shipping unverified.

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

// Split a query into the words that matter. Punctuation is dropped and
// one-letter fragments are ignored, so "HDFC Life Insurance Co." and
// "hdfc, insurance" reduce to comparable word sets.
export function tokensOf(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 2);
}

/** The individual words of a name, punctuation removed. */
function wordsOf(s: string): string[] {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
}

/**
 * Does one query word match one word of a listing's name?
 *
 * Substring matching is not enough, because exchanges abbreviate. NSE files
 * HDFC Life as "HDFC LIFE INS CO LTD" — so a search for "hdfc insurance"
 * failed the containment test on its own top result, and the widening pass
 * threw away the very company it had just fetched. INS, CO, LTD, IND, TECH,
 * MFG are the norm, not the exception.
 *
 * So a word matches if either side is a prefix of the other: the query's
 * "insurance" against the filing's "ins", or a typed "ins" against a written
 * "insurance". The abbreviation must be at least three characters, which stops
 * a two-letter fragment from matching most of the market.
 */
export function wordMatches(words: string[], token: string): boolean {
  return words.some(
    (w) => w === token || w.startsWith(token) || (w.length >= 3 && token.startsWith(w))
  );
}

/** Does this listing's name/symbol match EVERY word of the query, in any order? */
export function coversAllTokens(hit: SearchHit, tokens: string[]): boolean {
  const words = wordsOf(`${hit.name} ${hit.symbol}`);
  return tokens.every((t) => wordMatches(words, t));
}

// Rank so a search for a company finds the company.
//
// EODHD returns matches in its own order, which put six Morningstar fund codes
// above Kotak Mahindra Bank for the query "kotak". Nothing was sorting them;
// the route simply truncated whatever arrived. Ordering, most significant
// first: what the thing is, how squarely the name matches, and whether the
// symbol is one a human would recognise.
export function rank(hit: SearchHit, q: string): number {
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

  // 6. Word coverage, order-independent. Both upstream indexes match on
  //    phrases, so "HDFC insurance" scored nothing while "HDFC Life Insurance"
  //    scored well — the user had to guess the registered name word for word.
  //    What actually signals a match is how many of the query's words appear at
  //    all, wherever they appear.
  const toks = tokensOf(query);
  if (toks.length > 1) {
    const words = wordsOf(`${name} ${sym.toLowerCase()}`);
    const matched = toks.filter((t) => wordMatches(words, t)).length;
    score -= matched * 60;
    if (matched === toks.length) score -= 120; // every word present, any order
  }

  // 7. Shorter names are usually the parent company rather than a share class.
  score += Math.min(40, name.length / 4);

  return score;
}
