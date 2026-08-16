#!/usr/bin/env node
// Tests for the TWSE / TPEx insider parser.
//
// Run: node scripts/test-taiwan-insider.mjs
//
// These exist because of how the previous Taiwan integration failed. It asked a
// third-party mirror for a dataset, got nothing back, and the page reported
// "no insider disclosures found" — a statement about a real company that we had
// no basis for. Nothing failed loudly; the feature simply asserted something
// false, for every Taiwanese company, indefinitely.
//
// So the two things under test are:
//
//   1. The columns. They are Chinese, the exchange renames them between
//      revisions, and a renamed column must FAIL here rather than produce rows
//      with blanks — or no rows at all, which is the shape the old bug took.
//   2. The wording. None of these three datasets reports a trade, and the tests
//      assert that no output says "bought" or "sold".
//
// On the fixtures: they are reconstructed from the published schemas, not
// captured live — see scripts/fixtures/taiwan/README.md, which also gives the
// curl commands to replace them with real captures.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "twinsider-"));
execFileSync(
  "npx",
  ["tsc", join(root, "src/lib/taiwan/insiderParse.ts"), "--outDir", out, "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler"],
  { stdio: "pipe" }
);
const {
  parseTaiwanDataset,
  describeTaiwanRecord,
  taiwanRecordId,
  toIsoDate,
  toIsoMonth,
  toShares,
  resolveColumn,
  EVENT_LABEL,
} = await import(join(out, "insiderParse.js"));
rmSync(out, { recursive: true, force: true });

let pass = 0;
let fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const FIX = join(root, "scripts/fixtures/taiwan");
const load = (f) => JSON.parse(readFileSync(join(FIX, f), "utf8"));

const SPECS = [
  ["t187ap11_L.json", "TWSE", "holding_snapshot"],
  ["t187ap12_L.json", "TWSE", "planned_transfer"],
  ["t187ap13_L.json", "TWSE", "untransferred"],
  ["t187ap11_O.json", "TPEx", "holding_snapshot"],
  ["t187ap12_O.json", "TPEx", "planned_transfer"],
  ["t187ap13_O.json", "TPEx", "untransferred"],
];

const parseFixture = (file, market, eventType) =>
  parseTaiwanDataset({
    rows: load(file),
    market,
    eventType,
    sourceUrl: "https://example.invalid/dataset",
  });

console.log("\n[every dataset parses, and every fixture is covered]");
const files = readdirSync(FIX).filter((f) => f.endsWith(".json"));
check("a test exists for each saved sample", files.length === SPECS.length,
  `${files.length} files, ${SPECS.length} specs`);
for (const [file, market, eventType] of SPECS) {
  const r = parseFixture(file, market, eventType);
  check(`${file} → rows`, r.records.length === r.rowsIn, `${r.records.length}/${r.rowsIn}`);
  check(`${file} → no missing columns`, r.missingColumns.length === 0, r.missingColumns.join(","));
  check(`${file} → market is ${market}`, r.records.every((x) => x.market === market));
  check(`${file} → event type is ${eventType}`, r.records.every((x) => x.eventType === eventType));
  check(`${file} → every record has a company, person and date`,
    r.records.every((x) => x.companyId && x.person && /^\d{4}-\d{2}-\d{2}$/.test(x.filingDate)));
  check(`${file} → attribution rides on every record`,
    r.records.every((x) => x.sourceAgency && x.sourceUrl));
}

console.log("\n[a renamed column fails loudly — the whole point]");
// Exactly the failure the old integration hid: the payload arrives, it is valid
// JSON, it has rows — and the columns are not the ones we read. That must be a
// parse failure the API reports as "source unavailable", never zero records that
// the page renders as "this company disclosed nothing".
const renamed = load("t187ap11_L.json").map((row) => {
  const copy = { ...row };
  copy["公司代碼X"] = copy["公司代號"]; // renamed away from every known alias
  delete copy["公司代號"];
  return copy;
});
const broken = parseTaiwanDataset({
  rows: renamed,
  market: "TWSE",
  eventType: "holding_snapshot",
  sourceUrl: "u",
});
check("a renamed required column is reported", broken.missingColumns.includes("companyId"),
  JSON.stringify(broken.missingColumns));
check("and no records are invented from it", broken.records.length === 0);
check("the payload's real columns are handed back for diagnosis",
  broken.seenColumns.includes("公司代碼X"), JSON.stringify(broken.seenColumns));

// An alias that IS known must keep working — the tolerance has to be real, or
// every revision becomes an outage.
const aliased = load("t187ap11_L.json").map((row) => {
  const copy = { ...row };
  copy["證券代號"] = copy["公司代號"];
  delete copy["公司代號"];
  return copy;
});
const viaAlias = parseTaiwanDataset({ rows: aliased, market: "TWSE", eventType: "holding_snapshot", sourceUrl: "u" });
check("a known alias still resolves", viaAlias.records.length === aliased.length, String(viaAlias.records.length));
check("resolveColumn picks the name that is present",
  resolveColumn(["證券代號", "姓名"], "companyId") === "證券代號");
check("and reports nothing when none is", resolveColumn(["公司代碼X"], "companyId") === null);

console.log("\n[the Minguo calendar]");
// 1140815 is 15 August 2025, not year 114. Reading it as Gregorian puts every
// filing eleven centuries in the past and sorts the newest ones to the bottom.
check("packed ROC date", toIsoDate("1140815") === "2025-08-15", toIsoDate("1140815"));
check("ROC with slashes", toIsoDate("114/08/15") === "2025-08-15", toIsoDate("114/08/15"));
check("two-digit ROC year", toIsoDate("990815") === "2010-08-15", toIsoDate("990815"));
check("an ISO date passes through", toIsoDate("2025-08-15") === "2025-08-15");
check("a packed Gregorian date is not shifted", toIsoDate("20250815") === "2025-08-15");
check("nonsense yields nothing rather than a wrong date", toIsoDate("not a date") === undefined);
check("an empty value yields nothing", toIsoDate("") === undefined && toIsoDate(null) === undefined);
check("ROC month", toIsoMonth("11407") === "2025-07", toIsoMonth("11407"));
check("ISO month passes through", toIsoMonth("2025-07") === "2025-07");

console.log("\n[share counts]");
check("thousands separators", toShares("1,250,000") === 1250000);
check("full-width digits", toShares("１２３") === 123);
check("a placeholder dash is absent, not zero", toShares("-") === undefined);
check("zero is a real value and stays zero", toShares("0") === 0);
check("a non-numeric string is absent, not zero", toShares("n/a") === undefined);
check("a missing field is absent", toShares(undefined) === undefined);

console.log("\n[the wording — no dataset here reports a trade]");
const snaps = parseFixture("t187ap11_L.json", "TWSE", "holding_snapshot").records;
const plans = parseFixture("t187ap12_L.json", "TWSE", "planned_transfer").records;
const untrans = parseFixture("t187ap13_L.json", "TWSE", "untransferred").records;
const allText = [...snaps, ...plans, ...untrans].map(describeTaiwanRecord).join(" | ");

check("nothing says bought/sold/purchase/sale", !/\b(bought|sold|buy|sell|sale|purchase)\b/i.test(allText), allText);
check("a rising holding says 'Holdings increased'",
  describeTaiwanRecord(snaps[0]).includes("Holdings increased"), describeTaiwanRecord(snaps[0]));
check("a falling holding says 'Holdings decreased'",
  describeTaiwanRecord(snaps[1]).includes("Holdings decreased"), describeTaiwanRecord(snaps[1]));
check("a declaration says 'Planned transfer'",
  describeTaiwanRecord(plans[0]).startsWith("Planned transfer"), describeTaiwanRecord(plans[0]));
check("and carries the method and window",
  /一般交易/.test(describeTaiwanRecord(plans[0])) && /114\/08\/15/.test(describeTaiwanRecord(plans[0])),
  describeTaiwanRecord(plans[0]));
check("an unexecuted declaration says so",
  describeTaiwanRecord(untrans[0]).startsWith("Declared but not transferred"),
  describeTaiwanRecord(untrans[0]));
check("a holding with no 'before' still describes the position",
  describeTaiwanRecord(snaps[2]).includes("shares held") &&
    !/increased|decreased/.test(describeTaiwanRecord(snaps[2])),
  describeTaiwanRecord(snaps[2]));
check("the event labels never name a side",
  !/buy|sell/i.test(Object.values(EVENT_LABEL).join(" ")), JSON.stringify(EVENT_LABEL));

console.log("\n[the fields the store keeps]");
const snap = snaps[0];
check("a snapshot carries a position, not a transaction",
  snap.sharesAfter === 1250000 && snap.sharesBefore === 1000000 && snap.shares === undefined,
  JSON.stringify(snap));
check("and its reporting month", snap.reportingMonth === "2025-07", snap.reportingMonth);
check("pledged shares are kept", snaps[1].sharesPledged === 120000, String(snaps[1].sharesPledged));
const plan = plans[0];
check("a planned transfer carries the intended size", plan.shares === 50000, String(plan.shares));
check("its method and period", plan.transferMethod === "一般交易" && !!plan.transferPeriod);
check("the declaration date, not the table date",
  plan.filingDate === "2025-08-12", plan.filingDate);
check("an untransferred row carries what was left", untrans[0].shares === 20000, String(untrans[0].shares));
check("TPEx rows are marked TPEx, not TWSE",
  parseFixture("t187ap11_O.json", "TPEx", "holding_snapshot").records[0].sourceAgency === "Taipei Exchange");

console.log("\n[ids are stable and unique]");
const ids = [...snaps, ...plans, ...untrans].map(taiwanRecordId);
check("no duplicates across a run", new Set(ids).size === ids.length, JSON.stringify(ids));
check("re-parsing the same file gives the same ids",
  JSON.stringify(parseFixture("t187ap11_L.json", "TWSE", "holding_snapshot").records.map(taiwanRecordId)) ===
    JSON.stringify(snaps.map(taiwanRecordId)));
check("the same person's two event types don't collide",
  taiwanRecordId(plans[0]) !== taiwanRecordId(untrans[0]));

console.log("\n[an empty payload is not a schema failure]");
const empty = parseTaiwanDataset({ rows: [], market: "TWSE", eventType: "holding_snapshot", sourceUrl: "u" });
check("no rows, no records", empty.records.length === 0);
check("and no false claim that the columns are wrong", empty.missingColumns.length === 0,
  JSON.stringify(empty.missingColumns));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
