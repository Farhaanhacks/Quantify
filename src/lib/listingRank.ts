// Which LISTING of a company to show, and how to group the rest under it.
//
// No imports, so scripts/test-listing-rank.mjs can compile and drive it.
//
// TWO bugs have been fixed here, and the second was caused by the fix to the
// first.
//
// The original: searching "nike" returned Stuttgart:NKE.SG and nothing else,
// because nothing ranked exchanges, listings were de-duplicated on the ticker
// root, the de-duplication deleted the losers, and an "NYSE:" prefix was
// thrown away rather than read as an instruction.
//
// The overcorrection: the fix ranked NYSE first unconditionally, so searching
// "hdfc" returned NYSE:HDB — a New York depositary receipt — as HDFC Bank's
// listing. HDB is a claim on shares that trade in Mumbai, in a different
// currency, at a different price, for a different number of underlying shares.
// Preferring it is the same class of error as preferring Stuttgart for Nike:
// the venue was ranked without asking whose home market it is.
//
// The rule is therefore neither "NYSE first" nor "home market first" but:
//
//     the issuer's home-market primary ORDINARY share,
//     unless the user named an exchange, in which case obey them.
//
// NYSE comes first for Nike because Nike is American. NSE comes first for HDFC
// Bank because HDFC Bank is Indian. One rule, two answers.
//
// The hard part is that no search feed reliably says which. Yahoo returns HDB
// as plain "EQUITY" on "NYQ" with the name "HDFC Bank Limited" and no ADR
// marker anywhere, so text matching cannot see it. What follows derives the
// issuer's country from the SET of listings instead, then reads each listing
// against it. See inferIssuerCountry for how, and for what it cannot do.

export type ListingClass = "ordinary" | "adr" | "otc";

/** What a listing actually is, once the derivation below has run. */
export type SecurityType = "ordinary" | "depositary-receipt" | "unknown";

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
  /** ISO country of the LISTING — where this line trades. */
  country?: string;
  flag?: string;
  currency?: string;
  kind?: "Stock" | "ETF" | "Fund" | "Index";
  /** A depositary receipt is NOT the ordinary share; see below. */
  isAdr?: boolean;
  /** ISIN where the provider supplies one. The only stable identifier we get. */
  isin?: string;

  // ── Derived by groupListings, or supplied by a provider that knows ────────
  /** ISO country the ISSUER is domiciled in. Same for every listing of a company. */
  issuerCountry?: string;
  /** ISO country this particular line trades in. */
  listingCountry?: string;
  /** Ordinary share, depositary receipt, or not established. */
  securityType?: SecurityType;
  /** Text or provider says outright that this is a receipt. */
  isDepositaryReceipt?: boolean;
  /** The issuer's own market, on a venue that is primary there. */
  isHomePrimary?: boolean;
  /** For a receipt: the ordinary share it is a claim on, when we can see it. */
  underlyingSymbol?: string;
}

/**
 * Venue preference WITHIN a tier, lower is better.
 *
 * This no longer decides which listing wins on its own — the tier does, and the
 * tier is computed against the issuer's home market. What this orders is a
 * choice between two venues of the same standing: NSE ahead of BSE for an
 * Indian company, NYSE ahead of NASDAQ for an American one.
 *
 * The German regional venues sit deliberately far down. Stuttgart, Berlin,
 * Munich, Hamburg and Düsseldorf quote thousands of foreign shares primarily
 * listed elsewhere; a Stuttgart line for an American company is a secondary
 * quotation of NYSE stock.
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
  TSXV: 26,
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
  NZX: 33,
  SET: 33,
  KLSE: 33,
  IDX: 33,
  ISE: 33,

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
/** At or above this, a venue is a secondary quotation of stock listed elsewhere. */
const SECONDARY_QUOTE_RANK = 60;
/** At or above this, the security is not on an exchange at all. */
const OFF_EXCHANGE_RANK = 90;

/** The country each venue sits in. */
const EXCHANGE_COUNTRY: Record<string, string> = {
  NYSE: "US", NYQ: "US", NASDAQ: "US", NMS: "US", NGM: "US", NCM: "US",
  NASDAQGS: "US", "NYSE AMERICAN": "US", ASE: "US", AMEX: "US",
  "NYSE ARCA": "US", ARCA: "US", PCX: "US", BATS: "US", CBOE: "US",
  OTC: "US", PNK: "US", OTCQB: "US", OTCQX: "US", PINK: "US", GREY: "US",
  NSE: "IN", NSI: "IN", BSE: "IN", BOM: "IN",
  LSE: "GB", LON: "GB",
  TSX: "CA", TOR: "CA", TSXV: "CA",
  ASX: "AU", NZX: "NZ",
  TSE: "JP", JPX: "JP",
  HKEX: "HK", HKG: "HK",
  KRX: "KR", KSC: "KR", KOE: "KR",
  SIX: "CH", EBS: "CH",
  TWSE: "TW", TAI: "TW", TPEX: "TW", TWO: "TW",
  SGX: "SG", SES: "SG",
  SET: "TH", KLSE: "MY", IDX: "ID", ISE: "IE",
  EURONEXT: "EU", PAR: "FR", AMS: "NL", BRU: "BE", LIS: "PT",
  XETRA: "DE", GER: "DE", FRA: "DE",
  STU: "DE", BER: "DE", MUN: "DE", HAM: "DE", DUS: "DE", GETTEX: "DE",
  MIL: "IT", MCE: "ES", STO: "SE", CPH: "DK", OSL: "NO", HEL: "FI",
  VIE: "AT", BUD: "HU", SAO: "BR", SHH: "CN", SHZ: "CN",
  MEX: "MX", JNB: "ZA", TLV: "IL", IST: "TR", SAU: "SA",
};

/**
 * How strongly a listing on this venue implies the ISSUER is domiciled there.
 *
 * This is the number that separates HDFC Bank from Nike without either being
 * hardcoded. NSE and BSE list Indian-incorporated issuers and essentially
 * nothing else, so an NSE line is near-proof of an Indian issuer: weight 1.
 * NYSE lists American companies AND the depositary receipts of the whole
 * world, so a NYSE line proves much less: weight 0.5. Stuttgart is almost
 * entirely foreign secondary quotations, so a Stuttgart line says close to
 * nothing about domicile: weight 0.05.
 *
 * HDFC Bank therefore resolves to India (NSE 1.0 beats NYSE 0.5) and Nike to
 * the United States (NYSE 0.5 beats Stuttgart 0.05), from the same comparison.
 *
 * These are judgements about listing regimes, not measurements, and they are
 * wrong at the edges — a genuinely dual-primary issuer will be assigned one
 * home and the other listing demoted a tier. The consequence is an ordering,
 * never a price or a currency, both of which stay attached to their own line.
 */
const DOMESTIC_WEIGHT: Record<string, number> = {
  // Markets that list domestic issuers and little else.
  NSE: 1, NSI: 1, BSE: 1, BOM: 1,
  TWSE: 1, TAI: 1, TPEX: 1, TWO: 1,
  KRX: 1, KSC: 1, KOE: 1,
  SHH: 1, SHZ: 1,
  IDX: 1, KLSE: 1, SET: 0.9, SAU: 1, IST: 0.9,
  TSE: 0.95, JPX: 0.95,
  SAO: 0.9, MEX: 0.8, JNB: 0.8, TLV: 0.8,
  ASX: 0.8, NZX: 0.9,
  SIX: 0.8, EBS: 0.8,
  MIL: 0.8, MCE: 0.8, STO: 0.8, CPH: 0.8, OSL: 0.8, HEL: 0.8, VIE: 0.8,
  // Home markets that also host a meaningful number of foreign issuers.
  // Xetra is the German primary book; the Frankfurt floor is mostly a
  // quotation venue for shares listed elsewhere, so it says far less about
  // domicile than its rank suggests.
  XETRA: 0.7, GER: 0.7, FRA: 0.15,
  EURONEXT: 0.6, PAR: 0.7, AMS: 0.6, BRU: 0.7, LIS: 0.7,
  TSX: 0.7, TOR: 0.7, TSXV: 0.7,
  HKEX: 0.6, HKG: 0.6, SGX: 0.6, ISE: 0.6,
  // Markets that host the world's depositary receipts alongside their own.
  NYSE: 0.5, NYQ: 0.5, NASDAQ: 0.5, NMS: 0.5, NGM: 0.5, NCM: 0.5,
  NASDAQGS: 0.5, "NYSE AMERICAN": 0.5, ASE: 0.5, AMEX: 0.5,
  LSE: 0.5, LON: 0.5,
  // Secondary quotation venues say essentially nothing about domicile.
  STU: 0.05, BER: 0.05, MUN: 0.05, HAM: 0.05, DUS: 0.05, GETTEX: 0.05,
  BUD: 0.05,
  OTC: 0.05, PNK: 0.05, OTCQB: 0.05, OTCQX: 0.05, PINK: 0.05, GREY: 0.05,
};

const DEFAULT_DOMESTIC_WEIGHT = 0.4;

/**
 * Countries whose companies routinely list ORDINARY shares directly in the US,
 * rather than through a depositary receipt.
 *
 * Without this, the derivation below would label Shopify's New York line an ADR
 * because its issuer is Canadian. Canadian and Israeli issuers, and the
 * offshore holding companies used by much of the technology sector, list
 * ordinary shares on US venues as a matter of course.
 *
 * The list is a limitation, honestly: it is the set of exceptions we know
 * about, so an unlisted exception will be labelled a receipt when it is not.
 * The ordering consequence is the same either way — a foreign listing ranks
 * below the home one whichever of the two it is — so the cost of a miss is a
 * wrong chip in the dropdown, not a wrong price.
 */
const DIRECT_US_LISTING_COUNTRIES = new Set(["CA", "IL", "BM", "KY", "VG", "IE", "JE", "GG", "MH", "PA"]);

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

/** Euronext is one book across several countries; the suffix says which. */
const SUFFIX_COUNTRY: Record<string, string> = {
  PA: "FR", AS: "NL", BR: "BE", LS: "PT",
};

/**
 * Vendor codes that name a venue we already know by another name.
 *
 * Yahoo returns the New York Stock Exchange as "NYQ" and NASDAQ as "NMS". A
 * user types "NYSE:HDB". Without this map those are two different exchanges and
 * the most explicit instruction the search box accepts is silently ignored,
 * which is how "NYSE:HDB" opened the Mumbai listing instead.
 */
const CANONICAL_CODE: Record<string, string> = {
  NYQ: "NYSE",
  NMS: "NASDAQ", NGM: "NASDAQ", NCM: "NASDAQ", NASDAQGS: "NASDAQ",
  ASE: "NYSE AMERICAN", AMEX: "NYSE AMERICAN",
  ARCA: "NYSE ARCA", PCX: "NYSE ARCA",
  BATS: "CBOE",
  NSI: "NSE", BOM: "BSE", LON: "LSE", TOR: "TSX",
  JPX: "TSE", HKG: "HKEX", KSC: "KRX", KOE: "KRX",
  EBS: "SIX", TAI: "TWSE", TWO: "TPEX", SES: "SGX", GER: "XETRA",
  PNK: "OTC", OTCQB: "OTC", OTCQX: "OTC", PINK: "OTC",
};

const canonical = (code: string) => CANONICAL_CODE[code] ?? code;

const upper = (s?: string) => (s ?? "").toUpperCase().trim();

/** The exchange code for a listing, from its code, its name, or its suffix. */
export function exchangeCodeOf(listing: Listing): string {
  const explicit = upper(listing.exchangeCode);
  if (explicit && explicit in EXCHANGE_RANK) return canonical(explicit);

  const ex = listing.exchange ?? "";
  const exUp = upper(ex);
  if (exUp in EXCHANGE_RANK) return canonical(exUp);
  for (const [re, code] of EXCHANGE_ALIASES) if (re.test(ex)) return canonical(code);

  const dot = listing.symbol.lastIndexOf(".");
  if (dot > -1) {
    const suffix = upper(listing.symbol.slice(dot + 1));
    if (suffix in SUFFIX_EXCHANGE) return canonical(SUFFIX_EXCHANGE[suffix]);
  }
  // No suffix at all is a US listing, and with nothing else to go on the
  // conservative read is the larger of the two US venues rather than NYSE:
  // claiming NYSE for an unknown row would let it outrank a row that actually
  // said NYSE.
  if (dot === -1 && exUp === "") return "NASDAQ";
  return canonical(explicit || exUp) || "";
}

export function exchangeRank(listing: Listing): number {
  const code = exchangeCodeOf(listing);
  return code in EXCHANGE_RANK ? EXCHANGE_RANK[code] : DEFAULT_RANK;
}

/** Where this particular line trades. */
export function listingCountryOf(listing: Listing): string | undefined {
  const explicit = upper(listing.listingCountry) || upper(listing.country);
  if (explicit.length === 2) return explicit;

  const dot = listing.symbol.lastIndexOf(".");
  if (dot > -1) {
    const suffix = upper(listing.symbol.slice(dot + 1));
    if (suffix in SUFFIX_COUNTRY) return SUFFIX_COUNTRY[suffix];
  }
  const code = exchangeCodeOf(listing);
  const country = EXCHANGE_COUNTRY[code];
  // "EU" is Euronext with no suffix to disambiguate it. It is a real answer for
  // ranking (the listing is European) but not an ISO country, so it is only
  // returned when nothing better exists.
  return country;
}

/**
 * Does the provider, or the listing's own text, SAY this is a receipt?
 *
 * Separate from the derived answer below, because the two have different
 * strengths and the derivation must not feed on itself: the issuer's country is
 * inferred from the listings, and if that inference discounted listings it had
 * already guessed were receipts, it would confirm whatever it guessed first.
 */
export function declaredDepositaryReceipt(listing: Listing): boolean {
  if (listing.isAdr != null) return listing.isAdr;
  const hay = `${listing.type ?? ""} ${listing.name ?? ""}`;
  // "DR" is also written attached to the code, as in Thailand's "NIKE80_DR",
  // where a word boundary will not find it because the underscore is a word
  // character. So the separator is matched explicitly.
  return /\badr\b|\bgdr\b|\bads\b|depositary|depository/i.test(hay) ||
    /(^|[^A-Za-z])DRS?([^A-Za-z]|$)/.test(hay.toUpperCase());
}

/**
 * Is this a depositary receipt rather than the ordinary share?
 *
 * It matters twice over. A receipt trades in a different currency at a
 * different price, often for a different number of underlying shares, so
 * treating it as interchangeable with the ordinary would put the wrong price on
 * a company. And it is why an Indian company's NSE line must outrank its New
 * York line: HDFC Bank's ordinary shares are on the NSE, and HDB is a receipt
 * for them.
 *
 * Two ways to know. The provider's own words, which are reliable when present
 * and frequently absent — Yahoo returns HDB as an unremarkable "EQUITY". And
 * the derivation: a US-listed line belonging to an issuer domiciled outside the
 * US, from a country that does not list ordinary shares in New York directly,
 * is an ADR. That second test is what catches HDB, and it needs the issuer's
 * country, which is why groupListings annotates the listings before ranking
 * them.
 */
export function isDepositaryReceipt(listing: Listing): boolean {
  if (declaredDepositaryReceipt(listing)) return true;
  if (listing.securityType === "depositary-receipt") return true;
  if (listing.securityType === "ordinary") return false;
  return derivedDepositaryReceipt(listing, listing.issuerCountry);
}

function derivedDepositaryReceipt(listing: Listing, issuerCountry?: string): boolean {
  const issuer = upper(issuerCountry);
  if (!issuer) return false;
  const lc = listingCountryOf(listing);
  if (!lc || lc === issuer) return false;
  // Only the two markets that actually run depositary programmes at scale, and
  // only where the issuer's own jurisdiction does not list there directly.
  // A German secondary quotation of an American share is not a receipt; it is
  // the same security quoted somewhere else, and calling it an ADR would be
  // both wrong and, since receipts rank ABOVE secondary quotations, a promotion
  // it has not earned.
  const code = exchangeCodeOf(listing);
  const rank = code in EXCHANGE_RANK ? EXCHANGE_RANK[code] : DEFAULT_RANK;
  if (rank >= SECONDARY_QUOTE_RANK) return false;
  // The United States only. London does host GDRs, but they carry "GDR" in
  // their names and are caught by the declared test above; the far commoner
  // London line for a foreign company is an ordinary share quoted on the
  // international order book. Nike's 0QZ6.L is one of those, and calling it a
  // receipt would both misdescribe it and, since receipts rank below foreign
  // ordinaries, move it for the wrong reason.
  if (lc === "US") return !DIRECT_US_LISTING_COUNTRIES.has(issuer);
  return false;
}

/**
 * Where the ISSUER is domiciled, inferred from the set of its listings.
 *
 * ISIN first, and it is not a guess: the first two characters of an ISIN are
 * the issuing country, so "INE040A01034" is India and "US6541061031" is the
 * United States, whatever the listing says about itself.
 *
 * Failing that, each listing votes for its own country with the weight of its
 * venue (see DOMESTIC_WEIGHT). The strongest vote wins; equal votes are settled
 * by venue rank. That is the whole mechanism, and it is what makes one rule
 * produce NYSE for Nike and NSE for HDFC Bank:
 *
 *   Nike     NYSE 0.50 → US ┃ Stuttgart 0.05 → DE   ⇒ US
 *   HDFC     NSE  1.00 → IN ┃ NYSE      0.50 → US   ⇒ IN
 *
 * Declared receipts do not vote. A receipt is a claim on shares domiciled
 * elsewhere by definition, so its country is the one place it cannot be
 * evidence for.
 *
 * Returns undefined when nothing votes, and callers must handle that: an
 * unknown domicile is a real outcome, not a reason to assume the United States.
 */
export function inferIssuerCountry(listings: Listing[]): string | undefined {
  for (const l of listings) {
    const isin = upper(l.isin);
    if (/^[A-Z]{2}[A-Z0-9]{9}\d$/.test(isin)) {
      const cc = isin.slice(0, 2);
      // XS is Euroclear/Clearstream, not a country.
      if (cc !== "XS" && cc !== "EU") return cc;
    }
    const declared = upper(l.issuerCountry);
    if (declared.length === 2) return declared;
  }

  let best: { country: string; weight: number; rank: number } | undefined;
  for (const l of listings) {
    if (declaredDepositaryReceipt(l)) continue;
    const country = listingCountryOf(l);
    if (!country || country.length !== 2 || country === "EU") continue;
    const code = exchangeCodeOf(l);
    const weight = code in DOMESTIC_WEIGHT ? DOMESTIC_WEIGHT[code] : DEFAULT_DOMESTIC_WEIGHT;
    const rank = code in EXCHANGE_RANK ? EXCHANGE_RANK[code] : DEFAULT_RANK;
    if (!best || weight > best.weight || (weight === best.weight && rank < best.rank)) {
      best = { country, weight, rank };
    }
  }
  return best?.country;
}

/** The issuer's own market, on a venue that is primary there. */
export function isHomePrimaryListing(listing: Listing, issuerCountry?: string): boolean {
  const issuer = upper(issuerCountry) || upper(listing.issuerCountry);
  if (!issuer) return false;
  if (isDepositaryReceipt({ ...listing, issuerCountry: issuer })) return false;
  const lc = listingCountryOf(listing);
  if (lc !== issuer) return false;
  const code = exchangeCodeOf(listing);
  const rank = code in EXCHANGE_RANK ? EXCHANGE_RANK[code] : DEFAULT_RANK;
  return rank < SECONDARY_QUOTE_RANK;
}

/** What a listing is, once the issuer's country is known. */
export function securityTypeOf(listing: Listing, issuerCountry?: string): SecurityType {
  if (declaredDepositaryReceipt(listing)) return "depositary-receipt";
  const issuer = upper(issuerCountry) || upper(listing.issuerCountry);
  if (!issuer) return "unknown";
  return derivedDepositaryReceipt(listing, issuer) ? "depositary-receipt" : "ordinary";
}

// ── Which listing wins ──────────────────────────────────────────────────────

/**
 * The tiers, in the order the desk would read them.
 *
 * A tier decides; venue rank only breaks ties inside one. That separation is
 * the fix for the overcorrection: "NYSE beats NSE" is true within a tier and
 * false across them, and the old single-number ranking could not express the
 * difference, so it applied the American answer to every company on earth.
 *
 * Home-market listings share one tier rather than splitting "primary" from
 * "second", because which of NSE and BSE is a given company's primary line is
 * not something either feed states — and ordering them by venue rank inside the
 * tier produces exactly the sequence a split would have produced anyway.
 */
export const LISTING_TIER = {
  /** The user named this exchange. Not a preference: an instruction. */
  EXPLICIT: 0,
  /** The issuer's own market, on a venue that is primary there. */
  HOME: 1,
  /** An ordinary listing on a major foreign market. */
  FOREIGN: 2,
  /** A depositary receipt: a claim on shares that trade somewhere else. */
  DEPOSITARY: 3,
  /** A secondary quotation of stock listed elsewhere, e.g. Stuttgart. */
  SECONDARY_QUOTE: 4,
  /** Not on an exchange at all. */
  OFF_EXCHANGE: 5,
} as const;

const TIER_STEP = 1000;

export interface PreferenceContext {
  /** An exchange the user named, e.g. "NYSE" from "NYSE:NKE". */
  exchangeHint?: string;
  /**
   * The issuer's domicile, when the caller knows it.
   *
   * groupListings works this out per company and passes it down. Without it,
   * each listing is read on its own, which cannot see that a New York line
   * belongs to an Indian bank — so a lone listing is judged as if it were at
   * home, and the ordering falls back to venue rank.
   */
  issuerCountry?: string;
}

/** Which tier a listing falls in. Lower wins. */
export function listingTier(listing: Listing, ctx: PreferenceContext = {}): number {
  const hint = upper(ctx.exchangeHint);
  if (hint && exchangeCodeOf(listing) === canonical(hint)) return LISTING_TIER.EXPLICIT;

  const code = exchangeCodeOf(listing);
  const rank = code in EXCHANGE_RANK ? EXCHANGE_RANK[code] : DEFAULT_RANK;
  if (rank >= OFF_EXCHANGE_RANK) return LISTING_TIER.OFF_EXCHANGE;

  const issuer = upper(ctx.issuerCountry) || upper(listing.issuerCountry);
  if (isDepositaryReceipt({ ...listing, issuerCountry: issuer || undefined })) {
    return LISTING_TIER.DEPOSITARY;
  }
  if (rank >= SECONDARY_QUOTE_RANK) return LISTING_TIER.SECONDARY_QUOTE;

  const lc = listingCountryOf(listing);
  // With no domicile established, a listing on a primary venue is read as being
  // at home. That is the honest reading of a single row in isolation — there is
  // no second listing to compare it against — and it keeps a lone NYSE line and
  // a lone NSE line ordered by venue, which is all the information there is.
  if (!issuer || !lc) return LISTING_TIER.HOME;
  return lc === issuer ? LISTING_TIER.HOME : LISTING_TIER.FOREIGN;
}

/**
 * How much this listing wants to be the one shown. Lower wins.
 *
 * An exchange the user typed beats everything: "NYSE:HDB" is not a hint to be
 * weighed against domicile, it is an instruction, and HDB must open even though
 * it is the receipt and not the share.
 */
export function listingPreference(listing: Listing, ctx: PreferenceContext = {}): number {
  return listingTier(listing, ctx) * TIER_STEP + exchangeRank(listing);
}

// ── Reading the query ───────────────────────────────────────────────────────

export interface ParsedQuery {
  /** The query with any exchange prefix removed. */
  q: string;
  /** The exchange the prefix named, normalised, when it named one. */
  exchangeHint?: string;
  /** The prefix as typed, kept so the UI can echo it. */
  rawPrefix?: string;
}

/**
 * Read "NYSE:HDB" as an exchange and a symbol.
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
  if (asCode in EXCHANGE_RANK) hint = canonical(asCode);
  else {
    for (const [re, code] of EXCHANGE_ALIASES) {
      if (re.test(prefix)) {
        hint = canonical(code);
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
  /** Where the issuer is domiciled, or undefined when it could not be worked out. */
  issuerCountry?: string;
  /** The listing shown on the main row. */
  preferred: Listing;
  /** Every listing, preferred first, then by preference. */
  listings: Listing[];
  /** Every listing EXCEPT the preferred one. What the disclosure shows. */
  alternatives: Listing[];
}

/**
 * Group listings by company, keeping all of them, and work out what each one is.
 *
 * Three passes, and the middle one is the reason this function exists rather
 * than a sort:
 *
 *   1. Bucket by company identity, splitting any bucket that holds two listings
 *      on the SAME exchange — one company has one listing per security per
 *      exchange, so two rows on NASDAQ are two securities however identical
 *      their names look. That is what keeps GOOG and GOOGL apart.
 *   2. Infer the issuer's country from the bucket AS A WHOLE, then annotate
 *      every listing in it. A single row cannot tell you that a New York line
 *      belongs to an Indian bank; the NSE row sitting next to it can.
 *   3. Rank within the bucket, against that country.
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
    if (!members.every((m) => declaredDepositaryReceipt(m))) continue;
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
      // The issuer's country is a property of the COMPANY, so it is worked out
      // once from every listing the company has, and then written onto each of
      // them. Ranking a listing needs that answer, and a listing on its own
      // does not contain it.
      const issuerCountry = ctx.issuerCountry ?? inferIssuerCountry(part);
      const groupCtx: PreferenceContext = { ...ctx, issuerCountry };

      const annotated = part.map((l) => {
        const securityType = securityTypeOf(l, issuerCountry);
        const withCountry: Listing = {
          ...l,
          issuerCountry,
          listingCountry: listingCountryOf(l),
          securityType,
          isDepositaryReceipt: securityType === "depositary-receipt",
        };
        return { ...withCountry, isHomePrimary: isHomePrimaryListing(withCountry, issuerCountry) };
      });

      const sorted = annotated
        .slice()
        .sort((a, b) => listingPreference(a, groupCtx) - listingPreference(b, groupCtx));

      // A receipt is a claim on a specific share. When that share is in the
      // same group we can say which, which is worth more than the label alone:
      // it tells a reader where the price they are looking at comes from.
      const home = sorted.find((l) => l.isHomePrimary);
      const withUnderlying = sorted.map((l) =>
        l.securityType === "depositary-receipt" && home && !l.underlyingSymbol
          ? { ...l, underlyingSymbol: home.symbol }
          : l
      );

      const preferred = withUnderlying[0];
      groups.push({
        id: parts.length > 1 ? `${id}|${upper(preferred.symbol)}` : id,
        name: preferred.name,
        kind: preferred.kind,
        issuerCountry,
        preferred,
        listings: withUnderlying,
        alternatives: withUnderlying.slice(1),
      });
    }
  }
  return groups;
}
