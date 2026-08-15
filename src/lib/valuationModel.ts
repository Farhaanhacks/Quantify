// The valuation models, and the rule that decides which one a company gets.
//
// This module has NO imports on purpose. Every function in it is pure — numbers
// in, numbers out — so the whole thing can be compiled and exercised directly by
// scripts/test-bank-valuation.mjs, the same arrangement searchRank.ts has. The
// alternative is what this code used to be: a valuation buried inside a function
// that first has to reach Yahoo, which meant no test could ever run it and every
// change to the model shipped on reasoning alone.
//
// ── Why the routing exists ───────────────────────────────────────────────────
//
// A discounted-cash-flow model asks "what cash will this business throw off,
// and what is that worth today". For a bank the question is malformed. Lending
// growth is an OPERATING outflow, deposits are an operating inflow, and neither
// is discretionary cash the owners could ever take out — so "free cash flow" for
// a bank is an artefact of where the accountants drew the line, not a measure of
// anything. Run the ordinary DCF on it anyway and you get exactly what Quantifi
// was printing for HDFC Bank: ₹3,171.55, a number with no defensible meaning,
// standing next to a P/B read of ₹472.58 and contradicting it sevenfold.
//
// So financial institutions never enter the cash-flow model at all. They are
// valued on an excess-return (residual-income) model, which is the standard
// lens for a lender: a bank is worth its book value, plus the present value of
// the returns it earns ABOVE its cost of equity on that book. When the inputs
// for that are incomplete, the fallback is price-to-book — never bank operating
// cash flow, which is the very number that produced the wrong answer.

export const VALUATION_MODEL_VERSION = "2026.08-fin1";

export type ValuationMethod = "dcf" | "excess-returns" | "pb";

export interface IntrinsicValue {
  estimate: number;
  method: ValuationMethod;
  /** Display label for the method — shown on the card, stored with history. */
  methodLabel: string;
  modelVersion: string;
}

// Test instrumentation. "A bank never enters the cash-flow model" is a claim
// about CONTROL FLOW, and the only honest way to check a control-flow claim is
// to observe the call itself — asserting on the returned number would pass just
// as well if the DCF ran and its output was thrown away afterwards.
export const __dcfProbe = { calls: 0 };

// ── Which lens does this company get? ────────────────────────────────────────

// Yahoo's sector string for lenders is "Financial Services"; other feeds say
// "Financials" or "Banks". The industry line is checked as well because a
// financial can be filed under a neighbouring sector — a mortgage REIT sits in
// Real Estate but earns an interest spread like a bank, and has the same absent
// free cash flow.
const FINANCIAL_INDUSTRY =
  /bank|insur|reinsur|capital market|asset management|credit service|lending|mortgage|thrift|savings|brokerage|financial (data|conglomerate|exchange)|financial services/;

export function isFinancialInstitution(
  sector?: string,
  industry?: string
): boolean {
  const s = (sector ?? "").toLowerCase();
  const ind = (industry ?? "").toLowerCase();
  if (/financ|bank|insur|capital market/.test(s)) return true;
  return FINANCIAL_INDUSTRY.test(ind);
}

// ── DCF rate inputs ──────────────────────────────────────────────────────────
//
// Two market-level constants drive the model, both keyed by the listing's home
// currency because a US 9% discount applied to Indian cash flows understates the
// risk and inflates the value.
//
// RISK_FREE is the local 10-year government bond yield. It does double duty: it
// anchors the cost of equity, and it IS the terminal growth rate — a mature
// company cannot compound faster than its economy forever, and the long bond is
// the standard proxy for that ceiling.
const RISK_FREE: Record<string, number> = {
  USD: 0.043, CAD: 0.033, GBP: 0.042, EUR: 0.025, CHF: 0.005, JPY: 0.016,
  AUD: 0.043, SGD: 0.028, HKD: 0.035, TWD: 0.015, KRW: 0.031, CNY: 0.018,
  INR: 0.069, IDR: 0.068, THB: 0.026, PHP: 0.061, MYR: 0.038,
  BRL: 0.113, MXN: 0.095, ZAR: 0.105, TRY: 0.27, AED: 0.043, SAR: 0.045,
};

// Equity risk premium — the excess return demanded over the local bond for
// carrying equity risk. Developed markets sit near 5%, emerging markets higher.
const EQUITY_RISK_PREMIUM: Record<string, number> = {
  USD: 0.05, CAD: 0.05, GBP: 0.05, EUR: 0.055, CHF: 0.05, JPY: 0.055,
  AUD: 0.05, SGD: 0.055, HKD: 0.06, TWD: 0.06, KRW: 0.065, CNY: 0.07,
  INR: 0.07, IDR: 0.08, THB: 0.07, PHP: 0.08, MYR: 0.07,
  BRL: 0.075, MXN: 0.07, ZAR: 0.08, TRY: 0.09, AED: 0.06, SAR: 0.06,
};

export function riskFreeRate(currency: string | undefined): number {
  return RISK_FREE[(currency ?? "USD").toUpperCase()] ?? 0.06;
}

// Cost of equity by CAPM: risk-free + beta x equity risk premium.
//
// Beta is the market's own measure of how much a name amplifies market moves, so
// a defensive utility and a high-volatility small cap no longer get discounted
// identically. It's clamped to 0.6–2.0: Yahoo's beta is noisy, and an unclamped
// 0.1 or 3.5 swings the valuation more than the underlying business ever could.
// The result is clamped again to 6–18% so neither a zero-rate market nor a
// distressed one produces a nonsense discount.
export function costOfEquity(currency: string | undefined, beta?: number): number {
  const rf = riskFreeRate(currency);
  const erp = EQUITY_RISK_PREMIUM[(currency ?? "USD").toUpperCase()] ?? 0.07;
  const b = beta != null && isFinite(beta) && beta > 0 ? Math.min(2.0, Math.max(0.6, beta)) : 1.0;
  return Math.min(0.18, Math.max(0.06, rf + b * erp));
}

// Terminal growth for the Gordon step: the local 10-year bond rate, but never so
// close to the discount rate that (rate - growth) collapses and the terminal
// value explodes. A 3-point spread is the floor.
export function terminalGrowthFor(currency: string | undefined, discount: number): number {
  return Math.max(0.005, Math.min(riskFreeRate(currency), discount - 0.03));
}

// ── The cash-flow model (non-financials only) ────────────────────────────────

// A deliberately simple 2-stage discounted free-cash-flow model: grow this
// year's FCF for 10 years, add a Gordon-growth terminal value, discount it all
// back at a flat cost of equity, then divide by shares. Returns undefined when
// the inputs don't support a meaningful estimate (e.g. negative FCF).
//
// Crucially the high-growth phase FADES: a fast compounder doesn't grow at 40%
// forever, but holding it flat at the revenue-growth rate (the old behaviour)
// undervalued real compounders badly — a company whose cash flow has grown ~40%
// a year read as if it grew ~13%. We start from the company's observed cash-flow
// growth and decay it linearly toward the terminal rate, which is how a sane DCF
// treats hyper-growth: rich near-term, normalising over time.
//
// NOTHING IN THE LIVE PATH MAY CALL THIS DIRECTLY. Go through
// intrinsicValuePerShare, which is where the financial-institution rule lives —
// a second call site is a second place for a bank to slip into this model.
export function dcfPerShare(
  fcf: number | undefined,
  shares: number | undefined,
  growth: number | undefined,
  discount = 0.09,
  termGrowth = 0.025, // callers pass the bond-linked rate; this is only a fallback
  years = 10
): number | undefined {
  __dcfProbe.calls++;
  if (fcf == null || fcf <= 0 || shares == null || shares <= 0) return undefined;
  // Clamp to a sane 6–16% band: the low end for a defensive developed-market name,
  // the high end for a higher-risk emerging market (India, LatAm) whose local
  // risk-free rate alone can be ~7%. A US-only 7–11% band understates the
  // discount for those markets and inflates their valuations (a too-small
  // rate − terminalGrowth spread blows up the terminal value).
  const rate = Math.min(0.16, Math.max(0.06, discount));
  // Initial growth: floor 3% so a sleepy name still gets a fair terminal, cap 25%
  // so an optimistic read can't run away. The old 20% ceiling was arbitrarily
  // punitive for genuine compounders — a retailer like Trent has grown earnings
  // ~40%+ a year with analyst support, and forcing it to 20% capped the model at
  // ~25x earnings no matter what the evidence said. 25% plus the two-stage fade and
  // the terminal rate keeps it bounded without pretending real growth isn't there.
  const g0 = Math.min(0.25, Math.max(0.03, growth ?? 0.05));
  let cf = fcf;
  let pv = 0;
  // TRUE two-stage schedule: HOLD stage-1 growth for the first half of the
  // window, then fade to the terminal rate across the second half. Fading from
  // year one — the old behaviour — is a 1-stage decay wearing a 2-stage label,
  // and it taxed away a compounder's growth before it had a chance to compound.
  const stage1 = Math.max(1, Math.floor(years / 2));
  for (let t = 1; t <= years; t++) {
    const g =
      t <= stage1
        ? g0
        : g0 + ((termGrowth - g0) * (t - stage1)) / (years - stage1);
    cf *= 1 + g;
    pv += cf / Math.pow(1 + rate, t);
  }
  const terminal = (cf * (1 + termGrowth)) / (rate - termGrowth);
  pv += terminal / Math.pow(1 + rate, years);
  const perShare = pv / shares;
  return isFinite(perShare) && perShare > 0 ? perShare : undefined;
}

// The same valuation the live score runs, exposed so a past year can be valued
// on the cash flow that year actually reported. Everything market-level (the
// bond rate, the equity risk premium, beta, the share count) is necessarily
// today's — Yahoo does not serve a 2023 beta or a 2023 share register — so this
// is "the model applied to the cash flow of the year", not a snapshot of what
// the model would have printed at the time. Callers must label it as such.
export function cashflowValuePerShare({
  fcf,
  shares,
  growth,
  currency,
  beta,
  cyclical = false,
}: {
  fcf: number | undefined;
  shares: number | undefined;
  growth: number | undefined;
  currency: string | undefined;
  beta?: number;
  cyclical?: boolean;
}): number | undefined {
  const discount = costOfEquity(currency, beta);
  const rate = cyclical ? Math.min(0.18, discount + 0.02) : discount;
  const term = terminalGrowthFor(currency, rate);
  return cyclical
    ? dcfPerShare(fcf, shares, term, rate, term)
    : dcfPerShare(fcf, shares, growth, rate, term);
}

// ── The excess-return model (financial institutions) ─────────────────────────

/** The P/B a broadly-average bank trades at — the fallback benchmark. */
export const BANK_PB_BENCHMARK = 1.2;

/**
 * Residual-income value per share for a lender.
 *
 *   V0 = B0 + Σ (ROEt − r) × Bt−1 / (1+r)^t + terminal
 *
 * In words: a bank is worth its book value, plus whatever it earns above its
 * cost of equity on that book, discounted. A bank earning exactly its cost of
 * equity is worth book and no more — which is the correct answer, and one no
 * cash-flow model can express.
 *
 * Two stages, mirroring the DCF: today's ROE holds for the first half of the
 * window, then fades toward a durable long-run spread over the cost of equity,
 * because competition and capital rules compress outsized returns on equity.
 * Book value compounds at the sustainable growth rate (ROE × retention), so the
 * two move together instead of one being assumed independently of the other.
 */
export function excessReturnValuePerShare({
  bookValuePerShare,
  roe,
  currency,
  beta,
  payoutRatio,
  years = 10,
}: {
  bookValuePerShare: number | undefined;
  roe: number | undefined;
  currency: string | undefined;
  beta?: number;
  payoutRatio?: number;
  years?: number;
}): number | undefined {
  if (bookValuePerShare == null || !(bookValuePerShare > 0)) return undefined;
  if (roe == null || !isFinite(roe) || !(roe > 0)) return undefined;

  const r = costOfEquity(currency, beta);
  const gTerm = terminalGrowthFor(currency, r);
  // Yahoo's returnOnEquity is noisy and occasionally reports a one-off year;
  // 2–30% is the band a real lender lives in over a cycle.
  const roe0 = Math.min(0.3, Math.max(0.02, roe));
  // Payout: what the bank hands back rather than retains. A ratio outside 0–1 is
  // an artefact (a loss year, a special dividend), so fall back to a typical
  // ~20% bank payout rather than letting it distort the growth of book.
  const payout =
    payoutRatio != null && isFinite(payoutRatio) && payoutRatio >= 0 && payoutRatio < 1
      ? payoutRatio
      : 0.2;
  const retention = 1 - payout;
  // A franchise keeps SOME spread indefinitely — a 2pp premium over the cost of
  // equity — but never more than it earns today.
  const roeTerm = Math.min(roe0, r + 0.02);

  const stage1 = Math.max(1, Math.floor(years / 2));
  let book = bookValuePerShare;
  let pv = 0;
  let roeT = roe0;
  for (let t = 1; t <= years; t++) {
    roeT =
      t <= stage1
        ? roe0
        : roe0 + ((roeTerm - roe0) * (t - stage1)) / (years - stage1);
    // Earned on OPENING book, which is what the equity actually was for the year.
    pv += ((roeT - r) * book) / Math.pow(1 + r, t);
    // Retained earnings are the only thing that grows book here — no equity
    // raise is assumed, so the model can't credit growth it hasn't funded.
    book *= 1 + Math.min(0.2, Math.max(0, roeT * retention));
  }
  // Terminal: the durable spread persists, growing at the terminal rate. The
  // 3-point (r − g) floor is enforced by terminalGrowthFor, so this can't blow up.
  if (r > gTerm) pv += ((roeTerm - r) * book) / (r - gTerm) / Math.pow(1 + r, years);

  const v = bookValuePerShare + pv;
  return isFinite(v) && v > 0 ? v : undefined;
}

// A plausibility band, not a second opinion. It exists to reject data artefacts
// — a currency mismatch, a share count off by an order of magnitude — and is
// kept wide so a legitimately cheap or expensive verdict always survives.
function withinBand(v: number | undefined, price: number): v is number {
  return v != null && isFinite(v) && v > 0 && v >= price * 0.02 && v <= price * 25;
}

/**
 * The valuation a financial institution gets: excess returns, else P/B.
 *
 * It never falls back to bank operating cash flow. That is the whole point: the
 * cash-flow number for a lender is meaningless, so "no book value" has to end in
 * no valuation rather than in the model we just ruled out.
 */
export function financialValuePerShare({
  price,
  bookValuePerShare,
  roe,
  currency,
  beta,
  payoutRatio,
}: {
  price: number;
  bookValuePerShare: number | undefined;
  roe: number | undefined;
  currency: string | undefined;
  beta?: number;
  payoutRatio?: number;
}): IntrinsicValue | undefined {
  const er = excessReturnValuePerShare({ bookValuePerShare, roe, currency, beta, payoutRatio });
  if (withinBand(er, price)) {
    return {
      estimate: er,
      method: "excess-returns",
      methodLabel: "Financial-sector value · excess-return model",
      modelVersion: VALUATION_MODEL_VERSION,
    };
  }
  if (bookValuePerShare != null && bookValuePerShare > 0) {
    const pb = BANK_PB_BENCHMARK * bookValuePerShare;
    if (withinBand(pb, price)) {
      return {
        estimate: pb,
        method: "pb",
        methodLabel: "Financial-sector value · P/B model",
        modelVersion: VALUATION_MODEL_VERSION,
      };
    }
  }
  return undefined;
}

// ── The router ───────────────────────────────────────────────────────────────

export interface IntrinsicInput {
  sector?: string;
  industry?: string;
  price: number;
  currency?: string;
  beta?: number;
  /** Cash-flow path (non-financials). */
  baseCashflow?: number;
  shares?: number;
  growth?: number;
  cyclical?: boolean;
  /** Financial path. */
  bookValuePerShare?: number;
  roe?: number;
  payoutRatio?: number;
}

/**
 * The ONE entry point to a valuation. Every caller in the app goes through here,
 * so the financial-institution rule is enforced in a single place instead of
 * being re-remembered at each call site.
 */
export function intrinsicValuePerShare(i: IntrinsicInput): IntrinsicValue | undefined {
  if (!(i.price > 0)) return undefined;

  // Banks, insurers, brokers, lenders: the cash-flow model is not merely
  // inaccurate for them, it is measuring the wrong thing. They are routed away
  // before a cash-flow figure is even consulted.
  if (isFinancialInstitution(i.sector, i.industry)) {
    return financialValuePerShare({
      price: i.price,
      bookValuePerShare: i.bookValuePerShare,
      roe: i.roe,
      currency: i.currency,
      beta: i.beta,
      payoutRatio: i.payoutRatio,
    });
  }

  const discount = costOfEquity(i.currency, i.beta);
  // Deep-cyclical commodity producers do NOT compound their cash flows — those
  // swing with commodity prices. Value the through-cycle cash at the terminal
  // rate only, discounted at a higher cyclical cost of equity, so the estimate is
  // a normalised mid-cycle read rather than an extrapolation of a peak year.
  const rate = i.cyclical ? Math.min(0.18, discount + 0.02) : discount;
  const term = terminalGrowthFor(i.currency, rate);
  const v = i.cyclical
    ? dcfPerShare(i.baseCashflow, i.shares, term, rate, term)
    : dcfPerShare(i.baseCashflow, i.shares, i.growth, rate, term);
  if (!withinBand(v, i.price)) return undefined;
  return {
    estimate: v,
    method: "dcf",
    methodLabel: "Discounted cash flow",
    modelVersion: VALUATION_MODEL_VERSION,
  };
}
