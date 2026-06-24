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
] as const;

export interface ProPlan {
  id: "pro";
  name: string;
  price: string; // display only
  amount: number; // in the smallest currency unit (paise) — ₹49 = 4900
  currency: "INR";
  period: string;
  trialDays: number; // free-trial length before the first charge (0 = none)
  trialLabel: string; // short marketing label for the trial
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
  trialDays: 30,
  trialLabel: "1 month free",
  tagline: "Start with 1 month free, then ₹49/mo (normally ₹500). Cancel anytime.",
  proFeatures: [...PRO_FEATURES],
  freeFeatures: [...FREE_FEATURES],
  cta: "Start 1-month free trial",
};
