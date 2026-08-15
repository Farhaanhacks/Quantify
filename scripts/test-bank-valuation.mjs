#!/usr/bin/env node
// Tests for the valuation router — above all, that a bank never reaches the
// discounted-cash-flow model.
//
// Run: node scripts/test-bank-valuation.mjs
//
// The bug these exist for: HDFC Bank was being valued at ₹3,171.55 by a
// cash-flow model, on the same page as a ₹472.58 price-to-book read. A lender's
// free cash flow is an accounting artefact — lending growth is an operating
// outflow, deposits an operating inflow, and neither is cash an owner could take
// out — so the DCF was discounting a quantity that means nothing, and doing it
// with full confidence.
//
// Note what is asserted here. "A bank is never valued by the cash-flow model" is
// a claim about CONTROL FLOW, and checking the returned number cannot establish
// it: the DCF could run, produce a figure, and have it discarded, and every
// value-based assertion would still pass. So the model itself counts its calls
// (__dcfProbe) and the tests assert on the count. There is a positive control
// too — a retailer MUST reach the DCF — because a probe that never increments
// would otherwise make every one of these pass for the wrong reason.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "bankval-"));
execFileSync(
  "npx",
  ["tsc", join(root, "src/lib/valuationModel.ts"), "--outDir", out, "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler"],
  { stdio: "pipe" }
);
const {
  intrinsicValuePerShare,
  isFinancialInstitution,
  excessReturnValuePerShare,
  financialValuePerShare,
  costOfEquity,
  dcfPerShare,
  __dcfProbe,
  BANK_PB_BENCHMARK,
  VALUATION_MODEL_VERSION,
} = await import(join(out, "valuationModel.js"));
rmSync(out, { recursive: true, force: true });

let pass = 0;
let fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};
const near = (a, b, tol) => Math.abs(a - b) <= tol;

// HDFC Bank as Yahoo actually files it, with figures in the region the live
// listing reports. The share count and book value are what matter; the exact
// price only sets the plausibility band.
const HDFC_BANK = {
  sector: "Financial Services",
  industry: "Banks—Regional",
  price: 1950,
  currency: "INR",
  beta: 0.9,
  bookValuePerShare: 393.82,
  roe: 0.145,
  payoutRatio: 0.2,
  // A cash-flow base IS present — Yahoo reports one, it is just meaningless for
  // a lender. Supplying it is the point: the routing must ignore it rather than
  // depend on it being absent.
  baseCashflow: 7.4e11,
  shares: 7.6e9,
  growth: 0.18,
};

const TRENT = {
  sector: "Consumer Cyclical",
  industry: "Department Stores",
  price: 5400,
  currency: "INR",
  beta: 1.1,
  baseCashflow: 1.6e10,
  shares: 3.55e8,
  growth: 0.25,
};

console.log("\n[who counts as a financial institution]");
for (const [sector, industry, want] of [
  ["Financial Services", "Banks—Regional", true],
  ["Financial Services", "Banks—Diversified", true],
  ["Financial Services", "Insurance—Life", true],
  ["Financial Services", "Capital Markets", true],
  ["Financial Services", "Credit Services", true],
  ["Financial Services", "Asset Management", true],
  ["Financials", "Banks", true],
  ["Real Estate", "REIT—Mortgage", true], // earns an interest spread like a bank
  ["Consumer Cyclical", "Department Stores", false],
  ["Technology", "Semiconductors", false],
  ["Energy", "Oil & Gas Integrated", false],
  ["Healthcare", "Drug Manufacturers—General", false],
  ["Real Estate", "REIT—Diversified", false],
  ["Utilities", "Utilities—Regulated Electric", false],
  ["Industrials", "Building Products & Equipment", false],
]) {
  check(
    `${sector} / ${industry} → ${want ? "financial" : "not financial"}`,
    isFinancialInstitution(sector, industry) === want
  );
}
check("an unknown sector is not assumed financial", !isFinancialInstitution(undefined, undefined));

console.log("\n[HDFCBANK.NS can never enter dcfPerShare]");
__dcfProbe.calls = 0;
const bank = intrinsicValuePerShare(HDFC_BANK);
check("the cash-flow model was not called", __dcfProbe.calls === 0, `calls=${__dcfProbe.calls}`);
check("and the method is not a DCF", bank?.method !== "dcf", JSON.stringify(bank));
check("a value is still produced", bank != null && bank.estimate > 0, JSON.stringify(bank));
check("it is the excess-return model", bank?.method === "excess-returns", bank?.method);
check("stamped with the model version", bank?.modelVersion === VALUATION_MODEL_VERSION);

// The number itself: nothing like the ₹3,171.55 the cash-flow model printed, and
// in the same region as the ₹472.58 book-value read it used to contradict.
check("the estimate is nowhere near the old ₹3,171.55", bank.estimate < 1000, String(bank.estimate));
check(
  "and it lands near the P/B read it used to contradict",
  Math.abs(bank.estimate - BANK_PB_BENCHMARK * HDFC_BANK.bookValuePerShare) < 150,
  `${bank.estimate.toFixed(2)} vs ${(BANK_PB_BENCHMARK * HDFC_BANK.bookValuePerShare).toFixed(2)}`
);

console.log("\n[the routing does not depend on the bank's inputs being absent]");
for (const [label, patch] of [
  ["no book value", { bookValuePerShare: undefined }],
  ["no return on equity", { roe: undefined }],
  ["neither", { bookValuePerShare: undefined, roe: undefined }],
  ["a loss-making year", { roe: -0.04 }],
  ["no cash-flow base", { baseCashflow: undefined }],
  ["a huge cash-flow base", { baseCashflow: 9e12 }],
]) {
  __dcfProbe.calls = 0;
  const r = intrinsicValuePerShare({ ...HDFC_BANK, ...patch });
  check(`${label}: still no cash-flow model`, __dcfProbe.calls === 0, `calls=${__dcfProbe.calls}`);
  check(`${label}: never a DCF result`, r?.method !== "dcf", JSON.stringify(r));
}

console.log("\n[the P/B fallback, and its label]");
const noRoe = financialValuePerShare({
  price: HDFC_BANK.price,
  bookValuePerShare: HDFC_BANK.bookValuePerShare,
  roe: undefined,
  currency: "INR",
  beta: 0.9,
});
check("falls back to P/B", noRoe?.method === "pb", JSON.stringify(noRoe));
check(
  "labelled 'Financial-sector value · P/B model'",
  noRoe?.methodLabel === "Financial-sector value · P/B model",
  noRoe?.methodLabel
);
check("which reproduces ₹472.58", near(noRoe.estimate, 472.58, 0.01), String(noRoe?.estimate));
check(
  "with no book value there is no valuation at all",
  financialValuePerShare({ price: 1950, bookValuePerShare: undefined, roe: undefined, currency: "INR" }) == null
);

console.log("\n[the excess-return model behaves like one]");
const bookOnly = { bookValuePerShare: 100, currency: "USD", beta: 1.0, payoutRatio: 0.3 };
const r = costOfEquity("USD", 1.0);
check("cost of equity is CAPM", near(r, 0.043 + 0.05, 1e-9), String(r));
const atCost = excessReturnValuePerShare({ ...bookOnly, roe: r });
check("a bank earning exactly its cost of equity is worth book", near(atCost, 100, 0.5), String(atCost));
const above = excessReturnValuePerShare({ ...bookOnly, roe: r + 0.06 });
const below = excessReturnValuePerShare({ ...bookOnly, roe: Math.max(0.03, r - 0.04) });
check("earning above it is worth more than book", above > 100, String(above));
check("earning below it is worth less than book", below < 100, String(below));
check("and more ROE is always worth more", above > atCost && atCost > below);
check("no ROE → no excess-return value", excessReturnValuePerShare({ ...bookOnly, roe: undefined }) == null);
check("no book → no excess-return value", excessReturnValuePerShare({ ...bookOnly, bookValuePerShare: 0, roe: 0.15 }) == null);
check(
  "an absurd ROE is clamped rather than believed",
  excessReturnValuePerShare({ ...bookOnly, roe: 3.5 }) === excessReturnValuePerShare({ ...bookOnly, roe: 0.3 })
);

console.log("\n[the positive control: a retailer must reach the DCF]");
__dcfProbe.calls = 0;
const trent = intrinsicValuePerShare(TRENT);
check("the cash-flow model ran", __dcfProbe.calls === 1, `calls=${__dcfProbe.calls}`);
check("and produced a DCF result", trent?.method === "dcf", JSON.stringify(trent));
check("labelled as one", trent?.methodLabel === "Discounted cash flow");
check("with a positive estimate", trent.estimate > 0, String(trent?.estimate));

console.log("\n[no second door into the cash-flow model]");
// The rule is only as good as its single entry point. A direct call from the
// score builder would bypass the routing entirely, so assert there isn't one.
const fundamentals = readFileSync(join(root, "src/lib/yahooFundamentals.ts"), "utf8");
check(
  "yahooFundamentals.ts never calls dcfPerShare directly",
  !/\bdcfPerShare\s*\(/.test(fundamentals),
  fundamentals.match(/.*dcfPerShare.*/)?.[0] ?? ""
);
const backfill = readFileSync(join(root, "src/lib/fairValueBackfill.ts"), "utf8");
check(
  "fairValueBackfill.ts never calls dcfPerShare directly",
  !/\bdcfPerShare\s*\(/.test(backfill)
);
check(
  "the backfill routes financials away from the cash-flow path too",
  /isFinancialInstitution/.test(backfill) && /financialValuePerShare/.test(backfill)
);

console.log("\n[the plausibility band still rejects artefacts]");
check(
  "a value 100x the price is rejected",
  intrinsicValuePerShare({ ...TRENT, price: 5, baseCashflow: 1.6e10 }) == null
);
check("dcfPerShare rejects a negative base", dcfPerShare(-5, 100, 0.1) == null);
check("dcfPerShare rejects a zero share count", dcfPerShare(100, 0, 0.1) == null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
