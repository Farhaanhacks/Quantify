// Map a Quantifi ticker to a TradingView symbol (EXCHANGE:SYMBOL).
// Plain module (no "use client") so it can be called from server components.

export function tvSymbol(ticker: string, exchange?: string): string {
  const t = ticker.toUpperCase();
  if (t.endsWith(".NS")) return `NSE:${t.replace(".NS", "")}`;
  const ex = (exchange ?? "NASDAQ").toUpperCase();
  return `${ex}:${t}`;
}

// TradingView exchange code → the suffix our tickers use (Yahoo style).
// US venues carry no suffix. Anything not listed falls through to the bare
// ticker, which is the right guess far more often than inventing a suffix.
const TV_EXCHANGE_SUFFIX: Record<string, string> = {
  NASDAQ: "", NYSE: "", AMEX: "", ARCA: "", BATS: "", OTC: "", CBOE: "",
  NSE: ".NS", BSE: ".BO", BOM: ".BO",
  LSE: ".L", TSX: ".TO", TSXV: ".V", ASX: ".AX", NZX: ".NZ",
  TSE: ".T", HKEX: ".HK", KRX: ".KS", SSE: ".SS", SZSE: ".SZ",
  XETR: ".DE", FWB: ".F", EURONEXT: ".PA", MIL: ".MI", BME: ".MC",
  SIX: ".SW", OMXSTO: ".ST", OSL: ".OL", OMXCOP: ".CO", OMXHEX: ".HE",
  SGX: ".SI", MYX: ".KL", SET: ".BK", IDX: ".JK", BMFBOVESPA: ".SA",
  BMV: ".MX", TASE: ".TA",
};

/**
 * The inverse of `tvSymbol`: turn a TradingView symbol ("NASDAQ:AAPL",
 * "NSE:RELIANCE") into the ticker the rest of the app uses ("AAPL",
 * "RELIANCE.NS").
 *
 * This exists because the heatmap widget hands a clicked tile back to us as
 * EXCHANGE:TICKER on the query string. Without the mapping, clicking Reliance
 * would open a page for the symbol "RELIANCE", which resolves to nothing —
 * the suffix is what makes it an Indian listing.
 *
 * Returns "" for anything unparseable, so callers can fall back rather than
 * navigate to a broken symbol.
 */
export function fromTvSymbol(raw: string | undefined): string {
  const s = (raw ?? "").trim().toUpperCase();
  if (!s) return "";
  const i = s.indexOf(":");
  if (i === -1) return /^[A-Z0-9.\-]{1,15}$/.test(s) ? s : "";
  const exchange = s.slice(0, i);
  const ticker = s.slice(i + 1);
  if (!ticker || !/^[A-Z0-9.\-]{1,15}$/.test(ticker)) return "";
  const suffix = TV_EXCHANGE_SUFFIX[exchange];
  // Unknown exchange → return the bare ticker rather than guessing a market.
  if (suffix === undefined) return ticker;
  return ticker.endsWith(suffix) ? ticker : `${ticker}${suffix}`;
}
