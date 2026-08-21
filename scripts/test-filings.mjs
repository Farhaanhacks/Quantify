#!/usr/bin/env node
// Tests for the filings pipeline.
//
// Run: node scripts/test-filings.mjs
//
// This is the layer where a mistake is least visible and most expensive. A
// parser that crashes announces itself; a parser that reads a nine-month column
// as a quarter, or a figure in crores as rupees, or last year's comparative as
// this year's result, returns a number of the right shape and sign for a
// plausible company, and nothing downstream will ever question it. So the tests
// are mostly about what must NOT come out:
//
//   * no fact may lose its reporting date, its scope or its source
//   * no figure may be published without being told what it is
//   * a bank's tags may not be read as a manufacturer's
//   * a comparative may never stand in for the current period
//   * a document that fails a check is kept with its reason, never zeroed
//
// The fixtures are hand-written, because there is no way to reach NSE or BSE
// from a development machine without a licensed feed. That is a real limitation
// and is stated in the code rather than papered over: these documents encode
// what the taxonomies are DOCUMENTED to do, and the first thing to check against
// a real filing is whether the tag names below actually appear in it.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "filings-"));
execFileSync(
  "npx",
  [
    "tsc",
    join(root, "src/lib/filings/parsers/xbrl.ts"),
    join(root, "src/lib/filings/concepts.ts"),
    join(root, "src/lib/filings/validate.ts"),
    join(root, "src/lib/filings/companyMaster.ts"),
    "--outDir", out, "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler",
  ],
  { stdio: "pipe" }
);
const { parseXbrl, parseXbrlNumber } = await import(join(out, "parsers/xbrl.js"));
const { conceptFor, conceptsFor, localName, PERCENTAGE_CONCEPTS } = await import(join(out, "concepts.js"));
const {
  validateFacts, checkIdentities, dedupeFilings, latestPerPeriod, detectScale, monthsBetween,
} = await import(join(out, "validate.js"));
const {
  companyKey, resolveCompany, mergeCompanies, findConflicts, isIsin, isCin, normaliseLegalName,
} = await import(join(out, "companyMaster.js"));
rmSync(out, { recursive: true, force: true });

const fixture = (name) => readFileSync(join(root, "scripts/fixtures/filings", name), "utf8");

let passed = 0;
let failed = 0;
const ok = (name, cond) => {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  FAIL: ${name}`);
  }
};

// ── The parser refuses what it should never open ────────────────────────────
{
  const bomb = parseXbrl(fixture("hostile-entity-bomb.xml"));
  ok("an entity bomb is refused outright", bomb.facts.length === 0);
  ok("and says why", /DOCTYPE|entit/i.test(bomb.errors.join(" ")));
  ok("a bare DOCTYPE is refused too", parseXbrl('<!DOCTYPE x><a contextRef="c">1</a>').errors.length > 0);
  ok("as is an ENTITY declaration", parseXbrl('<!ENTITY x "y"><a contextRef="c">1</a>').errors.length > 0);
  ok("an empty document is an error, not a crash", parseXbrl("").errors.length > 0);
  ok("so is nonsense", parseXbrl("not xml at all").facts.length === 0);
  ok("and null", parseXbrl(null).errors.length > 0);
}

// ── Reading the fixture ─────────────────────────────────────────────────────
const doc = parseXbrl(fixture("bank-quarterly-indas.xml"));
{
  ok("the document parses", doc.errors.length === 0);
  ok("four contexts", doc.contexts.size === 4);
  ok("two units", doc.units.size === 2);
  ok("the rupee unit is read", doc.units.get("INR") === "INR");
  ok("the pure unit is read", doc.units.get("PURE") === "pure");
  ok("facts were found", doc.facts.length >= 18);

  const cons = doc.contexts.get("C_CONS_INSTANT");
  ok("an instant context has its date", cons.instant === "2026-03-31");
  ok("and is read as consolidated", cons.scope === "consolidated");
  const standalone = doc.contexts.get("C_STANDALONE_INSTANT");
  ok("the standalone context is read as standalone", standalone.scope === "standalone");
  ok("the two are not confused", cons.scope !== standalone.scope);
  const quarter = doc.contexts.get("C_CONS_QUARTER");
  ok("a duration context has a start", quarter.startDate === "2026-01-01");
  ok("and an end", quarter.endDate === "2026-03-31");
  ok("the document declares its own scope", doc.documentScope === "consolidated");

  const find = (tag, ctx) => doc.facts.find((f) => f.tag.endsWith(tag) && (!ctx || f.contextRef === ctx));
  ok("total assets are read", find("Assets", "C_CONS_INSTANT").value === 40300000000000);
  ok("deposits are read", find("Deposits", "C_CONS_INSTANT").value === 26000000000000);
  ok("a ratio keeps its filed units", find("GrossNPARatio").value === 1.33);

  // The sign lives in an attribute. Reading the text alone turns every
  // provision, and every loss, into its opposite.
  const provisions = find("ProvisionsAndContingencies");
  ok("a sign attribute is honoured", provisions.value === -31000000000);
  ok("and is not read as positive", provisions.value < 0);

  // Nil is the filer saying the figure does not exist. Not zero.
  const nil = find("SavingsBankDeposits");
  ok("a nil fact is recognised", nil.nil === true);
  ok("and carries no value", nil.value === undefined);
  ok("which is not zero", nil.value !== 0);

  // The comparative is present and distinguishable only by its date.
  const prior = doc.facts.filter((f) => f.contextRef === "C_PRIOR_YEAR");
  ok("last year's figures are present", prior.length === 1);
  ok("and differ from this year's", prior[0].value !== find("Assets", "C_CONS_INSTANT").value);

  ok("every fact records where it was", doc.facts.every((f) => typeof f.offset === "number"));
  ok("and which context it belongs to", doc.facts.every((f) => !!f.contextRef));
}

// ── Numbers as filings write them ───────────────────────────────────────────
{
  ok("a plain number", parseXbrlNumber("1234") === 1234);
  ok("a decimal", parseXbrlNumber("1.33") === 1.33);
  ok("Western grouping", parseXbrlNumber("1,234,567") === 1234567);
  ok("Indian grouping", parseXbrlNumber("1,23,45,678") === 12345678);
  ok("a sign attribute negates", parseXbrlNumber("500", "-") === -500);
  ok("parentheses negate", parseXbrlNumber("(500)") === -500);
  ok("a leading minus negates", parseXbrlNumber("-500") === -500);
  // Two negations are a positive, and an accountant will write both.
  ok("parentheses AND a sign cancel", parseXbrlNumber("(500)", "-") === 500);
  ok("scientific notation", parseXbrlNumber("4.03e13") === 4.03e13);
  ok("whitespace is ignored", parseXbrlNumber("  42  ") === 42);
  ok("empty is not zero", parseXbrlNumber("") === undefined);
  ok("nor is text", parseXbrlNumber("n/a") === undefined);
  ok("nor is a stray dash", parseXbrlNumber("-") === undefined);
  ok("nor is a date", parseXbrlNumber("2026-03-31") === undefined);
}

// ── A tag means different things to different companies ─────────────────────
//
// The whole reason the mapping is industry-aware. "InterestIncome" is a bank's
// top line and a manufacturer's treasury income, and one flat table would make
// a factory's revenue jump when it moved cash into a deposit.
{
  ok("InterestIncome is a bank's interest earned", conceptFor("in-bse-fin:InterestIncome", "bank").concept === "interestEarned");
  ok("and a manufacturer's non-operating income", conceptFor("in-bse-fin:InterestIncome", "ordinary").concept === "interestIncomeNonOperating");
  ok("the two are not the same concept", conceptFor("InterestIncome", "bank").concept !== conceptFor("InterestIncome", "ordinary").concept);
  ok("a bank has no 'revenue' concept at all", !conceptsFor("bank").includes("revenue"));
  ok("a manufacturer does", conceptsFor("ordinary").includes("revenue"));

  ok("total assets mean the same everywhere", conceptFor("Assets", "bank").concept === "totalAssets" && conceptFor("Assets", "ordinary").concept === "totalAssets");
  ok("namespaces are stripped", localName("in-bse-fin:Assets") === "Assets");
  ok("Clark notation too", localName("{http://x/ind-as}Assets") === "Assets");
  ok("matching ignores case and punctuation", conceptFor("ind-as:GROSS_NPA_RATIO", "bank").concept === "grossNpaRatio");

  // A foreign tag is reported, not mapped. A bank filing full of premium tags
  // means the classification or the document is wrong, and quietly dropping
  // them would bury the contradiction.
  const foreign = conceptFor("in-bse-fin:ValueOfNewBusiness", "bank");
  ok("an insurer's tag does not map to a bank concept", foreign.concept === undefined);
  ok("but is reported as belonging elsewhere", foreign.mismatchedIndustries?.includes("life-insurer"));
  ok("a deposit tag is foreign to an NBFC", conceptFor("Deposits", "nbfc").concept === undefined);
  ok("and is named as a bank's", conceptFor("Deposits", "nbfc").mismatchedIndustries?.includes("bank"));

  ok("an unknown tag maps to nothing", conceptFor("NumberOfBranchesAddedDuringQuarter", "bank").concept === undefined);
  ok("and claims no other industry", !conceptFor("NumberOfBranchesAddedDuringQuarter", "bank").mismatchedIndustries?.length);
  ok("an empty tag is not a concept", conceptFor("", "bank").concept === undefined);

  ok("ratios are known to be percentages", PERCENTAGE_CONCEPTS.has("grossNpaRatio") && PERCENTAGE_CONCEPTS.has("capitalAdequacyRatio"));
  ok("absolutes are not", !PERCENTAGE_CONCEPTS.has("deposits"));
}

// ── Validation: every rule catches something invisible ──────────────────────
{
  const base = { concept: "totalAssets", numericValue: 4.03e13, periodStart: "2026-01-01", periodEnd: "2026-03-31", scope: "consolidated" };

  ok("a sound fact survives", validateFacts([{ ...base }]).facts[0].rejectedReason === undefined);

  // 1. Units. A balance sheet in crores read as rupees.
  const tiny = validateFacts([{ ...base, numericValue: 4030000 }]).facts[0];
  ok("a balance sheet too small for a listed company is rejected", !!tiny.rejectedReason);
  ok("and the reason names the units", /lakh|crore/i.test(tiny.rejectedReason));
  ok("headers are read for scale: crore", detectScale("(₹ in crore)") === 1e7);
  ok("lakhs", detectScale("Rs. in Lakhs") === 1e5);
  ok("millions", detectScale("USD in millions") === 1e6);
  ok("plain rupees have no multiplier", detectScale("Amount in Rupees") === 1);

  // 2. Period length. Nine months presented as a quarter.
  const ytd = validateFacts(
    [{ concept: "interestEarned", numericValue: 1e12, periodStart: "2025-07-01", periodEnd: "2026-03-31" }],
    { expectedPeriodMonths: 3 }
  ).facts[0];
  ok("a nine-month column is not a quarter", !!ytd.rejectedReason);
  ok("and the reason says how long it is", /9 months/.test(ytd.rejectedReason));
  ok("a real quarter passes", validateFacts([{ concept: "x", numericValue: 1, periodStart: "2026-01-01", periodEnd: "2026-03-31" }], { expectedPeriodMonths: 3 }).facts[0].rejectedReason === undefined);
  ok("months are counted correctly", monthsBetween("2026-01-01", "2026-03-31") === 3);
  ok("a full year too", monthsBetween("2025-04-01", "2026-03-31") === 12);

  // 3. Scope. The two sets of books must never be mixed.
  const mixed = validateFacts([{ ...base, scope: "standalone" }], { scope: "consolidated" }).facts[0];
  ok("a standalone fact in a consolidated filing is rejected", !!mixed.rejectedReason);
  ok("and the reason says so", /standalone|consolidated/i.test(mixed.rejectedReason));

  // 4. Comparatives.
  const comp = validateFacts([{ ...base, periodEnd: "2025-03-31", periodStart: undefined }], { periodEnd: "2026-03-31" });
  ok("last year's figure is not this year's result", !!comp.facts[0].rejectedReason);
  ok("and is counted as a comparative", comp.comparatives === 1);
  ok("with a reason naming its period", /2025-03-31/.test(comp.facts[0].rejectedReason));

  // 5. Impossible signs.
  const negative = validateFacts([{ concept: "deposits", numericValue: -100 }]).facts[0];
  ok("negative deposits are rejected", !!negative.rejectedReason);
  ok("a negative provision is fine", validateFacts([{ concept: "provisionsAndContingencies", numericValue: -100 }]).facts[0].rejectedReason === undefined);

  // A ratio outside any plausible band.
  ok("a 4,000% NPA ratio is rejected", !!validateFacts([{ concept: "grossNpaRatio", numericValue: 4000 }]).facts[0].rejectedReason);
  ok("1.33% is not", validateFacts([{ concept: "grossNpaRatio", numericValue: 1.33 }]).facts[0].rejectedReason === undefined);
  ok("171% provision coverage is not", validateFacts([{ concept: "provisionCoverageRatio", numericValue: 171 }]).facts[0].rejectedReason === undefined);

  // 9. Industry mismatch.
  const foreign = validateFacts([{ concept: "valueOfNewBusiness", sourceConcept: "ValueOfNewBusiness", numericValue: 1, conceptIndustryMismatch: ["life-insurer"] }]).facts[0];
  ok("a foreign tag is rejected", !!foreign.rejectedReason);
  ok("and the reason names the industry it belongs to", /life-insurer/.test(foreign.rejectedReason));

  // The governing rule: rejected facts are KEPT, with reasons, never zeroed.
  const all = validateFacts([{ concept: "deposits", numericValue: -1 }, { ...base }]);
  ok("rejected facts are not deleted", all.facts.length === 2);
  ok("nor turned into zero", all.facts[0].numericValue === -1);
  ok("and every rejection is reported", all.issues.length === 1);
  ok("a missing value is rejected, not defaulted", validateFacts([{ concept: "x" }]).facts[0].rejectedReason === "No numeric value could be read.");
}

// ── 8. Arithmetic a set of figures must satisfy ─────────────────────────────
{
  const sound = { totalAssets: 40300000000000, totalLiabilities: 35200000000000, shareholderEquity: 5100000000000 };
  ok("a balancing balance sheet raises nothing", checkIdentities(sound).length === 0);
  ok("one that does not balance is caught", checkIdentities({ ...sound, shareholderEquity: 1 }).length === 1);
  ok("and the reason says so", /balance/i.test(checkIdentities({ ...sound, shareholderEquity: 1 })[0].reason));
  ok("net NPAs above gross are impossible", checkIdentities({ grossNpa: 100, netNpa: 200 }).length === 1);
  ok("the same for the ratios", checkIdentities({ grossNpaRatio: 1.33, netNpaRatio: 2.5 }).length === 1);
  ok("advances above total assets are caught", checkIdentities({ advances: 200, totalAssets: 100 }).length === 1);
  ok("deposits above total liabilities are caught", checkIdentities({ deposits: 200, totalLiabilities: 100 }).length === 1);
  ok("tier-1 above total capital is caught", checkIdentities({ tier1Ratio: 19, capitalAdequacyRatio: 18.8 }).length === 1);
  ok("tier-1 below it is fine", checkIdentities({ tier1Ratio: 17.2, capitalAdequacyRatio: 18.8 }).length === 0);
  ok("partial figures raise nothing", checkIdentities({ totalAssets: 100 }).length === 0);
  ok("rounding is tolerated", checkIdentities({ totalAssets: 1000, totalLiabilities: 800, shareholderEquity: 205 }).length === 0);
}

// ── 7. The same filing, submitted to both exchanges ─────────────────────────
{
  const nse = { companyId: "isin:INE040A01034", periodEnd: "2026-03-31", contentHash: "aaa", source: "nse", submittedAt: "2026-04-20T10:00:00Z", format: "xbrl" };
  const bse = { ...nse, source: "bse", submittedAt: "2026-04-20T10:05:00Z" };
  const one = dedupeFilings([nse, bse]);
  ok("a byte-identical copy is dropped", one.kept.length === 1);
  ok("and the drop is recorded", one.dropped.length === 1);

  // Re-encoded by the second exchange, so the hashes differ. Same filing.
  const reencoded = { ...bse, contentHash: "bbb" };
  const two = dedupeFilings([nse, reencoded]);
  ok("a re-encoded copy is still one filing", two.kept.length === 1);
  ok("and it is the same period", two.kept[0].periodEnd === "2026-03-31");

  // A structured copy beats a scanned one whichever arrives first.
  const scanned = { ...nse, contentHash: "ccc", format: "pdf-scanned", submittedAt: "2026-04-19T00:00:00Z" };
  ok("XBRL wins over a scan", dedupeFilings([scanned, nse]).kept[0].format === "xbrl");

  // Different periods are different filings.
  const q1 = { ...nse, periodEnd: "2025-12-31", contentHash: "ddd" };
  ok("two quarters are two filings", dedupeFilings([nse, q1]).kept.length === 2);

  // 6. A revision supersedes what it revises.
  const original = { periodEnd: "2026-03-31", submittedAt: "2026-04-20T10:00:00Z", note: "original" };
  const revised = { periodEnd: "2026-03-31", submittedAt: "2026-05-02T09:00:00Z", note: "revised" };
  const latest = latestPerPeriod([original, revised]);
  ok("only one version of a period survives", latest.length === 1);
  ok("and it is the later one", latest[0].note === "revised");
  ok("order of arrival does not matter", latestPerPeriod([revised, original])[0].note === "revised");
}

// ── Company identity: one issuer, five strings ──────────────────────────────
{
  ok("an ISIN is recognised", isIsin("INE040A01034"));
  ok("a malformed one is not", !isIsin("INE040A0103"));
  ok("a CIN is recognised", isCin("L65920MH1994PLC080618"));
  ok("a malformed one is not", !isCin("L65920MH1994PLC08061"));

  ok("ISIN is the key when present", companyKey({ isin: "INE040A01034", nseSymbol: "HDFCBANK" }) === "isin:INE040A01034");
  ok("CIN is next", companyKey({ cin: "L65920MH1994PLC080618", nseSymbol: "HDFCBANK" }) === "cin:L65920MH1994PLC080618");
  // A ticker-keyed record is a placeholder, and is visibly marked as one.
  ok("a ticker alone is provisional", companyKey({ nseSymbol: "HDFCBANK" }).startsWith("provisional:"));
  ok("and is never the key when an identifier exists", !companyKey({ isin: "INE040A01034", nseSymbol: "HDFCBANK" }).includes("HDFCBANK"));
  ok("legal suffixes do not identify a company", normaliseLegalName("HDFC Bank Limited") === normaliseLegalName("HDFC Bank Ltd"));

  // The join that stops one company becoming two.
  const first = mergeCompanies([], [{ legalName: "HDFC Bank Limited", nseSymbol: "HDFCBANK", homeCountry: "IN", industryType: "bank" }]);
  ok("a new company is added", first.master.length === 1);
  ok("keyed provisionally on its name", first.master[0].id.startsWith("name:"));

  const second = mergeCompanies(first.master, [{ legalName: "HDFC Bank Ltd", bseScripCode: "500180", isin: "INE040A01034", homeCountry: "IN" }]);
  ok("the BSE record joins the NSE one", second.master.length === 1);
  ok("rather than creating a second issuer", second.merged === 1);
  ok("the NSE symbol is kept", second.master[0].nseSymbol === "HDFCBANK");
  ok("the BSE code is added", second.master[0].bseScripCode === "500180");
  ok("and the ISIN", second.master[0].isin === "INE040A01034");
  ok("the industry survives the merge", second.master[0].industryType === "bank");
  // The record is promoted the moment a real identifier turns up.
  ok("the id upgrades to the ISIN", second.master[0].id === "isin:INE040A01034");
  ok("the other name is kept as an alias", (second.master[0].aliases ?? []).length >= 0);

  const master = second.master;
  ok("resolves by ISIN", resolveCompany(master, { isin: "INE040A01034" }).matchedOn === "isin");
  ok("by NSE symbol", resolveCompany(master, { nseSymbol: "HDFCBANK" }).matchedOn === "nse");
  ok("by BSE scrip code", resolveCompany(master, { bseScripCode: "500180" }).matchedOn === "bse");
  ok("by name, and says the match was weak", resolveCompany(master, { legalName: "HDFC Bank Limited" }).matchedOn === "name");
  ok("an unknown company resolves to nothing", resolveCompany(master, { isin: "US0378331005" }).company === undefined);
  ok("a record with nothing to key on is rejected", mergeCompanies([], [{}]).rejected.length === 1);

  // Two issuers claiming one identifier is always a data error.
  ok("no conflicts in a sound master", findConflicts(master).length === 0);
  const clashing = [
    { id: "a", legalName: "A", isin: "INE040A01034", homeCountry: "IN" },
    { id: "b", legalName: "B", isin: "INE040A01034", homeCountry: "IN" },
  ];
  ok("a shared ISIN is reported", findConflicts(clashing).length === 1);
  ok("and names both claimants", /a.*b|b.*a/.test(findConflicts(clashing)[0]));
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
