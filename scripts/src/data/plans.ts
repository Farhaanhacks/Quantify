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

// ── Limited-time launch: Pro is FREE, unlocked instantly (no card, no Razorpay) ──
// While this is true, clicking "Get Quantifi Pro" grants Pro immediately for
// FREE_LAUNCH_DAYS by writing the same KV record the paid path uses. To END the
// offer and switch the paywall back on, set FREE_LAUNCH_OFFER to false and
// redeploy: new users then go through the regular Razorpay checkout, and the
// free grants already handed out lapse on their own when their access window
// (FREE_LAUNCH_DAYS) runs out — so their Pro is "blocked again unless they buy".
export const FREE_LAUNCH_OFFER = true;
export const FREE_LAUNCH_DAYS = 7; // each free grant lasts one week, then lapses

// ── Display-only price labels ──────────────────────────────────────────────
// While the launch offer is on, Pro costs nothing, so every upgrade surface must
// say "Free" — quoting a rupee/cent figure next to a free offer just confuses
// people. These are presentation strings ONLY; QUANTIFI_PRO.amount stays the
// real Razorpay charge for when the offer ends. Surfaces that hardcoded
// QUANTIFI_PRO.price drifted out of sync with FREE_LAUNCH_OFFER once already —
// import these instead of re-deriving the label.
export const PRO_STANDARD_PRICE = "₹500";
/** "Free" during the launch offer, otherwise the billed price. */
export const PRO_PRICE_LABEL = FREE_LAUNCH_OFFER ? "Free" : QUANTIFI_PRO.price;
/** Short qualifier to sit beside PRO_PRICE_LABEL. */
export const PRO_PRICE_NOTE = FREE_LAUNCH_OFFER
  ? "for a limited time"
  : `per ${QUANTIFI_PRO.period}`;
