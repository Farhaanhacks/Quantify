// Which LISTING of a company to show, and how to group the rest under it.
//
// No imports, so scripts/test-listing-rank.mjs can compile and drive it.
//
// The bug this exists to fix: searching "nike" returned Stuttgart:NKE.SG and
// nothing else. Four separate faults lined up to produce that one row.
//
//   1. Nothing ranked exchanges. A German secondary venue and the New York
//      Stock Exchange were interchangeable, so the tie fell to an incidental
//      rule about name length: "Nike Inc." is one character shorter than
//      "NIKE, Inc." and therefore won.
//   2. Listings were de-duplicated on the ticker ROOT, so NKE and NKE.SG were
//      treated as the same string.
//   3. The de-duplication kept whichever row arrived first and DELETED the
//      others, so once Stuttgart won the tie, New York ceased to exist.
//   4. An "NYSE:" prefix was stripped from the query and thrown away rather
//      than read as the exchange the user had just named.
//
// So this module does four things: reads an exchange out of the query, ranks
// exchanges properly, groups listings by company identity rather than by ticker
// string, and keeps every listing instead of discarding the alternatives.

export type ListingClass = "ordinary" | "adr" | "otc";

export interface Listing {
  /** The symbol the rest of the app resolves, e.g. "NKE" or "NKE.SG". */
  symbol: string;
  /** As the provider returned it, before any suffix mapping. */
  providerSymbol?: string;
  name: string;
  type: string;
  exchange: string;
  /** Normalised exchange code, e.g. "NYSE", "NSE", "STU". */
  exchangeCode?: string;
  country?: string;
  flag?: string;
  currency?: string;
  kind?: "Stock" | "ETF" | "Fund" | "Index";
  /** A depositary receipt is NOT the ordinary share; see below. */
  isAdr?: boolean;
  /** ISIN where the provider supplies one. The only stable identifier we get. */
  isin?: string;
}

/**
 * Exchange preference, lower is better.
 *
 * Ordered as the desk would order it: the primary US venues, then the primary
 * venue of each home market, then the major global exchanges, then everything
 * that is a secondary quotation of a security listed somewhere else, then
 * OTC and the grey market.
 *
 * The German regional venues sit deliberately far down. Stuttgart, Berlin,
 * Munich, Hamburg and Düsseldorf quote thousands of foreign shares that are
 * primarily listed elsewhere; a Stuttgart line for an American company is a
 * secondary quotation of NYSE stock, and showing it as the company's listing
 * misstates where the security actually trades.
 */
const EXCHANGE_RANK: Record<string, number> = {
  // United States, primary
  NYSE: 10,
  NYQ: 10,
  NASDAQ: 12,
  NMS: 12,
  NGM: 12,
  NCM: 12,
  NASDAQGS: 12,
  "NYSE AMERICAN": 14,
  ASE: 14,
  AMEX: 14,
  "NYSE ARCA": 15,
  ARCA: 15,
  PCX: 15,
  BATS: 16,
  CBOE: 16,

  // Home primary markets
  NSE: 20,
  NSI: 20,
  BSE: 22,
  BOM: 22,
  LSE: 24,
  LON: 24,
  TSX: 25,
  TOR: 25,
  ASX: 26,
  TSE: 27,
  JPX: 27,
  HKEX: 28,
  HKG: 28,
  KRX: 29,
  KSC: 29,
  KOE: 29,
  SIX: 30,
  EBS: 30,
  TWSE: 31,
  TAI: 31,
  TPEX: 31,
  TWO: 31,
  SGX: 32,
  SES: 32,

  // Major global
  EURONEXT: 34,
  PAR: 34,
  AMS: 34,
  BRU: 34,
  LIS: 34,
  XETRA: 36,
  GER: 36,
  FRA: 38,
  MIL: 38,
  MCE: 38,
  STO: 38,
  CPH: 38,
  OSL: 38,
  HEL: 38,
  VIE: 40,
  SAO: 40,
  SHH: 40,
  SHZ: 40,
  MEX: 42,
  JNB: 42,
  TLV: 42,
  IST: 42,
  SAU: 42,

  // Secondary quotations of securities listed elsewhere
  STU: 60,
  BER: 60,
  MUN: 60,
  HAM: 60,
  DUS: 60,
  GETTEX: 60,
  BUD: 60,

  // Anything not on an exchange at all
  OTC: 90,
  PNK: 90,
  OTCQB: 90,
  OTCQX: 90,
  PINK: 90,
  GREY: 95,
};

const DEFAULT_RANK = 50;
/** A depositary receipt ranks below the ordinary share of the same company. */
const ADR_PENALTY = 40;

/** Words in an exchange name that identify it, when no code is supplied. */
const EXCHANGE_ALIASES: [RegExp, string][] = [
  [/\bnyse\s*arca\b|\barca\b/i, "NYSE ARCA"],
  [/\bnyse\s*american\b|\bamex\b|\bamerican\s+stock\b/i, "NYSE AMERICAN"],
  [/\bnyse\b|\bnew york stock\b/i, "NYSE"],
  [/\bnasdaq\b/i, "NASDAQ"],
  [/\bcboe\b|\bbats\b/i, "CBOE"],
  [/\bgrey\b|\bgray market\b/i, "GREY"],
  [/\botc\b|\bpink\b/i, "OTC"],
  [/\bnational stock exchange of india\b|\bnse\b/i, "NSE"],
  [/\bbombay\b|\bbse\b/i, "BSE"],
  [/\blondon\b|\blse\b/i, "LSE"],
  [/\bstuttgart\b/i, "STU"],
  [/\bberlin\b/i, "BER"],
  [/\bmunich\b|\bmunchen\b/i, "MUN"],
  [/\bhamburg\b/i, "HAM"],
  [/\bdusseldorf\b|\bdüsseldorf\b/i, "DUS"],
  [/\bgettex\b/i, "GETTEX"],
  [/\bxetra\b/i, "XETRA"],
  [/\bfrankfurt\b/i, "FRA"],
  [/\btoronto\b|\btsx\b/i, "TSX"],
  [/\baustralian\b|\basx\b/i, "ASX"],
  [/\bhong kong\b|\bhkex\b/i, "HKEX"],
  [/\btokyo\b|\bjpx\b/i, "TSE"],
  [/\bkorea\b|\bkrx\b|\bkosdaq\b/i, "KRX"],
  [/\btaiwan\b|\btwse\b/i, "TWSE"],
  [/\bsingapore\b|\bsgx\b/i, "SGX"],
  [/\bswiss\b|\bsix\b/i, "SIX"],
  [/\beuronext\b|\bparis\b|\bamsterdam\b|\bbrussels\b|\blisbon\b/i, "EURONEXT"],
  [/\bmilan\b|\bborsa\b/i, "MIL"],
  [/\bmadrid\b/i, "MCE"],
  [/\bstockholm\b/i, "STO"],
  [/\bcopenhagen\b/i, "CPH"],
  [/\boslo\b/i, "OSL"],
  [/\bhelsinki\b/i, "HEL"],
  [/\bvienna\b/i, "VIE"],
  [/\bsao paulo\b|\bb3\b|\bbovespa\b/i, "SAO"],
  [/\bshanghai\b/i, "SHH"],
  [/\bshenzhen\b/i, "SHZ"],
  [/\bthai\b|\bbangkok\b|\bset\b/i, "SET"],
];

/** Yahoo/EODHD suffix to exchange code, for rows that name no exchange. */
const SUFFIX_EXCHANGE: Record<string, string> = {
  NS: "NSE", BO: "BSE", L: "LSE", TO: "TSX", V: "TSXV", AX: "ASX",
  DE: "XETRA", F: "FRA", SG: "STU", BE: "BER", MU: "MUN", HM: "HAM",
  DU: "DUS", PA: "EURONEXT", AS: "EURONEXT", BR: "EURONEXT", LS: "EURONEXT",
  MI: "MIL", MC: "MCE", SW: "SIX", ST: "STO", OL: "OSL", CO: "CPH",
  HE: "HEL", VI: "VIE", IR: "ISE", HK: "HKEX", T: "TSE", SS: "SHH",
  SZ: "SHZ", KS: "KRX", KQ: "KRX", TW: "TWSE", TWO: "TPEX", SI: "SGX",
  BK: "SET", KL: "KLSE", JK: "IDX", SA: "SAO", MX: "MEX", NZ: "NZX",
};

const upper = (s?: string) => (s ?? "").toUpperCase().trim();

/** The exchange code for a listing, from its code, its name, or its suffix. */
export function exchangeCodeOf(listing: Listing): string {
  const explicit = upper(listing.exchangeCode);
  if (explicit && explicit in EXCHANGE_RANK) return explicit;

  const ex = listing.exchange ?? "";
  const exUp = upper(ex);
  if (exUp in EXCHANGE_RANK) return exUp;
  for (const [re, code] of EXCHANGE_ALIASES) if (re.test(ex)) return code;

  const dot = listing.symbol.lastIndexOf(".");
  if (dot > -1) {
    const suffix = upper(listing.symbol.slice(dot + 1));
    if (suffix in SUFFIX_EXCHANGE) return SUFFIX_EXCHANGE[suffix];
  }
  // No suffix at all is a US listing, and with nothing else to go on the
  // conservative read is the larger of the two US venues rather than NYSE:
  // claiming NYSE for an unknown row would let it outrank a row that actually
  // said NYSE.
  if (dot === -1 && exUp === "") return "NASDAQ";
  return explicit || exUp || "";
}

export function exchangeRank(listing: Listing): number {
  const code = exchangeCodeOf(listing);
  return code in EXCHANGE_RANK ? EXCHANGE_RANK[code] : DEFAULT_RANK;
}

/**
 * Is this a depositary receipt rather than the ordinary share?
 *
 * It matters twice over. A receipt trades in a different currency at a
 * different price, often for a different number of underlying shares, so
 * treating it as interchangeable with the ordinary would put the wrong price
 * on a company. And it is why an Indian company's NSE line should outrank its
 * New York line: HDFC Bank's ordinary shares are on the NSE, and HDB is a
 * receipt for them.
 *
 * Detection is by the provider's own words. There is no flag in either feed
 * that says "this is an ADR", so this reads the type and the name, and a
 * receipt that says nothing about itself will be missed. That limitation is
 * reported rather than papered over.
 */
export function isDepositaryReceipt(listing: Listing): boolean {
  if (listing.isAdr != null) return listing.isAdr;
  const hay = `${listing.type ?? ""} ${listing.name ?? ""}`;
  // "DR" is also written attached to the code, as in Thailand's "NIKE80_DR",
  // where a word boundary will not find it because the underscore is a word
  // character. So the separator is matched explicitly.
  return /\badr\b|\bgdr\b|\bads\b|depositary|depository/i.test(hay) ||
    /(^|[^A-Za-z])DRS?([^A-Za-z]|$)/.test(hay.toUpperCase());
}

export interface PreferenceContext {
  /** An exchange the user named, e.g. "NYSE" from "NYSE:NKE". */
  exchangeHint?: string;
}

/**
 * How much this listing wants to be the one shown. Lower wins.
 *
 * An exchange the user typed beats everything: "NYSE:NKE" is not a hint to be
 * weighed against name length, it is an instruction.
 */
export function listingPreference(listing: Listing, ctx: PreferenceContext = {}): number {
  const hint = upper(ctx.exchangeHint);
  let score = exchangeRank(listing);
  if (isDepositaryReceipt(listing)) score += ADR_PENALTY;
  if (hint && exchangeCodeOf(listing) === hint) score -= 1000;
  return score;
}

export interface ParsedQuery {
  /** The query with any exchange prefix removed. */
  q: string;
  /** The exchange the prefix named, normalised, when it named one. */
  exchangeHint?: string;
  /** The prefix as typed, kept so the UI can echo it. */
  rawPrefix?: string;
}

/**
 * Read "NYSE:NKE" as an exchange and a symbol.
 *
 * The prefix used to be stripped and discarded, which turned the most explicit
 * instruction a user can give into no instruction at all. A prefix that names
 * no exchange we know is still stripped, since it is more likely a vendor
 * prefix than part of the name.
 */
export function parseSearchQuery(raw: string): ParsedQuery {
  const trimmed = (raw ?? "").trim();
  const m = trimmed.match(/^([A-Za-z][A-Za-z.\s]{1,12}):\s*(.+)$/);
  if (!m) return { q: trimmed };
  const prefix = m[1].trim();
  const rest = m[2].trim();
  if (!rest) return { q: trimmed };

  const asCode = upper(prefix).replace(/\./g, "");
  let hint: string | undefined;
  if (asCode in EXCHANGE_RANK) hint = asCode;
  else {
    for (const [re, code] of EXCHANGE_ALIASES) {
      if (re.test(prefix)) {
        hint = code;
        break;
      }
    }
  }
  return { q: rest, exchangeHint: hint, rawPrefix: prefix };
}

// ── Company identity ────────────────────────────────────────────────────────

const CORPORATE_SUFFIX =
  /\b(inc|incorporated|corp|corporation|co|company|ltd|limited|plc|ag|nv|sa|se|spa|ab|as|oyj|kk|pte|pvt|holdings?|group|the)\b/gi;

/**
 * The share class a name declares, or "" when it declares none.
 *
 * NOT part of the identity key. Nike's NYSE line is Class B stock and says
 * nothing about it, while London files the same security as "NIKE INC NIKE ORD
 * CLASS B"; keying on the class therefore split one security into two. A class
 * only separates listings when two of them name DIFFERENT classes, which is a
 * comparison and not a key, so it happens during grouping instead.
 */
export function shareClassOf(name: string): string {
  const m = name.match(/\bclass\s+([a-z])\b/i) ?? name.match(/\bseries\s+([a-z])\b/i);
  return m ? m[1].toUpperCase() : "";
}

/** A company name reduced to the part that identifies the company. */
export function normaliseCompanyName(name: string): string {
  const cleaned = (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(CORPORATE_SUFFIX, " ")
    .replace(/\b(adr|gdr|ads|dr|drs|sponsored|unsponsored|depositary|depository|receipts?|ord|ordinary|shares?|stock)\b/gi, " ")
    .replace(/\bclass\s+[a-z]\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  // Repeated words carry no information and exchanges repeat them constantly:
  // London files Nike as "NIKE INC NIKE ORD CLASS B", which is the company's
  // name twice with the class on the end. De-duplicating in place, rather than
  // sorting, keeps the order a reader would recognise.
  const seen = new Set<string>();
  const words: string[] = [];
  for (const w of cleaned.split(" ")) {
    if (!w) continue;
    // A code with a numeric tail is the same word: "nike80" is the Thai
    // depositary receipt's code for nike, not a different company.
    const base = /^[a-z]{3,}\d{1,4}$/.test(w) ? w.replace(/\d+$/, "") : w;
    if (seen.has(base)) continue;
    seen.add(base);
    words.push(base);
  }
  return words.join(" ");
}

/**
 * The key that decides which listings are the same company.
 *
 * ISIN when the provider gives one, because it is the only stable identifier
 * either feed carries. Neither returns LEI, CIK or FIGI from a search, so the
 * fallback is a normalised name, which is weaker and is why the grouping step
 * below refuses to merge two listings on the SAME exchange no matter how alike
 * their names are.
 *
 * Never the ticker root. That is what merged NKE with NKE.SG and, worse, would
 * merge any two companies that happen to share a ticker on different markets.
 */
export function companyIdentity(listing: Listing): string {
  if (listing.isin) return `isin:${upper(listing.isin)}`;
  const base = normaliseCompanyName(listing.name) || upper(listing.symbol);
  return `name:${base}|${listing.kind ?? "Stock"}`;
}

export interface CompanyGroup {
  id: string;
  name: string;
  kind: Listing["kind"];
  /** The listing shown on the main row. */
  preferred: Listing;
  /** Every listing, preferred first, then by preference. */
  listings: Listing[];
}

/**
 * Group listings by company, keeping all of them.
 *
 * Two rules, and the second is the interesting one.
 *
 * Listings are bucketed by company identity. Then any bucket holding two
 * listings on the SAME exchange is split apart, because one company has one
 * listing per security per exchange: two rows on NASDAQ are two different
 * securities however identical their names look. That is what keeps GOOG and
 * GOOGL separate, since Alphabet's Class A and Class C carry the same company
 * name and the same exchange and differ only in the ticker.
 */
export function groupListings(listings: Listing[], ctx: PreferenceContext = {}): CompanyGroup[] {
  const buckets = new Map<string, Listing[]>();
  const order: string[] = [];
  for (const l of listings) {
    const id = companyIdentity(l);
    if (!buckets.has(id)) {
      buckets.set(id, []);
      order.push(id);
    }
    buckets.get(id)!.push(l);
  }

  // A depositary receipt's name is a mangled version of the underlying's, and
  // no feed gives the two the same identifier. Thailand files Nike as
  // "NIKE80_DR NIKE#KTB", which normalises to "nike ktb" and would otherwise be
  // its own company.
  //
  // So ONE loose merge is allowed, and only in this direction: a group that is
  // entirely depositary receipts may join a group whose whole normalised name
  // is that receipt's first word. Nothing else merges loosely, because a first
  // word is a weak identifier and "apple" would otherwise fold Apple
  // Hospitality into Apple. A receipt is a claim on another company's shares by
  // definition, so it is the one case where the weaker signal is still true.
  const wholeNames = new Map<string, string>();
  for (const [id, members] of buckets) {
    const norm = normaliseCompanyName(members[0].name);
    if (norm && !norm.includes(" ") && !wholeNames.has(norm)) wholeNames.set(norm, id);
  }
  for (const id of [...order]) {
    const members = buckets.get(id);
    if (!members || !members.length) continue;
    if (!members.every((m) => isDepositaryReceipt(m))) continue;
    const first = normaliseCompanyName(members[0].name).split(" ")[0];
    const host = first ? wholeNames.get(first) : undefined;
    if (!host || host === id) continue;
    buckets.get(host)!.push(...members);
    buckets.set(id, []);
  }

  const groups: CompanyGroup[] = [];
  for (const id of order) {
    const members = buckets.get(id)!;
    if (!members.length) continue; // merged away above
    // Split where two members share an exchange: they cannot be the same
    // security, so they cannot be one row.
    const byExchange = new Map<string, Listing[]>();
    for (const l of members) {
      const code = exchangeCodeOf(l);
      if (!byExchange.has(code)) byExchange.set(code, []);
      byExchange.get(code)!.push(l);
    }
    const widest = Math.max(...Array.from(byExchange.values(), (v) => v.length));
    // Two members naming DIFFERENT share classes are different securities, even
    // on different exchanges. One naming a class and one saying nothing is the
    // ordinary case of an exchange being more verbose than another.
    const declared = new Set(members.map((m) => shareClassOf(m.name)).filter(Boolean));
    const classConflict = declared.size > 1;

    const parts: Listing[][] =
      widest <= 1 && !classConflict
        ? [members]
        : (() => {
            // One sub-group per distinct ticker root, so the duplicated
            // exchange, or the conflicting class, lands in its own group.
            const byRoot = new Map<string, Listing[]>();
            const rootOrder: string[] = [];
            for (const l of members) {
              const root = upper(l.symbol).replace(/\.[A-Z0-9]{1,4}$/, "");
              if (!byRoot.has(root)) {
                byRoot.set(root, []);
                rootOrder.push(root);
              }
              byRoot.get(root)!.push(l);
            }
            return rootOrder.map((r) => byRoot.get(r)!);
          })();

    for (const part of parts) {
      const sorted = part
        .slice()
        .sort((a, b) => listingPreference(a, ctx) - listingPreference(b, ctx));
      const preferred = sorted[0];
      groups.push({
        id: parts.length > 1 ? `${id}|${upper(preferred.symbol)}` : id,
        name: preferred.name,
        kind: preferred.kind,
        preferred,
        listings: sorted,
      });
    }
  }
  return groups;
}
