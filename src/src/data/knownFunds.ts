// Funds that Yahoo Finance either misclassifies as ordinary equities — e.g.
// DXYZ (Destiny Tech100), a closed-end tech holding vehicle structured as a
// C-corp, which Yahoo tags as EQUITY and scores like a company — or covers so
// thinly that its API returns no holdings at all (e.g. ARKVX, an interval fund).
//
// This registry is the source of truth for those names: it forces them onto the
// fund/ETF X-ray path and supplies holdings curated from each fund's own public
// disclosures where Yahoo has none. Weights are approximate and provided for
// research/education only — never advice.

import type { EtfHolding } from "@/lib/yahooEtf";

export interface KnownFund {
  name: string;
  kind: "ETF" | "Mutual fund" | "Fund";
  holdings?: EtfHolding[];
  holdingsNote?: string;
  // TradingView's free widget can't chart it (e.g. non-exchange-traded funds),
  // so default to the Quantifi (Yahoo) chart instead.
  preferQuantifiChart?: boolean;
}

// Holdings of these funds are private companies with no public ticker, so the
// symbol is left blank (the X-ray renders the name without a stock link).
const h = (name: string, weight: number): EtfHolding => ({ symbol: "", name, weight });

export const KNOWN_FUNDS: Record<string, KnownFund> = {
  DXYZ: {
    name: "Destiny Tech100",
    kind: "ETF",
    holdingsNote:
      "Approximate weights, curated from Destiny Tech100's public disclosures — Yahoo doesn't publish a holdings breakdown for this fund.",
    holdings: [
      h("SpaceX", 0.34),
      h("OpenAI", 0.09),
      h("Epic Games", 0.06),
      h("Anduril Industries", 0.05),
      h("Axiom Space", 0.04),
      h("Boom Supersonic", 0.04),
      h("Stripe", 0.04),
      h("Discord", 0.03),
      h("Klarna", 0.03),
      h("Revolut", 0.03),
    ],
  },
  ARKVX: {
    name: "ARK Venture Fund",
    kind: "Mutual fund",
    preferQuantifiChart: true,
    holdingsNote:
      "Approximate weights, curated from ARK Venture Fund's public disclosures — Yahoo doesn't publish a holdings breakdown for this fund.",
    holdings: [
      h("SpaceX", 0.15),
      h("OpenAI", 0.07),
      h("Anthropic", 0.05),
      h("Epic Games", 0.05),
      h("Discord", 0.04),
      h("Databricks", 0.04),
      h("Anduril Industries", 0.04),
      h("Flexport", 0.03),
      h("Replit", 0.03),
      h("Freenome", 0.03),
    ],
  },
};

export function knownFund(symbol: string | undefined | null): KnownFund | undefined {
  if (!symbol) return undefined;
  return KNOWN_FUNDS[symbol.trim().toUpperCase()];
}
