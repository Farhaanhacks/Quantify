// Server-only market-data type surface.
//
// This module is currently unused — live quotes are fetched via /api/quote and
// the live scoring/timeseries endpoints. It is kept only as a thin, provider-
// agnostic type surface and contains NO demo/sample data: with no configured
// provider it reports "not available" rather than a placeholder.
//
// NOTE: must only be imported from server components or route handlers.

export interface LiveQuote {
  ticker: string;
  name: string;
  price: number;
  changePct: number;
  marketCap?: string;
  live: boolean; // true = from a live provider
}

// With no configured provider there is nothing to return — say so honestly
// instead of inventing a price.
export function notAvailableQuote(ticker: string): LiveQuote {
  return { ticker, name: ticker, price: 0, changePct: 0, live: false };
}
