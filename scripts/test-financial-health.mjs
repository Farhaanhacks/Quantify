#!/usr/bin/env node
// Tests for the financial-health model selection.
//
// Run: node scripts/test-financial-health.mjs
//
// The bug being pinned: Power Finance Corporation, an infrastructure lender,
// was labelled "Stretched" at 7.56x gearing because every company was judged by
// an industrial company's debt thresholds. A lender with no leverage has no
// business. The ratio was right; the yardstick was wrong, and raising the
// threshold would have hidden that rather than fixed it.
//
// So these tests are mostly about what must NOT be said:
//
//   • No lender or insurer may be given a good/warn/bad verdict on leverage.
//   • No insurance broker may be treated as an insurer: it carries no policy
//     reserves and no loan book, and is an ordinary company that sells
//     insurance.
//   • The sector alone may never promote a company out of the industrial model,
//     because "Financial Services" also holds exchanges and asset managers.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "finhealth-"));
execFileSync(
  "npx",
  ["tsc", join(root, "src/lib/financialHealth.ts"), "--outDir", out, "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler"],
  { stdio: "pipe" }
);
const {
  financialHealthModel,
  leverageVerdict,
  showsCashFlowCoverage,
  showsCashVersusDebt,
  MODEL_HEADINGS,
  EQUITY_ONLY_HEADING,
  isFinancialInstitutionModel,
  isLenderModel,
  isInsurerModel,
} = await import(join(out, "financialHealth.js"));
rmSync(out, { recursive: true, force: true });

let passed = 0;
let failed = 0;
const ok = (name, cond) => {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  FAIL: ${name}`);
  }
};

// ── Classification ──────────────────────────────────────────────────────────
//
// Three models were not enough. A bank funds itself with customer deposits and
// answers to a capital-adequacy regime; a non-bank lender mostly cannot take
// deposits at all and lives on wholesale funding it has to keep rolling. Giving
// PFC a bank's deposit-funding check would repeat the original bug one rung
// down — marking a company down for not being something it is not licensed to
// be.
{
  const banks = [
    "Banks—Regional",
    "Banks - Diversified",
    "Banks",
    "Thrifts & Mortgage Finance",
    "Savings & Cooperative Banks",
  ];
  for (const i of banks) ok(`${i} is a bank`, financialHealthModel(i) === "bank");

  const nbfcs = [
    "Credit Services",
    "Consumer Finance",
    "Mortgage Finance",
    "Specialty Finance",
    "Infrastructure Finance",
    "Development Finance",
    "Housing Finance",
    "Rental & Leasing Services",
  ];
  for (const i of nbfcs) ok(`${i} is a non-bank lender`, financialHealthModel(i) === "nbfc");
  // The case that started it: PFC is an infrastructure lender, not a bank.
  ok("PFC's industry is not a bank", financialHealthModel("Credit Services") !== "bank");
  ok("but it is a lender", isLenderModel(financialHealthModel("Credit Services")) === true);

  const life = ["Insurance—Life", "Insurance - Life", "Life Insurance"];
  for (const i of life) ok(`${i} is a life insurer`, financialHealthModel(i) === "life-insurer");

  const general = ["Insurance - Property & Casualty", "Insurance—Reinsurance", "Insurance—Diversified", "Insurance"];
  for (const i of general) ok(`${i} is a general insurer`, financialHealthModel(i) === "general-insurer");
  // Life must be tested before general, or "Insurance—Life" is swallowed whole.
  ok("a life insurer is not filed as general", financialHealthModel("Insurance—Life") !== "general-insurer");
  ok("both are insurers", isInsurerModel(financialHealthModel("Insurance—Life")) && isInsurerModel(financialHealthModel("Insurance")));
  ok("and neither is a lender", !isLenderModel(financialHealthModel("Insurance—Life")));

  const industrials = [
    "Semiconductors",
    "Software—Infrastructure",
    "Auto Manufacturers",
    "REIT—Retail",
    "Utilities—Regulated Electric",
    "Airlines",
    "Asset Management",
    "Capital Markets",
    "Financial Data & Stock Exchanges",
  ];
  for (const i of industrials) ok(`${i} is judged normally`, financialHealthModel(i) === "industrial");
  for (const i of industrials) ok(`${i} is not a financial institution`, isFinancialInstitutionModel(financialHealthModel(i)) === false);

  // The one that was wrong before: a broker is not an insurer.
  ok("Insurance Brokers is not an insurer", financialHealthModel("Insurance Brokers") === "industrial");
  ok("nor a lender", financialHealthModel("Insurance Brokers") !== "lender");

  // Case and spacing must not matter.
  ok("case-insensitive", financialHealthModel("CREDIT SERVICES") === "nbfc");
  ok("whitespace-insensitive", financialHealthModel("  Credit   Services  ") === "nbfc");

  // The sector alone cannot promote a company.
  ok("no industry means industrial", financialHealthModel(undefined, "Financial Services") === "industrial");
  ok("empty industry means industrial", financialHealthModel("", "Financial Services") === "industrial");
  ok("a sector never overrides", financialHealthModel("Semiconductors", "Financial Services") === "industrial");
}

// ── Verdicts ────────────────────────────────────────────────────────────────
{
  // Industrial: the thresholds are unchanged for the companies they suit.
  ok("0.3x is healthy", leverageVerdict(0.3, "industrial").verdict === "Healthy");
  ok("0.5x is still healthy", leverageVerdict(0.5, "industrial").verdict === "Healthy");
  ok("0.8x is manageable", leverageVerdict(0.8, "industrial").verdict === "Manageable");
  ok("1.0x is still manageable", leverageVerdict(1.0, "industrial").verdict === "Manageable");
  ok("2.0x is stretched", leverageVerdict(2.0, "industrial").verdict === "Stretched");
  ok("and toned bad", leverageVerdict(2.0, "industrial").tone === "bad");
  ok("healthy is toned good", leverageVerdict(0.3, "industrial").tone === "good");

  // The PFC case. 7.56x must produce a number and no adjective.
  const pfc = leverageVerdict(7.56, "nbfc");
  ok("a lender is never called stretched", pfc.verdict !== "Stretched");
  ok("nor healthy, nor manageable", pfc.verdict !== "Healthy" && pfc.verdict !== "Manageable");
  ok("the gearing itself is stated", pfc.verdict.includes("7.56"));
  ok("labelled as gearing", /gearing/i.test(pfc.verdict));
  ok("and toned neutral", pfc.tone === "neutral");
  ok("with a note naming what it should be read against", /capital adequacy/i.test(pfc.note));
  ok("which says where those figures live", /filings/i.test(pfc.note));

  // No level of gearing turns a lender's verdict red.
  for (const r of [0.5, 2, 7.56, 12, 40]) {
    for (const m of ["bank", "nbfc"]) {
      ok(`${r}x ${m} stays neutral`, leverageVerdict(r, m).tone === "neutral");
    }
  }

  const ins = leverageVerdict(0.4, "life-insurer");
  ok("an insurer is not scored either", ins.tone === "neutral");
  ok("with a note about policy reserves", /policy reserves/i.test(ins.note));

  // Nothing to compare.
  for (const m of ["industrial", "bank", "nbfc", "life-insurer", "general-insurer"]) {
    ok(`${m}: null ratio has no verdict`, leverageVerdict(null, m).verdict === null);
    ok(`${m}: undefined ratio has no verdict`, leverageVerdict(undefined, m).verdict === null);
    ok(`${m}: NaN has no verdict`, leverageVerdict(NaN, m).verdict === null);
    ok(`${m}: and is toned neutral`, leverageVerdict(null, m).tone === "neutral");
    ok(`${m}: with a reason`, leverageVerdict(null, m).note.length > 10);
  }
}

// ── Which warnings apply ────────────────────────────────────────────────────
{
  ok("cash-flow coverage is shown for industrials", showsCashFlowCoverage("industrial") === true);
  // The 1.5% warning. Money lent out is an operating outflow, so the ratio reads
  // worst exactly when the loan book is growing fastest.
  for (const m of ["bank", "nbfc", "life-insurer", "general-insurer"]) {
    ok(`and never for a ${m}`, showsCashFlowCoverage(m) === false);
  }

  ok("cash versus debt is shown for industrials", showsCashVersusDebt("industrial") === true);
  for (const m of ["bank", "nbfc", "life-insurer", "general-insurer"]) {
    ok(`and never for a ${m}`, showsCashVersusDebt(m) === false);
  }
}

// ── Headings ────────────────────────────────────────────────────────────────
{
  for (const m of ["industrial", "bank", "nbfc", "life-insurer", "general-insurer"]) {
    ok(`${m} has a heading`, typeof MODEL_HEADINGS[m]?.title === "string" && MODEL_HEADINGS[m].title.length > 0);
    ok(`${m} has a subtitle`, MODEL_HEADINGS[m].subtitle.length > 20);
    ok(`${m} heading has no em-dash`, !MODEL_HEADINGS[m].title.includes("—"));
  }
  ok("only the industrial heading claims a debt-to-equity history", /debt to equity/i.test(MODEL_HEADINGS.industrial.title));
  for (const m of ["bank", "nbfc", "life-insurer", "general-insurer"]) {
    ok(`a ${m}'s heading does not`, !/debt to equity/i.test(MODEL_HEADINGS[m].title));
  }
  // A bank's biggest liability is deposits, and the chart cannot show them.
  ok("a bank's subtitle says deposits are missing", /deposit/i.test(MODEL_HEADINGS.bank.subtitle));
  // The equity-only case must not claim to show debt at all.
  ok("the equity-only heading says equity", /equity/i.test(EQUITY_ONLY_HEADING.title));
  ok("and never says debt to equity", !/debt to equity/i.test(EQUITY_ONLY_HEADING.title));
  ok("its subtitle explains the gap", /not published|not available/i.test(EQUITY_ONLY_HEADING.subtitle));
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
