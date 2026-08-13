#!/usr/bin/env node
// Tests for the executive roster: parsing and, above all, ordering.
//
// Run: node scripts/test-officers.mjs
//
// Yahoo returns companyOfficers in no useful sequence — frequently alphabetical,
// which puts the Chief Accounting Officer at the top and the CEO fourth. A
// reader opening "who runs the company" wants the CEO first. That ordering is
// invisible to a rendering test that mocks the API (the sort runs server-side),
// so it is asserted here instead.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "officers-"));
execFileSync(
  "npx",
  ["tsc", join(root, "src/lib/officers.ts"), "--outDir", out, "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler"],
  { stdio: "pipe" }
);
const { parseOfficers, officerRank } = await import(join(out, "officers.js"));
rmSync(out, { recursive: true, force: true });

let pass = 0;
let fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

// Exactly the shape Yahoo sends, alphabetical — the order that caused this.
const RAW = [
  { name: "Ms. Alpha Accountant", title: "Chief Accounting Officer", age: 48, totalPay: { raw: 12000000 }, fiscalYear: 2025 },
  { name: "Mr. Cee Efoh", title: "Chief Financial Officer", age: 52, totalPay: { raw: 41000000 }, fiscalYear: 2025 },
  { name: "Mr. Bee Oh", title: "Chief Operating Officer", age: 55, totalPay: { raw: 52000000 }, fiscalYear: 2025 },
  { name: "Mr. Dee Chairman", title: "Chairman of the Board", age: 67 },
  { name: "Mr. Eee Boss", title: "MD & Chief Executive Officer", age: 58, totalPay: { raw: 91000000 }, fiscalYear: 2025 },
  { name: "Ms. Eff Tee", title: "Chief Technology Officer", age: 45 },
];

const names = (arr) => arr.map((o) => o.name);

console.log("\n[parsing]");
const parsed = parseOfficers(RAW);
check("returns every complete row", parsed.length === 6, String(parsed?.length));
check("unwraps Yahoo's {raw:…} numbers", parsed.find((o) => o.name === "Mr. Eee Boss").totalPay === 91000000);
check("keeps age", parsed.find((o) => o.name === "Mr. Eee Boss").age === 58);
check("keeps fiscal year", parsed.find((o) => o.name === "Mr. Eee Boss").fiscalYear === 2025);
check("drops rows with no title", parseOfficers([{ name: "No Title" }, ...RAW]).length === 6);
check("drops rows with no name", parseOfficers([{ title: "CEO" }, ...RAW]).length === 6);
check("undefined for a non-array", parseOfficers(undefined) === undefined);
check("undefined when nothing usable", parseOfficers([{ foo: 1 }]) === undefined);
check("caps the list at 12", parseOfficers(Array.from({ length: 30 }, (_, i) => ({ name: `P${i}`, title: "Director" }))).length === 12);

console.log("\n[ordering — the reason this file exists]");
const order = names(parsed);
check("CEO first, not the accountant", order[0] === "Mr. Eee Boss", order.join(" | "));
check("Chairman above the COO", order.indexOf("Mr. Dee Chairman") < order.indexOf("Mr. Bee Oh"), order.join(" | "));
check("COO above the CFO", order.indexOf("Mr. Bee Oh") < order.indexOf("Mr. Cee Efoh"), order.join(" | "));
check("CFO above the CTO", order.indexOf("Mr. Cee Efoh") < order.indexOf("Ms. Eff Tee"), order.join(" | "));
check("Chief Accounting Officer last", order[order.length - 1] === "Ms. Alpha Accountant", order.join(" | "));

console.log("\n[title variants seen in real filings]");
check("a combined Chairman & CEO outranks a plain CEO", officerRank("Chairman & Chief Executive Officer") < officerRank("Chief Executive Officer"));
check("Indian 'MD & CEO' reads as CEO", officerRank("MD & CEO") <= officerRank("Chief Executive Officer"));
check("'Managing Director' reads as CEO", officerRank("Managing Director") === officerRank("MD & CEO"));
check("Chairperson matches Chairman", officerRank("Chairperson") === officerRank("Chairman"));
check("an unknown title sorts last", officerRank("Head of Sundries") > officerRank("Company Secretary"));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
