// Quantifi pricing. A single paid tier — Quantifi Pro at ₹49/month (a limited
// launch offer; standard price ₹500/month), billed through Razorpay — unlocks
// the Pro-only research surfaces. Everything else stays free. The Razorpay Plan
// ID lives in env (RAZORPAY_PLAN_PRO), so no billing identifiers are committed.

// Numeric free-plan limits, referenced by the gating code so the numbers live
// in one place.
export const FREE_LIMITS = {
  newsPerDay: 5,
  analysesPerDay: 2,
  watchlistStocks: 5,
  featuredIdeas: 2,
} as const;

// What an active Quantifi Pro subscription unlocks — the full research workflow.
export const PRO_FEATURES = [
  "Unlimited stock analysis",
  "All Ideas & Community playbooks unlocked",
  "Full source packs",
  "Portfolio diagnosis & watchlist alerts",
  "Insider Activity & Rare Finds",
  "Advanced screener",
  "Save & export research",
] as const;

// What free (Explorer) accounts get — discovery + trust.
export const FREE_FEATURES = [
  `${FREE_LIMITS.newsPerDay} news-impact items a day`,
  `${FREE_LIMITS.analysesPerDay} full stock analyses a day`,
  `Up to ${FREE_LIMITS.watchlistStocks} watchlist stocks`,
  "Preview every research Idea",
  "Full access to featured Ideas + the Situational Awareness playbook",
  "Basic screener preview",
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
  price: "¢0.55",
  amount: 4900,
  currency: "INR",
  period: "month",
  trialDays: 0,
  trialLabel: "Launch price",
  tagline: "Limited launch price — ¢0.55/month (normally ₹500). Cancel anytime.",
  proFeatures: [...PRO_FEATURES],
  freeFeatures: [...FREE_FEATURES],
  cta: "Get Quantifi Pro",
};
