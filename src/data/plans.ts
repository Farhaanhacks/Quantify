// Pricing plans. Paid plans map to a Stripe Price ID supplied via env var
// (so no secret/price IDs are committed). Create the Prices in your Stripe
// dashboard, then set STRIPE_PRICE_PLUS / STRIPE_PRICE_PRO.

export interface Plan {
  id: "free" | "plus" | "pro";
  name: string;
  price: string; // display only
  period: string;
  tagline: string;
  features: string[];
  priceEnv?: string; // env var holding the Stripe Price ID (paid plans only)
  highlight?: boolean;
  cta: string;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Explorer",
    price: "₹0",
    period: "forever",
    tagline: "Discover what's moving across markets.",
    features: [
      "Market Pulse & news impact",
      "Quantifi Score (limited names)",
      "Basic screener filters",
      "1 watchlist",
    ],
    cta: "Current plan",
  },
  {
    id: "plus",
    name: "Plus",
    price: "₹499",
    period: "per month",
    tagline: "Deeper research across the full universe.",
    features: [
      "Everything in Explorer",
      "Full Quantifi Score & fair value",
      "Unlimited screener & watchlists",
      "Insider activity tracking",
      "News impact chains for every story",
    ],
    priceEnv: "STRIPE_PRICE_PLUS",
    highlight: true,
    cta: "Upgrade to Plus",
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹1,299",
    period: "per month",
    tagline: "For serious, daily portfolio research.",
    features: [
      "Everything in Plus",
      "Portfolio command center & alerts",
      "Priority data refresh",
      "Export & CSV import",
      "Early access to new tools",
    ],
    priceEnv: "STRIPE_PRICE_PRO",
    cta: "Upgrade to Pro",
  },
];
