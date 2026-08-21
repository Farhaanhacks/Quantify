#!/usr/bin/env node
// The whole path, end to end: a filing goes in, a Balance Sheet Strength score
// comes out.
//
// Run: node scripts/test-filings-e2e.mjs
//
// The other suites test each stage against its own inputs, which is the right
// way to find a bug but the wrong way to know the thing works. This one starts
// with an XBRL document and finishes with the card, because that is the claim
// being made: HDFC Bank read "Insufficient bank data" not because a bank cannot
// be scored but because gross NPAs and capital adequacy live in the company's
// filings, and once a filing has been ingested the same card scores it.
//
// The modules in this path import each other through the "@/" alias, which Node
// cannot resolve on its own, so the compiled output is rewritten to absolute
// paths before it is imported. That is a test-harness detail and nothing else
// depends on it.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "filings-e2e-"));

// The "@/" alias only exists inside the project's tsconfig, so the compiler
// needs a project file rather than a list of flags.
const tsconfig = join(out, "tsconfig.json");
writeFileSync(
  tsconfig,
  JSON.stringify({
    compilerOptions: {
      outDir: out,
      rootDir: join(root, "src"),
      module: "esnext",
      target: "es2022",
      moduleResolution: "bundler",
      baseUrl: root,
      paths: { "@/*": ["src/*"] },
      skipLibCheck: true,
      strict: false,
      lib: ["es2022", "dom"],
      // The store reads environment variables, so it needs Node's types, and a
      // tsconfig written outside the project does not find them on its own.
      typeRoots: [join(root, "node_modules/@types")],
      types: ["node"],
    },
    files: [
      join(root, "src/lib/filings/extract.ts"),
      join(root, "src/lib/filings/toMetrics.ts"),
      // Nothing in the chain imports the classifier, but the card's answer
      // depends on it choosing the bank checklist, so it is asserted here too.
      join(root, "src/lib/financialHealth.ts"),
      // The join between how filings are keyed and how pages find them.
      join(root, "src/lib/filings/store.ts"),
      join(root, "src/lib/filings/companyMaster.ts"),
    ],
  })
);
execFileSync("npx", ["tsc", "--project", tsconfig], { stdio: "pipe" });

// Rewrite "@/lib/x" to the absolute compiled file, so Node can load it.
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      walk(p);
      continue;
    }
    if (!p.endsWith(".js")) continue;
    const src = readFileSync(p, "utf8").replace(
      /(["'])@\/([^"']+)\1/g,
      (_m, q, rest) => `${q}${pathToFileURL(join(out, `${rest}.js`)).href}${q}`
    );
    writeFileSync(p, src);
  }
};
walk(out);

const { extractFromXbrl } = await import(join(out, "lib/filings/extract.js"));
const { bankMetricsFromFilings } = await import(join(out, "lib/filings/toMetrics.js"));
const { balanceSheetAxis, mergeMetrics } = await import(join(out, "lib/balanceSheet.js"));
const { financialHealthModel } = await import(join(out, "lib/financialHealth.js"));
const { provisionalIdForSymbol } = await import(join(out, "lib/filings/store.js"));
const { companyKey } = await import(join(out, "lib/filings/companyMaster.js"));


let passed = 0;
let failed = 0;
const ok = (name, cond) => {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  FAIL: ${name}`);
  }
};

const xml = readFileSync(join(root, "scripts/fixtures/filings/bank-quarterly-indas.xml"), "utf8");

// ── Extract ─────────────────────────────────────────────────────────────────
const result = extractFromXbrl(xml, {
  filingId: "filing_test_1",
  companyId: "isin:INE040A01034",
  industry: "bank",
  periodEnd: "2026-03-31",
  scope: "consolidated",
});
{
  ok("the filing parses", result.errors.length === 0);
  ok("facts come out", result.facts.length >= 10);
  ok("every published fact has a value", result.facts.every((f) => typeof f.numericValue === "number"));
  ok("every one names its concept", result.facts.every((f) => !!f.concept));
  ok("and the tag it came from", result.facts.every((f) => !!f.sourceConcept));
  ok("and where in the document", result.facts.every((f) => !!f.sourceXPath));
  ok("and its reporting date", result.facts.every((f) => !!f.periodEnd));
  ok("and its scope", result.facts.every((f) => f.scope === "consolidated"));
  ok("and how it was read", result.facts.every((f) => f.method === "xbrl"));
  ok("a tagged fact is not discounted", result.facts.every((f) => f.confidence === 1));

  // The standalone deposits and last year's assets are in the document and must
  // not be among the published facts.
  ok("the standalone book is not published", !result.facts.some((f) => f.scope === "standalone"));
  ok("nor is last year's comparative", !result.facts.some((f) => f.periodEnd === "2025-03-31"));
  ok("both are kept with reasons", result.rejected.length >= 2);
  ok("every rejection says why", result.rejected.every((f) => !!f.rejectedReason));
  ok("the comparative is named as one", result.rejected.some((f) => /comparative/i.test(f.rejectedReason)));
  ok("the standalone fact is named as a scope clash", result.rejected.some((f) => /standalone|consolidated/i.test(f.rejectedReason)));

  // The insurer's tag is reported rather than mapped.
  ok("an insurer's tag does not become a bank fact", !result.facts.some((f) => f.concept === "valueOfNewBusiness"));
  ok("it is rejected with its industry named", result.rejected.some((f) => /life-insurer/.test(f.rejectedReason ?? "")));

  // The unmapped tag is listed, so the taxonomy gap is visible.
  ok("an unmapped tag is reported", result.unmapped.some((t) => /NumberOfBranches/.test(t)));
  ok("and is not silently dropped", result.unmapped.length >= 1);

  // The nil fact is neither published nor read as zero.
  ok("a nil fact is not published", !result.facts.some((f) => f.concept === "savingsDeposits"));
  ok("and is not zero", !result.facts.some((f) => f.concept === "savingsDeposits" && f.numericValue === 0));

  // The document's arithmetic holds, so no identity issue should be raised.
  ok("the balance sheet balances", !result.issues.some((i) => /balance/i.test(i.reason)));

  const byConcept = Object.fromEntries(result.facts.map((f) => [f.concept, f.numericValue]));
  ok("total assets survive", byConcept.totalAssets === 40300000000000);
  ok("deposits survive", byConcept.deposits === 26000000000000);
  ok("the gross NPA ratio survives", byConcept.grossNpaRatio === 1.33);
  ok("capital adequacy survives", byConcept.capitalAdequacyRatio === 18.8);
  ok("interest earned is a bank concept, not revenue", byConcept.interestEarned === 810000000000);
  ok("and there is no 'revenue' fact at all", byConcept.revenue === undefined);
}

// ── Metrics ─────────────────────────────────────────────────────────────────
const SOURCE_URL = "https://www.bseindia.com/xml-data/corpfiling/AttachHis/test.xml";
const { metrics, sourced } = bankMetricsFromFilings(result.facts, {
  periodEnd: "2026-03-31",
  homeCountry: "IN",
  sourceUrl: SOURCE_URL,
});
{
  ok("most of the checklist is sourced", sourced >= 7);
  // Percent in the filing, fraction in the checklist. Getting this backwards
  // reports a 1.33% bad-loan book as 133% of the bank's lending.
  ok("the NPA ratio is converted to a fraction", Math.abs(metrics.grossNpaRatio.value - 0.0133) < 1e-9);
  ok("and not left as a percentage", metrics.grossNpaRatio.value < 1);
  ok("provision coverage too", Math.abs(metrics.provisionCoverage.value - 1.71) < 1e-9);

  // Capital is measured as headroom above the floor, not against an absolute.
  ok("capital is expressed as headroom", Math.abs(metrics.capitalBufferPoints.value - (0.188 - 0.115)) < 1e-9);
  ok("which is derived, and says so", metrics.capitalBufferPoints.derived === true);
  ok("and names the minimum it used", /11\.5/.test(metrics.capitalBufferPoints.definition));

  // Derived ratios, from figures of one date and one scope.
  ok("deposit funding is derived", Math.abs(metrics.depositFunding.value - 26000000000000 / 35200000000000) < 1e-9);
  ok("loans to deposits", Math.abs(metrics.loansToDeposits.value - 25500000000000 / 26000000000000) < 1e-9);
  ok("assets to equity", Math.abs(metrics.assetsToEquity.value - 40300000000000 / 5100000000000) < 1e-9);
  ok("which is about 7.9x", Math.abs(metrics.assetsToEquity.value - 7.9) < 0.05);

  // Provenance survives the whole journey.
  ok("every sourced metric keeps its date", Object.values(metrics).every((m) => typeof m !== "object" || m.value == null || !!m.asOf));
  ok("and its scope", Object.values(metrics).every((m) => typeof m !== "object" || m.value == null || m.scope === "consolidated"));
  ok("and what it means", Object.values(metrics).every((m) => typeof m !== "object" || m.value == null || !!m.definition));
  // The citation. A figure presented as coming from the company's filing has to
  // be able to say which filing, or the citation is decoration.
  ok("and the document it came from", Object.values(metrics).every((m) => typeof m !== "object" || m.value == null || m.sourceUrl === SOURCE_URL));
}

// ── The card ────────────────────────────────────────────────────────────────
{
  ok("the industry routes to the bank checklist", financialHealthModel("Banks—Regional") === "bank");
  const axis = balanceSheetAxis("bank", { bank: metrics });

  // The headline. This is the sentence the whole pipeline exists to change.
  ok("the bank IS scored", axis.sufficient === true);
  ok("and not reported as insufficient", axis.unavailableNote === undefined);
  ok("it scores well", axis.score >= 5);
  ok("which is not zero", axis.score > 0);
  ok("every check was evaluated", axis.checks.every((c) => c.status !== "unavailable"));
  ok("with no failures", axis.checks.filter((c) => c.status === "fail").length === 0);

  // The four measures no quote feed carries, now present.
  const label = (needle) => axis.checks.find((c) => c.label.toLowerCase().includes(needle));
  ok("bad loans are measured", label("gross npa").status === "pass");
  ok("net NPAs are measured", label("net npa").status === "pass");
  ok("provision coverage is measured", label("provision coverage").status === "pass");
  ok("regulatory capital is measured", label("regulatory minimum").status === "pass");

  // And no industrial check reached it.
  const text = axis.checks.map((c) => c.label.toLowerCase()).join(" | ");
  ok("no current ratio", !text.includes("current ratio"));
  ok("no debt to equity", !text.includes("debt/equity"));
  ok("no cash against debt", !text.includes("more cash than"));

  // Every check can be traced back to the document it came from.
  ok("each check carries its reporting date", axis.checks.every((c) => !!c.asOf));
  ok("and its scope", axis.checks.every((c) => c.scope === "consolidated"));
  ok("and its definition", axis.checks.every((c) => !!c.definition));

  // The contrast: the same checklist with no filings behind it.
  const blind = balanceSheetAxis("bank", {});
  ok("without filings the same bank is not scored", blind.sufficient === false);
  ok("and says insufficient bank data", /insufficient bank data/i.test(blind.unavailableNote));
  ok("so the pipeline is what changes the answer", axis.sufficient !== blind.sufficient);
}

// ── Two sources, merged per measure ─────────────────────────────────────────
//
// The bug this replaces: the moment a single filed fact existed, the filing's
// metrics were returned wholesale and four working structural ratios from the
// quote feed were discarded. The two sources are good at opposite halves, so
// choosing one for the whole checklist throws away half the picture whichever
// way it is chosen.
{
  const filedOnly = {
    grossNpaRatio: { value: 0.0133, asOf: "2026-03-31", scope: "consolidated", sourceUrl: SOURCE_URL },
    netNpaRatio: { value: 0.0043, asOf: "2026-03-31", scope: "consolidated" },
    provisionCoverage: { value: 1.71, asOf: "2026-03-31", scope: "consolidated" },
    capitalBufferPoints: { value: 0.073, asOf: "2026-03-31", scope: "consolidated" },
    // Present, and empty: the filing tagged no balance sheet.
    depositFunding: { unavailableReason: "Not tagged." },
    loansToDeposits: { unavailableReason: "Not tagged." },
    loansToAssets: { unavailableReason: "Not tagged." },
    assetsToEquity: { unavailableReason: "Not tagged." },
  };
  const fromFeed = {
    grossNpaRatio: { unavailableReason: "Not in the feed." },
    netNpaRatio: { unavailableReason: "Not in the feed." },
    provisionCoverage: { unavailableReason: "Not in the feed." },
    capitalBufferPoints: { unavailableReason: "Not in the feed." },
    depositFunding: { value: 0.74, asOf: "2026-03-31", scope: "consolidated" },
    loansToDeposits: { value: 0.98, asOf: "2026-03-31", scope: "consolidated" },
    loansToAssets: { value: 0.63, asOf: "2026-03-31", scope: "consolidated" },
    assetsToEquity: { value: 7.9, asOf: "2026-03-31", scope: "consolidated" },
  };

  const merged = mergeMetrics(filedOnly, fromFeed);
  ok("the filing supplies asset quality", merged.grossNpaRatio.value === 0.0133);
  ok("and capital", merged.capitalBufferPoints.value === 0.073);
  // The half the old code threw away.
  ok("the feed still supplies deposit funding", merged.depositFunding.value === 0.74);
  ok("and leverage", merged.assetsToEquity.value === 7.9);
  ok("nothing is lost either way", Object.values(merged).every((m) => typeof m.value === "number"));

  const axis = balanceSheetAxis("bank", { bank: merged });
  ok("merged, the bank is scored", axis.sufficient === true);
  ok("on all eight measures", axis.checks.every((c) => c.status !== "unavailable"));
  ok("and 'what we could not measure' is empty", axis.checks.filter((c) => c.status === "unavailable").length === 0);

  // Neither source alone gets there.
  ok("the filing alone does not", balanceSheetAxis("bank", { bank: filedOnly }).sufficient === false);
  ok("nor does the feed alone", balanceSheetAxis("bank", { bank: fromFeed }).sufficient === false);
  ok("and the feed alone is not 10/10", balanceSheetAxis("bank", { bank: fromFeed }).score !== 6);

  // A filed metric that failed validation must not evict a sound derived one.
  const badFiled = { assetsToEquity: { unavailableReason: "Mismatched scope." } };
  ok("a refused filed metric does not displace a good one",
    mergeMetrics(badFiled, fromFeed).assetsToEquity.value === 7.9);
  // And a filed metric wins where both have a value: it is the company's own
  // statement under the definition its regulator agreed to.
  ok("a filed metric wins over a derived one",
    mergeMetrics({ assetsToEquity: { value: 8.4 } }, fromFeed).assetsToEquity.value === 8.4);
  ok("no filings at all leaves the feed untouched", mergeMetrics(null, fromFeed).assetsToEquity.value === 7.9);
}

// ── The join between an identifier and a symbol ─────────────────────────────
//
// Filings are keyed on ISIN or CIN, because that is what survives a rename and
// what both exchanges agree on. Pages are reached by symbol, because that is
// what a reader types. If nothing joins the two, a filing ingested correctly is
// read by nothing — and silently: no error, no empty result to chase, just a
// card that goes on saying the data is unavailable while the data sits in the
// database. That is the worst failure mode this pipeline can have, so the
// fallback key the two sides mint independently has to agree exactly.
{
  ok("a plain symbol mints an NSE key", provisionalIdForSymbol("HDFCBANK") === "provisional:nse:HDFCBANK");
  ok("the .NS suffix is stripped", provisionalIdForSymbol("HDFCBANK.NS") === "provisional:nse:HDFCBANK");
  ok("a BSE listing keys to BSE", provisionalIdForSymbol("HDFCBANK.BO") === "provisional:bse:HDFCBANK");
  ok("case does not matter", provisionalIdForSymbol("hdfcbank.ns") === "provisional:nse:HDFCBANK");
  ok("nor does whitespace", provisionalIdForSymbol("  HDFCBANK.NS ") === "provisional:nse:HDFCBANK");

  // The two files mint this key independently. If they ever disagree, an
  // unidentified ingest becomes unreachable, so the agreement is asserted.
  ok(
    "the store and the company master agree on the NSE key",
    provisionalIdForSymbol("HDFCBANK.NS") === companyKey({ nseSymbol: "HDFCBANK" })
  );
  ok(
    "and on the BSE key",
    provisionalIdForSymbol("500180.BO") === companyKey({ bseScripCode: "500180" })
  );
  // And an identifier still beats a symbol wherever both are present.
  ok(
    "an ISIN outranks a symbol",
    companyKey({ isin: "INE040A01034", nseSymbol: "HDFCBANK" }) === "isin:INE040A01034"
  );
}

rmSync(out, { recursive: true, force: true });
console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
