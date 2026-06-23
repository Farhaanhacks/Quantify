// Quantifi pricing. A single paid tier — Quantifi Pro at ₹49/month (a limited
// launch offer; standard price ₹500/month), billed through Razorpay — unlocks
// the Pro-only research surfaces. Everything else stays free. The Razorpay Plan
// ID lives in env (RAZORPAY_PLAN_PRO), so no billing identifiers are committed.

// Routes that require an active Quantifi Pro subscription. Used by the ProGate
// wrapper and surfaced on the pricing page.
export const PRO_FEATURES = [
  "Stock Analysis",
  "Insider Activity",
  "Rare Finds",
] as const;

// What free (Explorer) accounts get — i.e. everything that isn't Pro-gated.
export const FREE_FEATURES = [
  "Market Pulse & News Impact",
  "Explore companies & Screener",
  "Trading Ideas & Famous Takes",
  "Portfolio tracker & Watchlist",
  "Currency tools",
] as const;

export interface ProPlan {
  id: "pro";
  name: string;
  price: string; // display only
  amount: number; // in the smallest currency unit (paise) — ₹49 = 4900
  currency: "INR";
  period: string;
  tagline: string;
  proFeatures: readonly string[];
  freeFeatures: readonly string[];
  cta: string;
}

export const QUANTIFI_PRO: ProPlan = {
  id: "pro",
  name: "Quantifi Pro",
  price: "₹49",
  amount: 4900,
  currency: "INR",
  period: "month",
  tagline: "Limited offer — ₹49/mo (normally ₹500). Unlock the full research suite.",
  proFeatures: [...PRO_FEATURES],
  freeFeatures: [...FREE_FEATURES],
  cta: "Upgrade to Pro",
};
