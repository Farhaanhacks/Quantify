#!/usr/bin/env node
// Tests for executive-profile matching.
//
// Run: node scripts/test-exec-profile.mjs
//
// The rule these enforce is the whole point of the feature: a profile is only
// shown when the person is corroborated as belonging to the company. Attaching
// the wrong biography to a named executive of a real listed company is a false
// statement about an identifiable person, so "no match" has to beat "probably".
//
// Wikidata and Wikipedia are not reachable from a test environment, so the
// fetching is kept out of this file and the decisions are tested on recorded
// payload shapes.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "execprofile-"));
execFileSync(
  "npx",
  ["tsc", join(root, "src/lib/execProfile.ts"), "--outDir", out, "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler"],
  { stdio: "pipe" }
);
const M = await import(join(out, "execProfile.js"));
rmSync(out, { recursive: true, force: true });

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

// Wikidata's real claim shape, trimmed to what we read.
const item = (prop, id, qualifiers) => ({
  mainsnak: { datavalue: { value: { id } } },
  ...(qualifiers ? { qualifiers } : {}),
});
const timeClaim = (t) => ({ mainsnak: { datavalue: { value: { time: t } } } });
const strClaim = (v) => ({ mainsnak: { datavalue: { value: v } } });

const NADELLA = {
  id: "Q1359884",
  labels: { en: { value: "Satya Nadella" } },
  descriptions: { en: { value: "Indian-American business executive, CEO of Microsoft" } },
  sitelinks: { enwiki: { title: "Satya Nadella" } },
  claims: {
    P31: [item("P31", "Q5")],
    P108: [item("P108", "Q2283")], // employer: Microsoft
    P69: [item("P69", "Q1165999"), item("P69", "Q1130121")],
    P512: [item("P512", "Q188833")],
    P106: [item("P106", "Q43845")],
    P569: [timeClaim("+1967-08-19T00:00:00Z")],
    P18: [strClaim("Satya Nadella 2017.jpg")],
  },
};

// Same name shape, no link to the company at all — the impostor case.
const WRONG_PERSON = {
  id: "Q999999",
  labels: { en: { value: "Satya Nadella" } },
  sitelinks: { enwiki: { title: "Satya Nadella (cricketer)" } },
  claims: { P31: [item("P31", "Q5")], P106: [item("P106", "Q12299841")] },
};

const NOT_A_PERSON = {
  id: "Q2283",
  labels: { en: { value: "Microsoft" } },
  claims: { P31: [item("P31", "Q4830453")] },
};

const LABELS = {
  Q1165999: "Manipal Institute of Technology",
  Q1130121: "University of Chicago Booth School of Business",
  Q188833: "Master of Business Administration",
  Q43845: "businessperson",
};

console.log("\n[identity — refusing the wrong person]");
check("a verified employer claim matches", M.verifyMatch(NADELLA, "Microsoft Corporation", ["Q2283"]) === "employer-claim");
check("no company link → no match", M.verifyMatch(WRONG_PERSON, "Microsoft Corporation", ["Q2283"]) === null);
check("a company is not a person", M.verifyMatch(NOT_A_PERSON, "Microsoft Corporation", ["Q2283"]) === null);
check("name alone is never enough", M.verifyMatch(WRONG_PERSON, "Microsoft Corporation", []) === null);

console.log("\n[identity — position qualified by company]");
const CHAIR = {
  id: "Q42",
  labels: { en: { value: "A Chair" } },
  claims: {
    P31: [item("P31", "Q5")],
    P39: [item("P39", "Q484876", { P642: [{ datavalue: { value: { id: "Q2283" } } }] })],
  },
};
check("'position held … of <company>' matches", M.verifyMatch(CHAIR, "Microsoft", ["Q2283"]) === "position-claim");
check("the same position at another company does not", M.verifyMatch(CHAIR, "Apple", ["Q312"]) === null);

console.log("\n[identity — falling back to the article text]");
const SUMMARY_ONLY = { id: "Q7", labels: { en: { value: "Some Exec" } }, claims: { P31: [item("P31", "Q5")] } };
check(
  "a summary naming the company matches",
  M.verifyMatch(SUMMARY_ONLY, "Vedanta Aluminium Metal Limited", [], "He is the chief executive of Vedanta Aluminium Metal, a subsidiary.") === "summary-mentions-company"
);
check(
  "a partial name does NOT match",
  M.verifyMatch(SUMMARY_ONLY, "Vedanta Aluminium Metal Limited", [], "He is an executive at Vedanta Limited.") === null
);
check(
  "an unrelated summary does not match",
  M.verifyMatch(SUMMARY_ONLY, "Microsoft Corporation", [], "He is a cricketer who played for Hyderabad.") === null
);

console.log("\n[company name normalising]");
check("legal suffixes ignored", M.normaliseOrg("Reliance Industries Limited") === "reliance industries");
check("punctuation ignored", M.normaliseOrg("Larsen & Toubro Ltd.") === "larsen toubro");
check("short words dropped from tokens", JSON.stringify(M.orgTokens("HDFC Life Insurance Co")) === '["hdfc","life","insurance"]');

console.log("\n[building the profile]");
const p = M.buildProfile(NADELLA, "employer-claim", LABELS);
check("name", p.name === "Satya Nadella");
check("education resolved to labels", p.education.length === 2 && p.education[0] === "Manipal Institute of Technology", JSON.stringify(p.education));
check("degree resolved", p.degrees[0] === "Master of Business Administration", JSON.stringify(p.degrees));
check("birth year parsed from Wikidata time", p.birthYear === 1967, String(p.birthYear));
check("image is a Commons file name", p.image === "Satya Nadella 2017.jpg", String(p.image));
check("wiki title captured", p.wikiTitle === "Satya Nadella");
check("match reason carried through", p.matchedOn === "employer-claim");
check("unlabelled QIDs are dropped, not shown raw", !JSON.stringify(p).includes("Q1165999"));
check("lists every QID needing a label", M.referencedIds(NADELLA).length === 4, JSON.stringify(M.referencedIds(NADELLA)));

console.log("\n[refusing an empty profile]");
check("a profile with real fields is shown", M.isSubstantive(p));
const bare = M.buildProfile(SUMMARY_ONLY, "summary-mentions-company", {});
check("name-only is NOT worth a card", !M.isSubstantive(bare));
check("a long extract alone is enough", M.isSubstantive(bare, "x".repeat(200)));
check("a short extract is not", !M.isSubstantive(bare, "Short."));

console.log("\n[name drift between filings and encyclopaedias]");
check("Jen-Hsun Huang is Jensen Huang", M.samePerson("Mr. Jen-Hsun Huang", "Jensen Huang"));
check("honorific ignored", M.samePerson("Ms. Colette M. Kress", "Colette Kress"));
check("middle initial ignored", M.samePerson("Colette Kress", "Colette M. Kress"));
check("post-nominals ignored", M.samePerson("Prof. William J. Dally Ph.D.", "William Dally"));
check("first initial matches a full given name", M.samePerson("J. Huang", "Jensen Huang"));
check("a different surname is a different person", !M.samePerson("Jensen Huang", "Jensen Wang"));
check("a different given name is a different person", !M.samePerson("Michael Huang", "Jensen Huang"));
check("prefix rule is not a free pass", !M.samePerson("Ajay Puri", "Sanjay Puri"));
check("a single name never matches", !M.samePerson("Huang", "Jensen Huang"));

console.log("\n[reading leadership off the COMPANY item]");
const NVIDIA = {
  id: "Q182477",
  labels: { en: { value: "Nvidia" } },
  claims: {
    P31: [item("P31", "Q4830453")],
    P169: [item("P169", "Q92466")],       // chief executive officer
    P112: [item("P112", "Q92466"), item("P112", "Q7676")], // founded by
    P3320: [item("P3320", "Q555")],       // board member
  },
};
const ids = M.leadershipIds(NVIDIA);
check("collects the CEO", ids.includes("Q92466"), JSON.stringify(ids));
check("collects founders and board", ids.includes("Q7676") && ids.includes("Q555"), JSON.stringify(ids));
check("deduplicates a person listed twice", ids.filter((x) => x === "Q92466").length === 1);
check("a company with no leadership claims yields none", M.leadershipIds({ id: "Q1", claims: {} }).length === 0);

console.log("\n[aliases are where the filed spelling lives]");
const HUANG = {
  id: "Q92466",
  labels: { en: { value: "Jensen Huang" } },
  aliases: { en: [{ value: "Jen-Hsun Huang" }, { value: "Huang Jen-hsun" }] },
};
const names = M.allNames(HUANG);
check("label and aliases returned", names.length === 3, JSON.stringify(names));
check("the filed name matches through an alias", names.some((n) => M.samePerson("Mr. Jen-Hsun Huang", n)));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
