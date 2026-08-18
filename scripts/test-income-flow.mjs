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
const { buildIncomeFlow, outflow, layoutFlow } = await import(join(out, "incomeFlow.js"));
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

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
