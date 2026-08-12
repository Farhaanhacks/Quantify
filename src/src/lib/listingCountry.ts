// Which country a listing trades in, worked out from its symbol.
//
// This lives here rather than in the search route because the client needs the
// same answer. Recently-viewed entries are stored in localStorage, and every one
// saved before the search API started returning `country` has no country field
// at all. Those rows rendered with no flag while freshly-searched rows next to
// them had one, which read as a bug in the flags rather than what it was: old
// data. Deriving the country from the symbol at render time means a stored row
// from any era still gets its flag, and nothing has to be migrated.

/** Yahoo-style exchange suffix → ISO-3166 alpha-2. */
export const SUFFIX_COUNTRY: Record<string, string> = {
  NS: "IN", BO: "IN", L: "GB", TO: "CA", V: "CA", AX: "AU", NZ: "NZ",
  DE: "DE", F: "DE", PA: "FR", AS: "NL", BR: "BE", MI: "IT", MC: "ES",
  SW: "CH", ST: "SE", OL: "NO", CO: "DK", HE: "FI", LS: "PT", VI: "AT",
  IR: "IE", HK: "HK", T: "JP", SS: "CN", SZ: "CN", KS: "KR", KQ: "KR",
  TW: "TW", TWO: "TW", SI: "SG", KL: "MY", BK: "TH", JK: "ID", SA: "BR",
  MX: "MX", BA: "AR", SR: "SA", TA: "IL", IS: "TR", CA: "EG", JO: "ZA",
};

/** Full country name (as EODHD reports it) → ISO-3166 alpha-2. */
export const COUNTRY_ISO: Record<string, string> = {
  USA: "US", "United States": "US", India: "IN", Taiwan: "TW",
  "South Korea": "KR", Korea: "KR", China: "CN", "Hong Kong": "HK",
  UK: "GB", "United Kingdom": "GB", Canada: "CA", Australia: "AU",
  Japan: "JP", Germany: "DE", France: "FR", Singapore: "SG", Brazil: "BR",
};

/**
 * ISO-2 country for a Yahoo-style symbol. A symbol with no suffix is a US
 * listing (AAPL, H); a suffixed one is looked up (RELIANCE.NS → IN).
 *
 * Returns "" when the suffix is one we don't map, so callers can tell "unknown"
 * apart from "United States".
 */
export function countryForSymbol(symbol: string): string {
  const dot = (symbol ?? "").lastIndexOf(".");
  if (!symbol) return "";
  if (dot === -1) return "US";
  return SUFFIX_COUNTRY[symbol.slice(dot + 1).toUpperCase()] ?? "";
}

/**
 * The country to show for a search hit: whatever the API resolved, falling back
 * to the symbol. `country` can be absent (an older stored row) or empty (a
 * listing whose exchange we don't map), and both should still try the suffix.
 */
export function displayCountry(hit: { country?: string; symbol: string }): string {
  return (hit.country || "").toUpperCase() || countryForSymbol(hit.symbol);
}
