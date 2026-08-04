// Ticker aliases for renamed / demerged listings, so old symbols still resolve to
// the live entity. Tata Motors demerged; the trading entity users mean when they
// type "TATAMOTORS" is now TMCV.NS. Applied at the data-API entry points (quote,
// timeseries, score, company, peers, insider) so the whole stock page stays
// consistent. Add new renames here as they happen.
const ALIASES: Record<string, string> = {
  "TATAMOTORS.NS": "TMCV.NS",
  "TATAMOTORS.BO": "TMCV.BO",
  TATAMOTORS: "TMCV",
};

export function aliasSymbol(sym: string): string {
  if (!sym) return sym;
  const up = sym.toUpperCase();
  return ALIASES[up] ?? sym;
}

// Curated company-name → ticker map, checked BEFORE Yahoo's search (which is
// rate-limited from datacenter IPs, so it misses names — notably recent
// spinoffs/IPOs like Sandisk → SNDK). Keys are normalised (upper, no spaces/&).
// Extend as users hit gaps. Only for names Yahoo commonly fails on.
const NAME_TO_TICKER: Record<string, string> = {
  SANDISK: "SNDK",
  WESTERNDIGITAL: "WDC",
  ARMHOLDINGS: "ARM",
  ARM: "ARM",
  KENVUE: "KVUE",
  GEVERNOVA: "GEV",
  GEAEROSPACE: "GE",
  SOLVENTUM: "SOLV",
  CARRIER: "CARR",
  DELL: "DELL",
  META: "META",
  FACEBOOK: "META",
  GOOGLE: "GOOGL",
  ALPHABET: "GOOGL",
  BERKSHIRE: "BRK-B",
  RELIANCE: "RELIANCE.NS",
  TATAMOTORS: "TMCV.NS",
  INFOSYS: "INFY.NS",
  ZOMATO: "ETERNAL.NS",
};

const normName = (s: string): string => s.toUpperCase().replace(/[^A-Z0-9.]/g, "");

// Returns a ticker for a free-text company name from the curated map, or null.
export function nameToTicker(input: string): string | null {
  if (!input) return null;
  return NAME_TO_TICKER[normName(input)] ?? null;
}
