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
