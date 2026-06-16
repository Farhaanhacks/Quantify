// Map a Quantifi ticker to a TradingView symbol (EXCHANGE:SYMBOL).
// Plain module (no "use client") so it can be called from server components.

export function tvSymbol(ticker: string, exchange?: string): string {
  const t = ticker.toUpperCase();
  if (t.endsWith(".NS")) return `NSE:${t.replace(".NS", "")}`;
  const ex = (exchange ?? "NASDAQ").toUpperCase();
  return `${ex}:${t}`;
}
