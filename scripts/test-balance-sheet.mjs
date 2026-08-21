#!/usr/bin/env node
// Tests for the sector-specific balance-sheet checklists.
//
// Run: node scripts/test-balance-sheet.mjs
//
// The bug being pinned: HDFC Bank scored 0/10 on Balance Sheet Strength and was
// labelled "Fragile", because every company was measured against a
// manufacturer's balance sheet — current ratio above 1, debt/equity below 1x,
// more cash than debt. A bank fails all three by construction. Its liabilities
// are demand deposits, it is levered eight to ten times because that is what a
// bank IS, and it holds little cash because cash earns nothing. The score was
// measuring the distance between a bank and a factory.
//
// Two faults, and fixing either alone still leaves a wrong number on screen:
//
//   1. The wrong checklist, fixed by choosing it from the industry.
//   2. Missing data counted as failure, fixed by giving a check three states.
//
// So most of what follows is about what must NOT happen: no industrial check
// may reach a financial institution, no absent metric may become a red cross,
// and no bank may be scored on a third of its picture.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "balancesheet-"));
execFileSync(
  "npx",
  [
    "tsc",
    join(root, "src/lib/balanceSheet.ts"),
    // Compiled alongside so the end-to-end path can be tested: an industry
    // string from the feed, through the classifier, into the checklist it picks.
    // Neither file imports the other — that is why each can be driven from a
    // script at all — so the join only happens here.
    join(root, "src/lib/financialHealth.ts"),
    "--outDir", out, "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler",
  ],
  { stdio: "pipe" }
);
const {
  evaluate,
  ratio,
  scoreFromChecks,
  balanceSheetAxis,
  bankChecks,
  nbfcChecks,
  lifeInsurerChecks,
  generalInsurerChecks,
  industrialChecks,
  INDUSTRIAL_ONLY_LABELS,
  PCR_SPECIFIC,
  PCR_TOTAL,
  DOMAIN,
} = await import(join(out, "balanceSheet.js"));
const { financialHealthModel } = await import(join(out, "financialHealth.js"));
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

const at = (value, extra = {}) => ({ value, asOf: "2025-03-31", scope: "consolidated", ...extra });
const labels = (checks) => checks.map((c) => c.label.toLowerCase()).join(" | ");
const statuses = (checks) => checks.map((c) => c.status);

// ── A check has three outcomes ──────────────────────────────────────────────
{
  const spec = { label: "Something above 1", threshold: "> 1", test: (v) => v > 1 };
  ok("a met threshold passes", evaluate(spec, at(2)).status === "pass");
  ok("an unmet threshold fails", evaluate(spec, at(0.5)).status === "fail");
  // The heart of it: absent is not failed.
  ok("no metric is unavailable", evaluate(spec, undefined).status === "unavailable");
  ok("an empty metric is unavailable", evaluate(spec, {}).status === "unavailable");
  ok("and not a failure", evaluate(spec, undefined).status !== "fail");
  ok("a NaN is unavailable", evaluate(spec, at(NaN)).status === "unavailable");
  ok("an infinity is unavailable", evaluate(spec, at(Infinity)).status === "unavailable");
  ok("zero is a real value, not a missing one", evaluate(spec, at(0)).status === "fail");
  ok("an unavailable check says why", evaluate(spec, undefined).unavailableReason.length > 5);
  ok("and carries no value", evaluate(spec, undefined).value === undefined);
  // Provenance travels with the check, so the reader can see what was judged.
  const withSource = evaluate(spec, at(2, { source: "FY25 annual report", sourceUrl: "https://example.invalid/ar", definition: "x / y", derived: true }));
  ok("the reporting date is kept", withSource.asOf === "2025-03-31");
  ok("the scope is kept", withSource.scope === "consolidated");
  ok("the source is kept", withSource.source === "FY25 annual report");
  ok("the source URL is kept", withSource.sourceUrl === "https://example.invalid/ar");
  ok("the definition is kept", withSource.definition === "x / y");
  ok("and whether we derived it", withSource.derived === true);
  ok("the value that was judged is kept", withSource.value === 2);
  ok("as is the threshold it was judged against", withSource.threshold === "> 1");
}

// ── Periods and scopes are never mixed ──────────────────────────────────────
//
// A loans-to-deposits ratio built from a September loan book and a March
// deposit base is not a loosely-dated ratio, it is a different number: a bank
// that grew its book 15% in between reads as far more loaned-up than it is.
{
  const march = { value: 100, asOf: "2025-03-31", scope: "consolidated" };
  const alsoMarch = { value: 50, asOf: "2025-03-31", scope: "consolidated" };
  const september = { value: 50, asOf: "2024-09-30", scope: "consolidated" };
  const standalone = { value: 50, asOf: "2025-03-31", scope: "standalone" };

  const good = ratio(march, alsoMarch, { definition: "a / b" });
  ok("matching dates and scope divide", good.value === 2);
  ok("the result is marked derived", good.derived === true);
  ok("and carries the definition", good.definition === "a / b");
  ok("and the reporting date", good.asOf === "2025-03-31");

  ok("dates too far apart refuse", ratio(march, september, { definition: "a / b" }).value === undefined);
  ok("and say so", /dates/i.test(ratio(march, september, { definition: "a / b" }).unavailableReason));
  ok("mixed scopes refuse", ratio(march, standalone, { definition: "a / b" }).value === undefined);
  ok("and say so", /scope/i.test(ratio(march, standalone, { definition: "a / b" }).unavailableReason));
  // A quarter apart is the same reporting season, and is allowed.
  ok("a quarter apart is fine", ratio(march, { value: 50, asOf: "2025-01-31", scope: "consolidated" }, { definition: "a / b" }).value === 2);
  ok("a missing input refuses", ratio(march, undefined, { definition: "a / b" }).value === undefined);
  ok("a zero denominator refuses", ratio(march, { value: 0 }, { definition: "a / b" }).value === undefined);
  ok("undated figures are allowed through", ratio({ value: 100 }, { value: 50 }, { definition: "a / b" }).value === 2);
  // Refusing produces an unavailable check, never a failed one.
  ok("a refusal becomes unavailable, not failed",
    evaluate({ label: "x", threshold: "> 1", test: (v) => v > 1 }, ratio(march, september, { definition: "a / b" })).status === "unavailable");
}

// ── Scoring counts only what was evaluated ──────────────────────────────────
{
  const mk = (n, status) => Array.from({ length: n }, (_, i) => ({ label: `c${i}`, status }));

  const allPass = scoreFromChecks(mk(4, "pass"), { minimumEvaluated: 2, domains: [], subject: "bank" });
  ok("all passed is full marks", allPass.score === 6);
  ok("and is sufficient", allPass.sufficient === true);

  const half = scoreFromChecks([...mk(2, "pass"), ...mk(2, "fail")], { minimumEvaluated: 2, domains: [], subject: "bank" });
  ok("half passed is half marks", half.score === 3);

  // The 0/10 bug: eight checks, none sourced, scored zero out of eight.
  const none = scoreFromChecks(mk(8, "unavailable"), { minimumEvaluated: 4, domains: [], subject: "bank" });
  ok("nothing sourced is not a score", none.sufficient === false);
  ok("and says insufficient", /insufficient/i.test(none.unavailableNote));
  ok("naming the subject", /bank/i.test(none.unavailableNote));
  ok("and how much was found", /0 of 8/.test(none.unavailableNote));

  // Below the bar: still not a score, however well the sourced ones did.
  const thin = scoreFromChecks([...mk(2, "pass"), ...mk(6, "unavailable")], { minimumEvaluated: 4, domains: [], subject: "bank" });
  ok("two of eight is still insufficient", thin.sufficient === false);
  ok("and is called partial, because something WAS measured", /partial/i.test(thin.unavailableNote));
  ok("even though both passed", thin.checks.filter((c) => c.status === "pass").length === 2);

  // At the bar: scored over the evaluated ones, not diluted by the absent ones.
  const enough = scoreFromChecks([...mk(4, "pass"), ...mk(4, "unavailable")], { minimumEvaluated: 4, domains: [], subject: "bank" });
  ok("four of eight, all passing, is sufficient", enough.sufficient === true);
  ok("and scores full marks, not half", enough.score === 6);

  const mixed = scoreFromChecks([...mk(2, "pass"), ...mk(2, "fail"), ...mk(4, "unavailable")], { minimumEvaluated: 4, domains: [], subject: "bank" });
  ok("two of four evaluated is half marks", mixed.score === 3);
  ok("the unavailable ones are still listed", mixed.checks.length === 8);
}

// ── No industrial check ever reaches a financial institution ────────────────
{
  const industrial = labels(industrialChecks({}));
  for (const term of INDUSTRIAL_ONLY_LABELS) {
    ok(`an industrial company IS asked about ${term}`, industrial.includes(term));
  }

  for (const model of ["bank", "nbfc", "life-insurer", "general-insurer"]) {
    const text = labels(balanceSheetAxis(model, {}).checks);
    for (const term of INDUSTRIAL_ONLY_LABELS) {
      ok(`a ${model} is never asked about ${term}`, !text.includes(term));
    }
    ok(`a ${model} is not asked about a current ratio`, !/current ratio/.test(text));
    ok(`nor about cash exceeding debt`, !/more cash than/.test(text));
  }
}

// ── The bank checklist ──────────────────────────────────────────────────────
{
  const text = labels(bankChecks({}));
  for (const term of ["gross npa", "net npa", "provision coverage", "deposit", "loan book", "asset mix", "leverage", "regulatory minimum"]) {
    ok(`a bank is asked about ${term}`, text.includes(term));
  }
  ok("eight measures", bankChecks({}).length === 8);
  ok("and none of them is sourced by default", statuses(bankChecks({})).every((s) => s === "unavailable"));

  // HDFC Bank's own shape: low bad loans, high coverage, deposit-led funding,
  // ~7.9x assets to equity. It must score strongly — computed from the figures,
  // never forced.
  const hdfc = bankChecks({
    grossNpaRatio: at(0.0133, { definition: "gross NPAs / gross advances" }),
    netNpaRatio: at(0.0043),
    provisionCoverage: at(1.71, { definition: PCR_TOTAL }),
    depositFunding: at(0.74),
    loansToDeposits: at(0.98),
    loansToAssets: at(0.63),
    assetsToEquity: at(7.9),
    capitalBufferPoints: at(0.075),
  });
  const axis = scoreFromChecks(hdfc, { minimumEvaluated: 4, domains: [], subject: "bank" });
  ok("a well-run bank is sufficient", axis.sufficient === true);
  ok("and scores at the top", axis.score === 6);
  ok("with no failures at all", hdfc.every((c) => c.status === "pass"));
  ok("which is the opposite of 0/10", axis.score > 0);

  // A weak bank must still be able to score badly, or the checklist is a rubber
  // stamp rather than a measure.
  const weak = scoreFromChecks(
    bankChecks({
      grossNpaRatio: at(0.14),
      netNpaRatio: at(0.07),
      provisionCoverage: at(0.4, { definition: PCR_TOTAL }),
      depositFunding: at(0.35),
      loansToDeposits: at(1.6),
      loansToAssets: at(0.85),
      assetsToEquity: at(22),
      capitalBufferPoints: at(0.001),
    }),
    { minimumEvaluated: 4, domains: [], subject: "bank" }
  );
  ok("a troubled bank scores zero", weak.score === 0);
  ok("and that zero IS sufficient, because it is measured", weak.sufficient === true);

  // The two provision-coverage definitions are not interchangeable. 80% is
  // strong under the specific-provisions reading and weak under the total one.
  const specific = bankChecks({ provisionCoverage: at(0.8, { definition: PCR_SPECIFIC }) })[2];
  const total = bankChecks({ provisionCoverage: at(0.8, { definition: PCR_TOTAL }) })[2];
  ok("80% passes under the specific definition", specific.status === "pass");
  ok("and fails under the total one", total.status === "fail");
  ok("the label states which definition applies", /specific/i.test(specific.label) && /total/i.test(total.label));
  ok("and the definition is carried on the check", specific.definition === PCR_SPECIFIC);
  // An undeclared definition takes the stricter reading rather than flattering.
  ok("an undeclared definition is read strictly", bankChecks({ provisionCoverage: at(0.8) })[2].status === "fail");

  // Thresholds, at the boundary.
  ok("gross NPA of exactly 2% passes", bankChecks({ grossNpaRatio: at(0.02) })[0].status === "pass");
  ok("2.1% does not", bankChecks({ grossNpaRatio: at(0.021) })[0].status === "fail");
  ok("deposits at 65% pass", bankChecks({ depositFunding: at(0.65) })[3].status === "pass");
  ok("loans at 105% of deposits pass", bankChecks({ loansToDeposits: at(1.05) })[4].status === "pass");
  ok("but 130% does not", bankChecks({ loansToDeposits: at(1.3) })[4].status === "fail");
  ok("9.9x assets to equity passes", bankChecks({ assetsToEquity: at(9.9) })[6].status === "pass");
  ok("22x does not", bankChecks({ assetsToEquity: at(22) })[6].status === "fail");
}

// ── A non-bank lender is not a small bank ───────────────────────────────────
//
// PFC borrows wholesale and lends to power projects. It is not licensed to take
// customer deposits, so scoring it on deposit funding would mark it down for
// not being a bank — the same error one rung down.
{
  const text = labels(nbfcChecks({}));
  ok("an NBFC is never asked about customer deposit funding", !/deposit/.test(text));
  for (const term of ["crar", "tier-1", "stage 3", "coverage", "gearing", "asset-liability", "liquidity", "funding", "secured", "sector"]) {
    ok(`an NBFC is asked about ${term}`, text.includes(term));
  }
  ok("ten measures", nbfcChecks({}).length === 10);

  // Gearing is judged against the category's own ceiling, because a housing
  // financier and an infrastructure lender are held to different limits and one
  // fixed threshold would flag whichever it was not written for.
  ok("gearing passes under a generous ceiling", nbfcChecks({ gearing: at(9), gearingCeiling: 10 })[4].status === "pass");
  ok("and fails under a tight one", nbfcChecks({ gearing: at(9), gearingCeiling: 6 })[4].status === "fail");
  ok("the ceiling is named in the label", /10x/.test(nbfcChecks({ gearing: at(9), gearingCeiling: 10 })[4].label));
  ok("with no ceiling, the label does not invent one", !/\d+x/.test(nbfcChecks({ gearing: at(9) })[4].label));
  // PFC's 7.56x gearing is not a red cross on its own.
  ok("7.56x is fine for an infrastructure lender", nbfcChecks({ gearing: at(7.56), gearingCeiling: 10 })[4].status === "pass");
}

// ── Insurers, split by what they actually underwrite ────────────────────────
{
  const life = labels(lifeInsurerChecks({}));
  for (const term of ["solvency", "reserve", "claims settled", "persist", "duration", "investments", "reinsurance"]) {
    ok(`a life insurer is asked about ${term}`, life.includes(term));
  }
  const general = labels(generalInsurerChecks({}));
  for (const term of ["solvency", "combined ratio", "loss ratio", "reserve", "reinsurance", "liquid", "investments"]) {
    ok(`a general insurer is asked about ${term}`, general.includes(term));
  }
  // The two are not one checklist wearing two names.
  ok("persistency belongs only to life", life.includes("persist") && !general.includes("persist"));
  ok("the combined ratio only to general", general.includes("combined ratio") && !life.includes("combined ratio"));
  ok("neither is asked about debt to equity", !/debt\/equity/.test(life) && !/debt\/equity/.test(general));

  const strong = scoreFromChecks(
    generalInsurerChecks({
      solvencyRatio: at(2.1),
      combinedRatio: at(0.96),
      claimsRatio: at(0.68),
      reserveAdequacy: at(1.1),
      reinsuranceCeded: at(0.2),
      liquidityCover: at(1.4),
      investmentQuality: at(0.86),
    }),
    { minimumEvaluated: 3, domains: [], subject: "insurer" }
  );
  ok("a well-run general insurer scores fully", strong.score === 6);
  ok("an underwriting loss fails the combined ratio", generalInsurerChecks({ combinedRatio: at(1.08) })[1].status === "fail");
}

// ── The axis a company actually gets ────────────────────────────────────────
{
  // An industrial company is unchanged: the old checks were never wrong for the
  // companies they were written for.
  const factory = balanceSheetAxis("industrial", {
    industrial: { currentRatio: at(1.8), debtToEquity: at(0.4), cashToDebt: at(1.6) },
  });
  ok("a healthy manufacturer still scores fully", factory.score === 6);
  ok("and is sufficient", factory.sufficient === true);
  const levered = balanceSheetAxis("industrial", {
    industrial: { currentRatio: at(0.7), debtToEquity: at(2.4), cashToDebt: at(0.1) },
  });
  ok("a stretched manufacturer still scores zero", levered.score === 0);
  ok("which is a measured zero", levered.sufficient === true);
  // Two of three is the bar; one is not.
  ok("two sourced measures are enough", balanceSheetAxis("industrial", { industrial: { currentRatio: at(1.8), debtToEquity: at(0.4) } }).sufficient === true);
  ok("one is not", balanceSheetAxis("industrial", { industrial: { currentRatio: at(1.8) } }).sufficient === false);

  // A bank with nothing sourced says so, and does NOT say zero.
  const blindBank = balanceSheetAxis("bank", {});
  ok("an unsourced bank is insufficient", blindBank.sufficient === false);
  ok("and says 'insufficient bank data'", /insufficient bank data/i.test(blindBank.unavailableNote));
  ok("it still lists what it could not measure", blindBank.checks.length === 8);
  ok("every one marked unavailable", blindBank.checks.every((c) => c.status === "unavailable"));
  ok("and none marked failed", blindBank.checks.every((c) => c.status !== "fail"));

  // THE REGRESSION. The structural half is what a generic quote feed can reach,
  // and on its own it used to score a confident 6/6 — "Strong, 10/10" over a
  // bank whose bad loans and capital were entirely unknown. That is a worse
  // claim than the 0/10 this all started with, because it is assured, and a
  // reader has no way to see that the four measures behind it were the four
  // that matter least.
  const structuralOnly = balanceSheetAxis("bank", {
    bank: { depositFunding: at(0.74), loansToDeposits: at(0.98), loansToAssets: at(0.63), assetsToEquity: at(7.9) },
  });
  ok("four structural measures are NOT a score", structuralOnly.sufficient === false);
  ok("and specifically not 10/10", structuralOnly.score !== 6);
  ok("it is reported as partial", /partial/i.test(structuralOnly.unavailableNote));
  ok("naming the missing asset quality", /asset quality/i.test(structuralOnly.unavailableNote));
  ok("and the missing capital", /capital/i.test(structuralOnly.unavailableNote));
  ok("the four it did read are still shown as passing", structuralOnly.checks.filter((c) => c.status === "pass").length === 4);
  ok("and the other four as unavailable, not failed", structuralOnly.checks.filter((c) => c.status === "unavailable").length === 4);
  ok("with nothing marked as a failure", structuralOnly.checks.every((c) => c.status !== "fail"));

  const threeOnly = balanceSheetAxis("bank", {
    bank: { depositFunding: at(0.74), loansToDeposits: at(0.98), loansToAssets: at(0.63) },
  });
  ok("three structural measures are not a score either", threeOnly.sufficient === false);

  ok("an unsourced NBFC says lender, not bank", /insufficient lender data/i.test(balanceSheetAxis("nbfc", {}).unavailableNote));
  ok("an unsourced insurer says insurer", /insufficient insurer data/i.test(balanceSheetAxis("life-insurer", {}).unavailableNote));
  ok("an unknown model falls back to industrial", balanceSheetAxis("industrial", {}).checks.length === 3);
}

// ── End to end: the industry string a feed returns, to the checklist ────────
//
// The named acceptance cases. Nothing here mentions a company by name inside
// the library — these are industry strings the provider actually returns, and
// the classifier has to route each one on its own.
{
  const routed = (industry, sector) => {
    const model = financialHealthModel(industry, sector);
    return { model, checks: balanceSheetAxis(model, {}).checks };
  };

  const hdfcBank = routed("Banks—Regional", "Financial Services");
  ok("HDFC Bank's industry routes to the bank checklist", hdfcBank.model === "bank");
  ok("which asks about deposits", labels(hdfcBank.checks).includes("deposit"));
  ok("and never about a current ratio", !labels(hdfcBank.checks).includes("current ratio"));
  ok("nor about cash exceeding debt", !labels(hdfcBank.checks).includes("more cash than"));
  ok("nor about debt to equity", !labels(hdfcBank.checks).includes("debt/equity"));

  const pfc = routed("Credit Services", "Financial Services");
  ok("PFC's industry routes to the NBFC checklist", pfc.model === "nbfc");
  ok("which never asks about deposit funding", !labels(pfc.checks).includes("deposit"));
  ok("and asks about capital adequacy instead", labels(pfc.checks).includes("crar"));
  ok("PFC is not given a bank's checklist", pfc.model !== "bank");

  const hdfcLife = routed("Insurance—Life", "Financial Services");
  ok("HDFC Life's industry routes to the life checklist", hdfcLife.model === "life-insurer");
  ok("which asks about persistency", labels(hdfcLife.checks).includes("persist"));
  ok("and not about a combined ratio", !labels(hdfcLife.checks).includes("combined ratio"));

  const generalInsurer = routed("Insurance - Property & Casualty", "Financial Services");
  ok("a general insurer routes to its own checklist", generalInsurer.model === "general-insurer");
  ok("which asks about the combined ratio", labels(generalInsurer.checks).includes("combined ratio"));

  const maker = routed("Auto Manufacturers", "Consumer Cyclical");
  ok("a manufacturer routes to the industrial checklist", maker.model === "industrial");
  ok("and IS asked about its current ratio", labels(maker.checks).includes("current ratio"));

  const broker = routed("Insurance Brokers", "Financial Services");
  ok("a broker is an ordinary company", broker.model === "industrial");
  ok("and is judged like one", labels(broker.checks).includes("current ratio"));

  // The sector alone must never promote a company: "Financial Services" also
  // holds exchanges and asset managers, whose balance sheets are ordinary.
  ok("an exchange is judged normally", routed("Financial Data & Stock Exchanges", "Financial Services").model === "industrial");
  ok("as is an asset manager", routed("Asset Management", "Financial Services").model === "industrial");
  ok("and a company with no industry at all", routed(undefined, "Financial Services").model === "industrial");

  // The headline outcome: a bank with nothing sourced reports insufficiency,
  // not zero, and not "Fragile".
  const blind = balanceSheetAxis(financialHealthModel("Banks—Regional"), {});
  ok("an unsourced bank is not scored", blind.sufficient === false);
  ok("and says insufficient bank data", /insufficient bank data/i.test(blind.unavailableNote));
  ok("with nothing counted as a failure", blind.checks.every((c) => c.status !== "fail"));
}

// ── Nothing a reader sees carries an em-dash ────────────────────────────────
//
// The site's copy dropped em-dashes deliberately, and this is the surface most
// likely to reintroduce them: every check label, threshold and explanation here
// is rendered on the company page. An industry string like "Insurance—Life" is
// exempt because it is the provider's own spelling and has to match it exactly,
// but nothing we WRITE may carry one.
{
  const everyString = [];
  for (const model of ["industrial", "bank", "nbfc", "life-insurer", "general-insurer"]) {
    const axis = balanceSheetAxis(model, {});
    if (axis.unavailableNote) everyString.push(axis.unavailableNote);
    for (const c of axis.checks) {
      everyString.push(c.label);
      if (c.threshold) everyString.push(c.threshold);
      if (c.unavailableReason) everyString.push(c.unavailableReason);
    }
  }
  // The populated case too: a label can change with the definition it read.
  for (const c of bankChecks({ provisionCoverage: at(0.8, { definition: PCR_SPECIFIC }) })) everyString.push(c.label);
  for (const c of nbfcChecks({ gearing: at(9), gearingCeiling: 10 })) everyString.push(c.label);

  ok("there is copy to check", everyString.length > 40);
  const offenders = everyString.filter((t) => t.includes("—"));
  ok("no em-dash in anything a reader sees", offenders.length === 0);
  if (offenders.length) console.error("    ", offenders.slice(0, 3));
  // A lone dash meaning "no value" says nothing out loud; a screen reader
  // announces it as silence.
  ok("no bare dash standing in for a value", !everyString.some((t) => t.trim() === "-" || t.trim() === "–"));
}

// ── Coverage, not just count ────────────────────────────────────────────────
//
// A bank has three questions to answer and eight measures spread across them.
// Counting the measures alone lets a company answer the easy question four
// times and be scored as though it had answered all three.
{
  const structural = { depositFunding: at(0.74), loansToDeposits: at(0.98), loansToAssets: at(0.63), assetsToEquity: at(7.9) };
  const assetQuality = { grossNpaRatio: at(0.0133), netNpaRatio: at(0.0043), provisionCoverage: at(1.71, { definition: PCR_TOTAL }) };
  const capital = { capitalBufferPoints: at(0.073) };

  ok("every bank check declares a domain", bankChecks({}).every((c) => !!c.domain));
  ok("three domains are represented", new Set(bankChecks({}).map((c) => c.domain)).size === 3);
  ok("four structural checks", bankChecks({}).filter((c) => c.domain === DOMAIN.STRUCTURAL).length === 4);
  ok("three asset-quality checks", bankChecks({}).filter((c) => c.domain === DOMAIN.ASSET_QUALITY).length === 3);
  ok("one capital check", bankChecks({}).filter((c) => c.domain === DOMAIN.CAPITAL).length === 1);

  const only = (m) => balanceSheetAxis("bank", { bank: m });

  ok("structural alone is not enough", only(structural).sufficient === false);
  ok("asset quality alone is not enough", only(assetQuality).sufficient === false);
  ok("capital alone is not enough", only(capital).sufficient === false);
  ok("structural plus capital still misses asset quality", only({ ...structural, ...capital }).sufficient === false);
  ok("and says which", /asset quality/i.test(only({ ...structural, ...capital }).unavailableNote));
  ok("structural plus asset quality still misses capital", only({ ...structural, ...assetQuality }).sufficient === false);
  ok("and says which", /capital/i.test(only({ ...structural, ...assetQuality }).unavailableNote));

  // Seven of eight, covering all three: enough.
  const nearlyAll = only({ ...structural, ...capital, grossNpaRatio: at(0.0133), netNpaRatio: at(0.0043) });
  ok("seven of eight across all three domains IS a score", nearlyAll.sufficient === true);
  ok("and scores on what it measured", nearlyAll.score === 6);

  // Six of eight is the floor, and only with the domains covered.
  const six = only({ depositFunding: at(0.74), loansToDeposits: at(0.98), loansToAssets: at(0.63), assetsToEquity: at(7.9), grossNpaRatio: at(0.0133), capitalBufferPoints: at(0.073) });
  ok("six across all three domains is enough", six.sufficient === true);
  // Five is not, however well spread.
  const five = only({ depositFunding: at(0.74), loansToDeposits: at(0.98), loansToAssets: at(0.63), grossNpaRatio: at(0.0133), capitalBufferPoints: at(0.073) });
  ok("five is not", five.sufficient === false);

  // The whole checklist still works.
  const complete = only({ ...structural, ...assetQuality, ...capital });
  ok("all eight is a score", complete.sufficient === true);
  ok("and nothing is left unmeasured", complete.checks.every((c) => c.status !== "unavailable"));

  // A bad bank with a full picture must still be able to score zero.
  const troubled = only({
    depositFunding: at(0.35), loansToDeposits: at(1.6), loansToAssets: at(0.85), assetsToEquity: at(22),
    grossNpaRatio: at(0.14), netNpaRatio: at(0.07), provisionCoverage: at(0.4, { definition: PCR_TOTAL }),
    capitalBufferPoints: at(0.001),
  });
  ok("a troubled bank still scores zero", troubled.score === 0);
  ok("and that zero is a measurement", troubled.sufficient === true);
}

// ── The same rule for a non-bank lender ─────────────────────────────────────
{
  ok("every NBFC check declares a domain", nbfcChecks({}).every((c) => !!c.domain));
  const structuralOnly = balanceSheetAxis("nbfc", {
    nbfc: { gearing: at(7.56, {}), liquidityCoverage: at(1.4), securedShare: at(0.9), largestFundingShare: at(0.3) },
  });
  ok("an NBFC is not scored on structure alone", structuralOnly.sufficient === false);
  ok("and it says lender, not bank", /lender/i.test(structuralOnly.unavailableNote));
  const full = balanceSheetAxis("nbfc", {
    nbfc: {
      crarBufferPoints: at(0.08), tier1BufferPoints: at(0.05), stage3Ratio: at(0.02),
      provisionCoverage: at(0.6), gearing: at(7.56), gearingCeiling: 10,
      liquidityCoverage: at(1.4), securedShare: at(0.9),
    },
  });
  ok("a full picture is scored", full.sufficient === true);
}

// ── Insurers need their solvency ────────────────────────────────────────────
{
  const noSolvency = balanceSheetAxis("general-insurer", {
    general: { combinedRatio: at(0.96), claimsRatio: at(0.68), reserveAdequacy: at(1.1), liquidityCover: at(1.4) },
  });
  ok("an insurer without solvency is not scored", noSolvency.sufficient === false);
  ok("and it says so", /solvency/i.test(noSolvency.unavailableNote));
  const withSolvency = balanceSheetAxis("general-insurer", {
    general: { solvencyRatio: at(2.1), combinedRatio: at(0.96), claimsRatio: at(0.68), reserveAdequacy: at(1.1) },
  });
  ok("with it, the same figures score", withSolvency.sufficient === true);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
