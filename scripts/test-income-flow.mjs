#!/usr/bin/env node
// Tests for the revenue-and-expenses flow.
//
// Run: node scripts/test-income-flow.mjs
//
// A Sankey states things by drawing them to scale, so its failure mode is not a
// wrong label but a wrong WIDTH, which nobody checks against the filing. These
// tests pin the properties that make the picture trustworthy:
//
//   • Conservation. Every node's outgoing ribbons sum to the node's own value.
//     A diagram that quietly loses a billion between two columns is worse than
//     no diagram, because it looks authoritative.
//   • Explicit remainders. Where named expenses fall short of their block, the
//     difference is its own visible "Other" flow, never spread across the named
//     ones to make them add up.
//   • Refusals. Negative gross profit cannot be drawn to scale, and a loss is
//     routed as a loss rather than left as a gap where earnings should be.
//   • Layout containment. Nothing may be laid out past the bottom of the canvas,
//     which is what happens when a column is scaled by its own total instead of
//     the fullest column's.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "incomeflow-"));
execFileSync(
  "npx",
  ["tsc", join(root, "src/lib/incomeFlow.ts"), "--outDir", out, "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler"],
  { stdio: "pipe" }
);
const {
  buildIncomeFlow,
  buildIndustrialIncomeFlow,
  buildBankIncomeFlow,
  buildSimplifiedBankFlow,
  buildInsuranceIncomeFlow,
  buildGenericIncomeFlow,
  buildFeeIncomeFlow,
  buildOperatingIncomeFlow,
  buildBurnIncomeFlow,
  buildFlowForModel,
  MODEL_TITLES,
  outflow,
  layoutFlow,
} = await import(join(out, "incomeFlow.js"));
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
const near = (name, a, b, eps = 1e-6) =>
  ok(`${name} (${a} ≈ ${b})`, a != null && Math.abs(a - b) < eps);

const node = (f, id) => f.nodes.find((n) => n.id === id);
const link = (f, from, to) => f.links.find((l) => l.from === from && l.to === to);

// AMD's shape, roughly: revenue 41.31b, gross 23.02b, earnings 6.47b.
const AMD = {
  revenue: 41.31e9,
  costOfRevenue: 18.29e9,
  grossProfit: 23.02e9,
  researchAndDevelopment: 9.39e9,
  sellingGeneralAdmin: 4.87e9,
  taxProvision: 0.62e9,
  nonOperatingInterest: -0.066e9,
  netIncome: 6.47e9,
};

// ── The ordinary case ───────────────────────────────────────────────────────
{
  const f = buildIncomeFlow(AMD);
  ok("builds", f.ok === true);
  ok("not a loss", f.loss === false);
  near("revenue node", node(f, "revenue").value, 41.31e9);
  near("gross profit node", node(f, "gross").value, 23.02e9);
  near("earnings node", node(f, "earnings").value, 6.47e9);
  near("expenses is gross minus earnings", node(f, "expenses").value, 23.02e9 - 6.47e9);

  // Conservation, the property the whole picture rests on.
  near("revenue splits exactly", outflow(f, "revenue"), 41.31e9);
  near("gross profit splits exactly", outflow(f, "gross"), 23.02e9);
  near("expenses split exactly", outflow(f, "expenses"), node(f, "expenses").value);
  ok("cost of sales is terminal", outflow(f, "cost") === 0);
  ok("earnings is terminal", outflow(f, "earnings") === 0);

  // The remainder is drawn, not absorbed.
  const named = 9.39e9 + 4.87e9 + 0.62e9 + 0.066e9;
  near("R&D is reported unchanged", node(f, "rnd").value, 9.39e9);
  near("SG&A is reported unchanged", node(f, "sga").value, 4.87e9);
  near("tax is reported unchanged", node(f, "tax").value, 0.62e9);
  near("non-operating uses magnitude, not sign", node(f, "nonop").value, 0.066e9);
  near("other is the visible remainder", node(f, "other").value, 23.02e9 - 6.47e9 - named);
  ok("nothing was reported as negative", f.nodes.every((n) => n.value >= 0));
  ok("no link is negative", f.links.every((l) => l.value >= 0));

  // Depths, so the columns read left to right.
  ok("revenue is column 0", node(f, "revenue").depth === 0);
  ok("gross and cost share column 1", node(f, "gross").depth === 1 && node(f, "cost").depth === 1);
  ok("earnings and expenses share column 2", node(f, "earnings").depth === 2 && node(f, "expenses").depth === 2);
  ok("the named expenses are column 3", node(f, "rnd").depth === 3);
  ok("nothing is marked derived", f.nodes.every((n) => !n.derived));
}

// ── Derivation, and saying so ───────────────────────────────────────────────
{
  const noGross = buildIncomeFlow({ ...AMD, grossProfit: undefined });
  near("gross profit derives from cost", node(noGross, "gross").value, 41.31e9 - 18.29e9);
  ok("and is marked derived", node(noGross, "gross").derived === true);
  ok("cost is not marked derived", node(noGross, "cost").derived === false || node(noGross, "cost").derived === undefined);

  const noCost = buildIncomeFlow({ ...AMD, costOfRevenue: undefined });
  near("cost derives from gross profit", node(noCost, "cost").value, 41.31e9 - 23.02e9);
  ok("and is marked derived", node(noCost, "cost").derived === true);

  const neither = buildIncomeFlow({ revenue: 100, netIncome: 10 });
  ok("neither one means no diagram", neither.ok === false);
  ok("with a reason", /gross profit or cost/.test(neither.reason));
}

// ── Refusals ────────────────────────────────────────────────────────────────
{
  const noRev = buildIncomeFlow({ grossProfit: 10, netIncome: 2 });
  ok("no revenue, no diagram", noRev.ok === false);
  ok("reason names revenue", /revenue/.test(noRev.reason));

  ok("zero revenue is refused", buildIncomeFlow({ revenue: 0, grossProfit: 1, netIncome: 1 }).ok === false);
  ok("negative revenue is refused", buildIncomeFlow({ revenue: -5, grossProfit: 1, netIncome: 1 }).ok === false);

  const negGross = buildIncomeFlow({ revenue: 100, grossProfit: -20, netIncome: -50 });
  ok("negative gross profit is refused", negGross.ok === false);
  ok("but is reported as a loss", negGross.loss === true);
  ok("with a reason about scale", /to scale/.test(negGross.reason));

  const noNet = buildIncomeFlow({ revenue: 100, grossProfit: 40 });
  ok("no net income, no diagram", noNet.ok === false);
  ok("reason names net income", /net income/.test(noNet.reason));
}

// ── A loss is drawn as a loss ───────────────────────────────────────────────
{
  const f = buildIncomeFlow({
    revenue: 1000,
    costOfRevenue: 700,
    grossProfit: 300,
    researchAndDevelopment: 250,
    sellingGeneralAdmin: 100,
    netIncome: -80,
  });
  ok("still builds", f.ok === true);
  ok("flagged as a loss", f.loss === true);
  ok("the node is named a loss", node(f, "earnings").label === "Net loss");
  ok("and is styled as one", node(f, "earnings").kind === "loss");
  near("the loss is drawn at its magnitude", node(f, "earnings").value, 80);
  near("expenses exceed gross profit by the loss", node(f, "expenses").value, 380);
  // The loss leaves the expense block, not gross profit: gross profit is 300 and
  // cannot emit 380.
  ok("no ribbon from gross profit to the loss", link(f, "gross", "earnings") === undefined);
  // The loss FUNDS the expense block rather than draining gross profit: 300 of
  // gross profit cannot pay 380 of costs.
  ok("the loss feeds expenses", link(f, "earnings", "expenses") !== undefined);
  near("at its full magnitude", link(f, "earnings", "expenses").value, 80);
  ok("and sits beside gross profit", node(f, "earnings").depth === 1);
  near("gross profit gives all it has", link(f, "gross", "expenses").value, 300);
  near("gross profit still splits exactly", outflow(f, "gross"), 300);
  near("expenses still split exactly", outflow(f, "expenses"), 380);
}

// ── Overlapping or oversized components ─────────────────────────────────────
{
  // R&D alone exceeds the expense block, which happens when Yahoo's lines
  // overlap. Scaling them to fit would misstate every one.
  const f = buildIncomeFlow({
    revenue: 1000,
    grossProfit: 300,
    researchAndDevelopment: 500,
    netIncome: 100,
  });
  ok("still builds", f.ok === true);
  ok("the oversized split is dropped", node(f, "rnd") === undefined);
  ok("and no remainder is invented", node(f, "other") === undefined);
  near("the expense total still balances", node(f, "expenses").value, 200);
  ok("which is then terminal", outflow(f, "expenses") === 0);

  // Exactly filling the block leaves no remainder to draw.
  const exact = buildIncomeFlow({
    revenue: 1000,
    grossProfit: 300,
    researchAndDevelopment: 120,
    sellingGeneralAdmin: 80,
    netIncome: 100,
  });
  near("named parts fill the block", outflow(exact, "expenses"), 200);
  ok("so there is no other node", node(exact, "other") === undefined);
  near("R&D unchanged", node(exact, "rnd").value, 120);

  // Zero and missing components are simply absent.
  const zeros = buildIncomeFlow({
    revenue: 1000, grossProfit: 300, researchAndDevelopment: 0, sellingGeneralAdmin: 150, netIncome: 100,
  });
  ok("a zero line is not a node", node(zeros, "rnd") === undefined);
  near("and the remainder covers it", node(zeros, "other").value, 50);

  // Everything profitable and no expense detail at all.
  const bare = buildIncomeFlow({ revenue: 1000, grossProfit: 300, netIncome: 300 });
  ok("no expenses means no expense node", node(bare, "expenses") === undefined);
  near("gross profit flows entirely to earnings", outflow(bare, "gross"), 300);
}

// ── Layout ──────────────────────────────────────────────────────────────────
{
  const f = buildIncomeFlow(AMD);
  const L = layoutFlow(f, { width: 800, height: 400, nodeWidth: 12, gap: 16 });
  ok("every node is laid out", L.nodes.length === f.nodes.length);
  ok("every link is laid out", L.links.length === f.links.length);
  ok("nothing starts above the canvas", L.nodes.every((n) => n.y >= -0.001));
  ok("nothing runs past the bottom", L.nodes.every((n) => n.y + n.height <= 400.001));
  ok("nothing runs past the right", L.nodes.every((n) => n.x <= 800 - 12 + 0.001));
  ok("revenue sits at the left edge", node(L, "revenue").x === 0);
  ok("column 3 sits at the right edge", Math.abs(node(L, "rnd").x - (800 - 12)) < 0.001);

  // One ruler for the whole picture: a node worth twice another is twice as tall.
  const r = node(L, "revenue");
  const g = node(L, "gross");
  near("heights are proportional to value", r.height / g.height, AMD.revenue / AMD.grossProfit, 1e-6);

  // Ribbons stack without crossing inside a node, and their thicknesses sum to
  // the node they leave.
  const fromRevenue = L.links.filter((l) => l.from === "revenue");
  near("ribbon thickness sums to the node height", fromRevenue.reduce((s, l) => s + l.thickness, 0), r.height, 1e-6);

  const empty = layoutFlow({ nodes: [], links: [], ok: false, loss: false }, { width: 500, height: 200 });
  ok("an empty flow lays out to nothing", empty.nodes.length === 0);
  ok("without dividing by zero", Number.isFinite(empty.width) && empty.width === 500);
}

// ── Banks: a different reporting structure, not missing data ────────────────
//
// The bug these cover: assuming revenue = cost of sales + gross profit for every
// business. A bank borrows at one rate and lends at another; it has no cost of
// sales, so the industrial builder rejected complete, valid statements. The
// tests below pin that the bank path never produces a gross profit or a cost of
// sales, and never reaches those by setting either to zero, which would render
// a picture whose accounting meaning is wrong.

// An Indian bank's account, in the statement's own order.
const BANK = {
  model: "bank",
  interestIncome: 1000,      // Interest Earned
  interestExpense: 600,      // Interest Expended
  nonInterestIncome: 200,    // Other Income
  operatingExpense: 250,     // Operating Expenses
  provisionForLoanLosses: 90, // Provisions and Contingencies
  pretaxIncome: 260,         // Profit Before Tax
  taxProvision: 65,
  netIncome: 195,            // Net Profit
  totalIncome: 1200,
};

{
  const f = buildBankIncomeFlow(BANK);
  ok("a bank statement builds", f.ok === true);
  ok("tagged as the bank model", f.model === "bank");
  ok("and is not flagged simplified", !f.simplified);

  // The lines a bank actually reports.
  near("interest earned", node(f, "interestIncome").value, 1000);
  near("interest expended", node(f, "interestExpense").value, 600);
  near("net interest income is derived from the two", node(f, "nii").value, 400);
  ok("and is marked derived", node(f, "nii").derived === true);
  near("other income", node(f, "otherIncome").value, 200);
  near("operating income is net interest plus other", node(f, "operatingIncome").value, 600);
  near("operating expenses", node(f, "opex").value, 250);
  near("pre-provision profit", node(f, "preprovision").value, 350);
  near("provisions", node(f, "provisions").value, 90);
  near("profit before tax", node(f, "pbt").value, 260);
  near("tax", node(f, "tax").value, 65);
  near("net profit", node(f, "netProfit").value, 195);

  // The thing that must never appear.
  ok("no gross profit node", node(f, "gross") === undefined);
  ok("no cost of sales node", node(f, "cost") === undefined);
  ok("no expenses block from the industrial model", node(f, "expenses") === undefined);
  ok("no R&D node", node(f, "rnd") === undefined);

  // Conservation, every step.
  near("interest earned splits exactly", outflow(f, "interestIncome"), 1000);
  near("net interest income flows on entirely", outflow(f, "nii"), 400);
  near("other income flows on entirely", outflow(f, "otherIncome"), 200);
  near("operating income splits exactly", outflow(f, "operatingIncome"), 600);
  near("pre-provision profit splits exactly", outflow(f, "preprovision"), 350);
  near("profit before tax splits exactly", outflow(f, "pbt"), 260);
  ok("interest expended is terminal", outflow(f, "interestExpense") === 0);
  ok("provisions are terminal", outflow(f, "provisions") === 0);
  ok("net profit is terminal", outflow(f, "netProfit") === 0);
  ok("nothing is negative", f.nodes.every((n) => n.value >= 0) && f.links.every((l) => l.value >= 0));

  // Provisions come AFTER operating expenses and on their own branch, which is
  // where the reporting standards put them.
  ok("provisions hang off pre-provision profit", link(f, "preprovision", "provisions") !== undefined);
  ok("not off operating income", link(f, "operatingIncome", "provisions") === undefined);
  ok("operating expenses hang off operating income", link(f, "operatingIncome", "opex") !== undefined);
  ok("provisions sit right of operating expenses", node(f, "provisions").depth > node(f, "opex").depth);
}

// ── Bank: reported net interest income wins over the derivation ─────────────
{
  const f = buildBankIncomeFlow({ ...BANK, netInterestIncome: 380 });
  near("the reported figure is used", node(f, "nii").value, 380);
  ok("and is not marked derived", !node(f, "nii").derived);
  // 1000 earned, 600 expended and a reported 380 do not reconcile. The 20 is
  // drawn as its own node rather than restating either reported figure.
  near("the difference is its own node", node(f, "interestOther").value, 20);
  ok("interest expended keeps its reported value", node(f, "interestExpense").value === 600);
  near("interest earned still splits exactly", outflow(f, "interestIncome"), 1000);

  // The other direction cannot be drawn as a split at all.
  const over = buildBankIncomeFlow({ ...BANK, netInterestIncome: 500 });
  ok("an over-full split drops the interest book", node(over, "interestIncome") === undefined);
  ok("and starts at net interest income", node(over, "nii").value === 500);
  near("which still flows on entirely", outflow(over, "nii"), 500);
}

// ── Bank: the account stops where the reporting stops ───────────────────────
{
  const noOpex = buildBankIncomeFlow({ ...BANK, operatingExpense: undefined });
  ok("still draws what it knows", noOpex.ok === true);
  ok("flagged simplified", noOpex.simplified === true);
  ok("stops at operating income", node(noOpex, "operatingIncome") !== undefined);
  ok("with no pre-provision profit", node(noOpex, "preprovision") === undefined);
  ok("and says why", /operating expenses/.test(noOpex.reason));
  near("what it drew still conserves", outflow(noOpex, "interestIncome"), 1000);

  const noProv = buildBankIncomeFlow({ ...BANK, provisionForLoanLosses: undefined, pretaxIncome: undefined });
  ok("without provisions or pre-tax it stops earlier", noProv.ok === true);
  ok("flagged simplified", noProv.simplified === true);
  ok("pre-provision profit is the last node", node(noProv, "preprovision") !== undefined);
  ok("no provisions node", node(noProv, "provisions") === undefined);

  // One of the two is enough: the other is the subtraction.
  const provOnly = buildBankIncomeFlow({ ...BANK, pretaxIncome: undefined });
  near("pre-tax derives from provisions", node(provOnly, "pbt").value, 260);
  const pbtOnly = buildBankIncomeFlow({ ...BANK, provisionForLoanLosses: undefined });
  near("provisions derive from pre-tax", node(pbtOnly, "provisions").value, 90);

  const noTax = buildBankIncomeFlow({ ...BANK, taxProvision: undefined, netIncome: undefined });
  ok("stops at profit before tax", node(noTax, "pbt") !== undefined && node(noTax, "tax") === undefined);
  ok("flagged simplified", noTax.simplified === true);
}

// ── Bank: refusals ──────────────────────────────────────────────────────────
{
  const nothing = buildBankIncomeFlow({ model: "bank" });
  ok("an empty bank statement is refused", nothing.ok === false);
  ok("with a reason about interest", /interest/.test(nothing.reason));

  const negSpread = buildBankIncomeFlow({ model: "bank", interestIncome: 100, interestExpense: 140 });
  ok("a negative spread is refused", negSpread.ok === false);
  ok("with a reason about scale", /to scale/.test(negSpread.reason));

  // Interest expended larger than earned cannot be drawn as a split, so the
  // interest book is dropped rather than drawn wrong.
  const odd = buildBankIncomeFlow({ ...BANK, netInterestIncome: 400, interestExpense: 1200 });
  ok("an impossible interest split is dropped", node(odd, "interestExpense") === undefined);
  ok("but the account still starts at net interest income", node(odd, "nii") !== undefined);
}

// ── Bank: reconciliation gaps are shown, not absorbed ───────────────────────
{
  // Provisions and pre-tax that do not reconcile: 350 - 90 - 200 leaves 60.
  const f = buildBankIncomeFlow({ ...BANK, pretaxIncome: 200, taxProvision: 50, netIncome: 150 });
  near("the gap is its own node", node(f, "otherItems").value, 60);
  near("pre-provision profit still splits exactly", outflow(f, "preprovision"), 350);
  ok("provisions were not inflated to close it", node(f, "provisions").value === 90);
  ok("pre-tax profit was not inflated either", node(f, "pbt").value === 200);
}

// ── Bank: the simplified bridge ─────────────────────────────────────────────
{
  const f = buildSimplifiedBankFlow({
    model: "bank",
    totalIncome: 1200,
    pretaxIncome: 260,
    taxProvision: 65,
    netIncome: 195,
  });
  ok("bridges income to profit", f.ok === true);
  ok("flagged simplified", f.simplified === true);
  near("total income", node(f, "totalIncome").value, 1200);
  near("the combined node is the whole subtraction", node(f, "combined").value, 940);
  ok("and is marked derived", node(f, "combined").derived === true);
  ok("it does not pretend to be operating expenses", node(f, "combined").label !== "Operating expenses");
  ok("no gross profit anywhere", node(f, "gross") === undefined);
  near("total income splits exactly", outflow(f, "totalIncome"), 1200);
  near("profit before tax splits exactly", outflow(f, "pbt"), 260);

  const tooLittle = buildSimplifiedBankFlow({ model: "bank", totalIncome: 1200 });
  ok("without a pre-tax figure there is no bridge", tooLittle.ok === false);
  ok("and it is still tagged as a bank", tooLittle.model === "bank");
}

// ── The dispatcher ──────────────────────────────────────────────────────────
{
  const bank = buildFlowForModel(BANK);
  ok("a bank goes to the bank builder", bank.model === "bank");
  ok("and gets the detailed flow", bank.simplified !== true);

  // A bank with only the summary lines falls back WITHIN the bank family.
  const thin = buildFlowForModel({ model: "bank", totalIncome: 1200, pretaxIncome: 260, taxProvision: 65, netIncome: 195 });
  ok("a thin bank statement still builds", thin.ok === true);
  ok("as a bank, never as an industrial", thin.model === "bank");
  ok("no gross profit was invented", node(thin, "gross") === undefined);
  ok("no cost of sales was invented", node(thin, "cost") === undefined);

  const industrial = buildFlowForModel({ ...AMD, model: "industrial" });
  ok("an industrial goes to the industrial builder", industrial.model === "industrial");
  near("and is unchanged", node(industrial, "gross").value, 23.02e9);

  // No model named is the industrial default, which is what every existing
  // caller relies on.
  const legacy = buildFlowForModel(AMD);
  ok("an unlabelled statement is industrial", legacy.model === "industrial");
  ok("buildIncomeFlow is still the industrial builder", buildIncomeFlow === buildIndustrialIncomeFlow);
}

// ── Bank layout ─────────────────────────────────────────────────────────────
{
  const L = layoutFlow(buildBankIncomeFlow(BANK), { width: 900, height: 400, nodeWidth: 12, gap: 16 });
  ok("every bank node is laid out", L.nodes.length === buildBankIncomeFlow(BANK).nodes.length);
  ok("nothing runs past the bottom", L.nodes.every((n) => n.y + n.height <= 400.001));
  ok("nothing runs past the right", L.nodes.every((n) => n.x <= 900 - 12 + 0.001));
  // Operating income takes TWO inflows; their thicknesses must fill it exactly
  // or the ribbons will not meet the node they arrive at.
  const into = L.links.filter((l) => l.to === "operatingIncome");
  ok("two ribbons arrive at operating income", into.length === 2);
  near(
    "and together they fill it",
    into.reduce((s, l) => s + l.thickness, 0),
    node(L, "operatingIncome").height,
    1e-6
  );
}

// ── Insurance: premiums in, claims out ──────────────────────────────────────
//
// The same class of bug as the bank case, one industry over. An insurer sells a
// promise and pays for it later: money arrives as premiums and as the return on
// the float, and leaves as claims. There is no cost of sales and no gross
// profit, and the diagram must not manufacture either.

const INSURER = {
  model: "insurance",
  premiumsEarned: 800,
  netInvestmentIncome: 200,
  totalRevenue: 1000,
  claimsIncurred: 560,
  underwritingExpense: 240,
  pretaxIncome: 150,
  taxProvision: 40,
  netIncome: 110,
};

{
  const f = buildInsuranceIncomeFlow(INSURER);
  ok("an insurer builds", f.ok === true);
  ok("tagged as the insurance model", f.model === "insurance");
  ok("and is not flagged simplified", !f.simplified);

  near("premiums earned", node(f, "premiums").value, 800);
  near("investment income", node(f, "investment").value, 200);
  near("total revenue", node(f, "revenue").value, 1000);
  near("claims incurred", node(f, "claims").value, 560);
  near("underwriting expenses", node(f, "underwriting").value, 240);
  near("profit before tax", node(f, "pbt").value, 150);
  near("tax", node(f, "tax").value, 40);
  near("net profit", node(f, "netProfit").value, 110);
  near("the unnamed remainder is drawn", node(f, "otherCosts").value, 1000 - 150 - 800);

  ok("no gross profit node", node(f, "gross") === undefined);
  ok("no cost of sales node", node(f, "cost") === undefined);
  ok("no interest book", node(f, "interestIncome") === undefined && node(f, "nii") === undefined);
  ok("no loan-loss provisions", node(f, "provisions") === undefined);

  near("premiums flow on entirely", outflow(f, "premiums"), 800);
  near("investment income flows on entirely", outflow(f, "investment"), 200);
  near("revenue splits exactly", outflow(f, "revenue"), 1000);
  near("profit before tax splits exactly", outflow(f, "pbt"), 150);
  ok("claims are terminal", outflow(f, "claims") === 0);
  ok("nothing is negative", f.nodes.every((n) => n.value >= 0) && f.links.every((l) => l.value >= 0));
}

// ── Insurance: partial and awkward inputs ───────────────────────────────────
{
  // Components that do not add to the reported total leave a visible remainder
  // rather than restating either.
  const f = buildInsuranceIncomeFlow({ ...INSURER, totalRevenue: 1100 });
  near("the revenue gap is its own node", node(f, "otherRevenue").value, 100);
  near("revenue still receives exactly its value", 
    f.links.filter((l) => l.to === "revenue").reduce((s, l) => s + l.value, 0), 1100);

  // No component split at all: the account starts at total revenue.
  const totalOnly = buildInsuranceIncomeFlow({
    model: "insurance", totalRevenue: 1000, claimsIncurred: 560, underwritingExpense: 240,
    pretaxIncome: 150, taxProvision: 40, netIncome: 110,
  });
  ok("starts at total revenue", node(totalOnly, "premiums") === undefined);
  ok("which is column 0", node(totalOnly, "revenue").depth === 0);
  near("and still splits exactly", outflow(totalOnly, "revenue"), 1000);

  // Named costs that exceed what is available collapse to one derived block
  // rather than being scaled to fit.
  const oversized = buildInsuranceIncomeFlow({ ...INSURER, claimsIncurred: 2000 });
  ok("the oversized split is dropped", node(oversized, "claims") === undefined);
  ok("one derived block stands in", node(oversized, "otherCosts").derived === true);
  ok("flagged simplified", oversized.simplified === true);
  near("and it still conserves", outflow(oversized, "revenue"), 1000);

  // Pre-tax reconstructed from net income and tax.
  const noPbt = buildInsuranceIncomeFlow({ ...INSURER, pretaxIncome: undefined });
  near("pre-tax derives from net plus tax", node(noPbt, "pbt").value, 150);

  const noRevenue = buildInsuranceIncomeFlow({ model: "insurance", pretaxIncome: 10 });
  ok("no premiums and no revenue is refused", noRevenue.ok === false);
  ok("with a reason", /premiums or total revenue/.test(noRevenue.reason));

  const impossible = buildInsuranceIncomeFlow({ ...INSURER, pretaxIncome: 5000 });
  ok("profit larger than revenue is refused", impossible.ok === false);
  ok("with a reason about scale", /to scale/.test(impossible.reason));
}

// ── The generic bridge: nobody is rejected for having a different statement ──
{
  const f = buildGenericIncomeFlow({ revenue: 1000, pretaxIncome: 200, taxProvision: 50, netIncome: 150 });
  ok("bridges", f.ok === true);
  ok("tagged generic", f.model === "generic");
  ok("always flagged simplified", f.simplified === true);
  near("revenue", node(f, "revenue").value, 1000);
  near("the combined block is the whole subtraction", node(f, "combined").value, 800);
  ok("marked derived", node(f, "combined").derived === true);
  ok("and never given a real line's name", node(f, "combined").label === "Costs and expenses");
  ok("no gross profit", node(f, "gross") === undefined);
  ok("no cost of sales", node(f, "cost") === undefined);
  near("revenue splits exactly", outflow(f, "revenue"), 1000);
  near("profit before tax splits exactly", outflow(f, "pbt"), 200);
  near("net profit", node(f, "netProfit").value, 150);

  // Tax reconstructed from the gap between pre-tax and net.
  const noTax = buildGenericIncomeFlow({ revenue: 1000, pretaxIncome: 200, netIncome: 150 });
  near("tax derives from the difference", node(noTax, "tax").value, 50);

  // Only a top line and a profit: still a diagram.
  const bare = buildGenericIncomeFlow({ revenue: 1000, netIncome: 150 });
  ok("a top line and a profit are enough", bare.ok === true);
  near("and it conserves", outflow(bare, "revenue"), 1000);

  const noTop = buildGenericIncomeFlow({ netIncome: 150 });
  ok("without a top line there is nothing to bridge", noTop.ok === false);
  ok("with a reason", /top line/.test(noTop.reason));

  const overProfit = buildGenericIncomeFlow({ revenue: 100, pretaxIncome: 500 });
  ok("profit larger than revenue is refused", overProfit.ok === false);

  const labelled = buildGenericIncomeFlow({ revenue: 1000, pretaxIncome: 200, netIncome: 150 }, { combinedLabel: "Claims and expenses", model: "insurance" });
  ok("the caller can name the block", node(labelled, "combined").label === "Claims and expenses");
  ok("and keep its own model", labelled.model === "insurance");
}

// ── The dispatcher never substitutes one industry's model for another ───────
{
  const insurance = buildFlowForModel(INSURER);
  ok("an insurer goes to the insurance builder", insurance.model === "insurance");
  ok("with premiums drawn", node(insurance, "premiums") !== undefined);

  // An insurer with only totals falls back to the bridge, still as an insurer.
  const thinInsurer = buildFlowForModel({ model: "insurance", totalRevenue: 1000, pretaxIncome: 150, taxProvision: 40, netIncome: 110 });
  ok("still builds", thinInsurer.ok === true);
  ok("still an insurer, never an industrial", thinInsurer.model === "insurance");
  ok("no gross profit was invented", node(thinInsurer, "gross") === undefined);

  // A bank with nothing but totals: bridge, tagged bank.
  const thinBank = buildFlowForModel({ model: "bank", totalIncome: 1200, pretaxIncome: 260, taxProvision: 65, netIncome: 195 });
  ok("a thin bank still builds", thinBank.ok === true);
  ok("tagged bank", thinBank.model === "bank");
  ok("with no cost of sales", node(thinBank, "cost") === undefined);

  // The rows that used to be rejected outright.
  const reit = buildFlowForModel({ revenue: 500, pretaxIncome: 120, taxProvision: 20, netIncome: 100 });
  ok("a company with no gross profit or cost of sales still draws", reit.ok === true);
  ok("as the generic bridge", reit.model === "generic");
  near("and it conserves", outflow(reit, "revenue"), 500);

  const incomplete = buildFlowForModel({ revenue: 500, netIncome: 100 });
  ok("an incomplete feed still draws", incomplete.ok === true);
  ok("as the generic bridge", incomplete.model === "generic");

  // An industrial company with the full lines is unaffected by any of it.
  const industrial = buildFlowForModel(AMD);
  ok("a full industrial statement still uses the industrial model", industrial.model === "industrial");
  near("with its gross profit intact", node(industrial, "gross").value, 23.02e9);
  ok("and is not flagged simplified", !industrial.simplified);

  // Nothing at all is still a refusal: there is no diagram for no data.
  const nothing = buildFlowForModel({});
  ok("an empty statement is refused", nothing.ok === false);
}

// ── Non-bank lenders ────────────────────────────────────────────────────────
//
// An NBFC runs a bank's cascade without a bank's funding. Same identities, and
// the filing's own words: finance costs rather than interest expended,
// impairment charges rather than provisions and contingencies.
{
  const f = buildBankIncomeFlow({ ...BANK, model: "lender" });
  ok("builds", f.ok === true);
  ok("tagged lender, not bank", f.model === "lender");
  ok("the top line is interest income", node(f, "interestIncome").label === "Interest income");
  ok("funding is a finance cost", node(f, "interestExpense").label === "Finance costs");
  ok("and the charge is an impairment", node(f, "provisions").label === "Impairment charges");
  ok("nothing says loan-loss provisions", f.nodes.every((n) => n.label !== "Loan-loss provisions"));
  ok("nothing says interest expended", f.nodes.every((n) => n.label !== "Interest expended"));
  // The arithmetic is untouched by the vocabulary.
  const bank = buildBankIncomeFlow(BANK);
  ok("the same values as the bank cascade", f.nodes.every((n, i) => Math.abs(n.value - bank.nodes[i].value) < 1e-9));
  near("and it still conserves", outflow(f, "interestIncome"), 1000);
  ok("dispatches to itself", buildFlowForModel({ ...BANK, model: "lender" }).model === "lender");
}

// ── Fee businesses: brokers, managers, insurance BROKERS ────────────────────
{
  const FEE = {
    model: "fee",
    feeIncome: 900,
    otherIncome: 100,
    compensation: 500,
    operatingExpense: 200,
    pretaxIncome: 250,
    taxProvision: 60,
    netIncome: 190,
  };
  const f = buildFeeIncomeFlow(FEE);
  ok("builds", f.ok === true);
  ok("tagged fee", f.model === "fee");
  near("fee income", node(f, "fees").value, 900);
  near("other income", node(f, "otherIncome").value, 100);
  near("total revenue", node(f, "revenue").value, 1000);
  near("compensation", node(f, "comp").value, 500);
  near("other operating expenses", node(f, "opex").value, 200);
  near("the remainder is drawn", node(f, "residual").value, 1000 - 250 - 700);
  near("profit before tax", node(f, "pbt").value, 250);
  near("net profit", node(f, "netProfit").value, 190);

  // The point of the model: a broker underwrites nothing.
  ok("no claims line", node(f, "claims") === undefined);
  ok("no premiums line", node(f, "premiums") === undefined);
  ok("no gross profit", node(f, "gross") === undefined);
  ok("no cost of sales", node(f, "cost") === undefined);

  near("revenue splits exactly", outflow(f, "revenue"), 1000);
  near("profit before tax splits exactly", outflow(f, "pbt"), 250);
  near("fee income flows on entirely", outflow(f, "fees"), 900);

  // Named costs that do not fit collapse to one block rather than being scaled.
  const oversized = buildFeeIncomeFlow({ ...FEE, compensation: 5000 });
  ok("the oversized split is dropped", node(oversized, "comp") === undefined);
  ok("one derived block stands in", node(oversized, "residual").derived === true);
  ok("flagged simplified", oversized.simplified === true);
  near("and it still conserves", outflow(oversized, "revenue"), 1000);

  const noProfit = buildFeeIncomeFlow({ model: "fee", feeIncome: 900 });
  ok("without a profit figure there is no diagram", noProfit.ok === false);
  ok("but it is still tagged fee", noProfit.model === "fee");
}

// ── Operating businesses: REITs, utilities, transport ───────────────────────
{
  const REIT = {
    model: "operating",
    revenue: 1000,
    operatingExpense: 600,
    sellingGeneralAdmin: 150,
    depreciation: 300,
    operatingIncome: 400,
    pretaxIncome: 250,
    taxProvision: 50,
    netIncome: 200,
  };
  const f = buildOperatingIncomeFlow(REIT);
  ok("builds", f.ok === true);
  ok("tagged operating", f.model === "operating");
  ok("and is not flagged simplified", !f.simplified);
  near("revenue", node(f, "revenue").value, 1000);
  near("operating expenses", node(f, "opex").value, 600);
  near("operating income", node(f, "operating").value, 400);
  near("selling, general & admin", node(f, "sga").value, 150);
  near("depreciation", node(f, "dna").value, 300);
  near("the rest of the cost base is drawn", node(f, "otherOpex").value, 150);
  near("profit before tax", node(f, "pbt").value, 250);
  // The gap between operating income and pre-tax is the interest bill, which
  // for a leveraged REIT or utility is most of the story.
  near("interest and other is named", node(f, "interest").value, 150);
  near("net profit", node(f, "netProfit").value, 200);

  ok("no gross profit", node(f, "gross") === undefined);
  ok("no cost of sales", node(f, "cost") === undefined);

  near("revenue splits exactly", outflow(f, "revenue"), 1000);
  near("operating expenses split exactly", outflow(f, "opex"), 600);
  near("operating income splits exactly", outflow(f, "operating"), 400);
  near("profit before tax splits exactly", outflow(f, "pbt"), 250);

  // Operating income derived from the expense line, and marked.
  const derived = buildOperatingIncomeFlow({ ...REIT, operatingIncome: undefined });
  near("operating income derives from the expenses", node(derived, "operating").value, 400);
  ok("and is marked derived", node(derived, "operating").derived === true);

  // Neither published: no two-stage shape to draw.
  const neither = buildOperatingIncomeFlow({ model: "operating", revenue: 1000, pretaxIncome: 250, netIncome: 200 });
  ok("without either line there is no operating split", neither.ok === false);
  ok("with a reason", /operating income or operating expense/.test(neither.reason));
  // ... and the dispatcher still draws something for it.
  const viaDispatch = buildFlowForModel({ model: "operating", revenue: 1000, pretaxIncome: 250, netIncome: 200 });
  ok("the dispatcher falls back to the bridge", viaDispatch.ok === true);
  ok("keeping the operating model's name", viaDispatch.model === "operating");
  ok("labelled as operating costs", node(viaDispatch, "combined").label === "Operating costs");
}

// ── Burn: pre-revenue biotech, SPACs, anything losing money ─────────────────
{
  const BIOTECH = {
    model: "burn",
    revenue: 0,
    otherIncome: 20,
    researchAndDevelopment: 200,
    sellingGeneralAdmin: 80,
    netIncome: -260,
  };
  const f = buildBurnIncomeFlow(BIOTECH);
  ok("a company with no revenue still draws", f.ok === true);
  ok("tagged burn", f.model === "burn");
  ok("flagged as a loss", f.loss === true);
  near("interest and other income", node(f, "otherIncome").value, 20);
  near("the loss", node(f, "netLoss").value, 260);
  near("total costs are income plus the loss", node(f, "costs").value, 280);
  near("research & development", node(f, "rnd").value, 200);
  near("general & administrative", node(f, "sga").value, 80);
  ok("no revenue node, because there is no revenue", node(f, "revenue") === undefined);
  ok("no gross profit", node(f, "gross") === undefined);
  ok("no profit before tax", node(f, "pbt") === undefined);

  // The loss FUNDS the costs; nothing emits more than it holds.
  near("the loss flows into the cost block", outflow(f, "netLoss"), 260);
  near("costs split exactly", outflow(f, "costs"), 280);
  near("and are funded exactly", f.links.filter((l) => l.to === "costs").reduce((s, l) => s + l.value, 0), 280);

  // With some revenue, it becomes a third source.
  const withRev = buildBurnIncomeFlow({ ...BIOTECH, revenue: 50, netIncome: -210 });
  near("revenue is a source", node(withRev, "revenue").value, 50);
  near("and the total is unchanged", node(withRev, "costs").value, 280);
  near("still funded exactly", withRev.links.filter((l) => l.to === "costs").reduce((s, l) => s + l.value, 0), 280);

  // A SPAC: trust interest, a little admin, a small loss.
  const spac = buildBurnIncomeFlow({ model: "burn", otherIncome: 12, sellingGeneralAdmin: 15, netIncome: -3 });
  ok("a SPAC draws", spac.ok === true);
  near("its costs are interest plus the loss", node(spac, "costs").value, 15);
  near("which the admin line fills", node(spac, "sga").value, 15);

  const profitable = buildBurnIncomeFlow({ ...BIOTECH, netIncome: 50 });
  ok("a profitable company is not a burn", profitable.ok === false);
  ok("with a reason", /at a loss/.test(profitable.reason));
}

// ── The dispatcher covers what used to be rejected ──────────────────────────
{
  // A loss-making company with no revenue: every revenue model refuses, and the
  // burn diagram answers the question that is still askable.
  const preRevenue = buildFlowForModel({
    researchAndDevelopment: 200, sellingGeneralAdmin: 80, netIncome: -280,
  });
  ok("a pre-revenue company draws something", preRevenue.ok === true);
  ok("as the burn model", preRevenue.model === "burn");
  near("with its research spending named", node(preRevenue, "rnd").value, 200);

  // A loss-making bank keeps its own model rather than falling to industrial.
  const lossBank = buildFlowForModel({
    model: "bank", totalIncome: 1000, interestIncome: 900, interestExpense: 600,
    researchAndDevelopment: undefined, netIncome: -50,
  });
  ok("a loss-making bank draws something", lossBank.ok === true);
  ok("and never becomes an industrial", lossBank.model !== "industrial");
  ok("with no cost of sales", node(lossBank, "cost") === undefined);

  // An insurance broker must not be given a claims line.
  const broker = buildFlowForModel({
    model: "fee", feeIncome: 500, compensation: 300, pretaxIncome: 120, taxProvision: 30, netIncome: 90,
  });
  ok("a broker draws", broker.ok === true);
  ok("as a fee business", broker.model === "fee");
  ok("with no claims", node(broker, "claims") === undefined);
  ok("and no premiums", node(broker, "premiums") === undefined);

  // The industrial path is untouched by any of it.
  const industrial2 = buildFlowForModel(AMD);
  ok("a full industrial statement is unchanged", industrial2.model === "industrial");
  near("gross profit intact", node(industrial2, "gross").value, 23.02e9);
}

// ── Titles travel with the model ────────────────────────────────────────────
{
  const MODELS = ["industrial", "bank", "lender", "insurance", "fee", "operating", "burn", "generic"];
  ok("every model has a title", MODELS.every((m) => typeof MODEL_TITLES[m] === "string" && MODEL_TITLES[m].length > 0));
  ok("the bank title says bank", /bank/i.test(MODEL_TITLES.bank));
  ok("the insurance title says insurance", /insurance/i.test(MODEL_TITLES.insurance));
  ok("the industrial title is the revenue one", /revenue/i.test(MODEL_TITLES.industrial));
  ok("titles are distinct", new Set(Object.values(MODEL_TITLES)).size === MODELS.length);
  ok("the registry has no extra entries", Object.keys(MODEL_TITLES).length === MODELS.length);
  ok("no em-dashes in the titles", Object.values(MODEL_TITLES).every((t) => !t.includes("—")));
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
