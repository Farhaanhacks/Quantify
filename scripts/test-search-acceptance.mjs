#!/usr/bin/env node
// The acceptance tests for keyword search, stated as behaviour.
//
// Run: node scripts/test-search-acceptance.mjs
//
//   HDFC insurance   → HDFC Life
//   insurance HDFC   → same
//   HDFC life insurance → same
//   HDFCLIFE         → same
//   HDFC bank        → HDFC Bank, NOT HDFC Life
//   SBI insurance    → SBI Life, NOT HDFC Life
//
// These run against a LOCAL company list, which is the point: the earlier
// versions of this search asked an upstream for candidates and applied keyword
// logic to whatever came back, so a company the upstream declined to return
// could never be matched however good the matching got. Retrieval is what the
// local list fixes, and these tests only pass if retrieval is complete.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "accept-"));
execFileSync(
  "npx",
  ["tsc", join(root, "src/lib/searchRank.ts"), "--outDir", out, "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler"],
  { stdio: "pipe" }
);
const { tokensOf, coversAllTokens, rank, editDistance } = await import(join(out, "searchRank.js"));
rmSync(out, { recursive: true, force: true });

let pass = 0, fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

// A slice of the real NSE list, with the names exactly as NSE files them —
// abbreviations included, because that is what the matching has to survive.
const NSE = [
  ["HDFCLIFE", "HDFC Life Insurance Company Limited"],
  ["HDFCBANK", "HDFC Bank Limited"],
  ["HDFCAMC", "HDFC Asset Management Company Limited"],
  ["SBILIFE", "SBI Life Insurance Company Limited"],
  ["SBIN", "State Bank of India"],
  ["ICICIGI", "ICICI Lombard General Insurance Company Limited"],
  ["ICICIBANK", "ICICI Bank Limited"],
  ["LICI", "Life Insurance Corporation of India"],
  ["RELIANCE", "Reliance Industries Limited"],
  ["HCLTECH", "HCL Technologies Limited"],
];

// The local search, as src/lib/indiaCompanies.ts performs it.
const searchLocal = (tokens) =>
  NSE.map(([symbol, name]) => ({
    symbol: `${symbol}.NS`, name, type: "Common Stock", exchange: "NSE", flag: "", country: "IN", kind: "Stock",
  })).filter((c) => coversAllTokens(c, tokens));

// The route: local list + dedupe by company + rank.
function search(q) {
  const tokens = tokensOf(q);
  const hits = searchLocal(tokens);
  hits.sort((a, b) => rank(a, q) - rank(b, q));
  const seen = new Set();
  return hits
    .filter((h) => {
      const rootSym = h.symbol.replace(/\.[A-Z]{1,4}$/i, "").toUpperCase();
      if (seen.has(rootSym)) return false;
      seen.add(rootSym);
      return true;
    })
    .map((h) => h.symbol);
}

console.log("\n[acceptance]");
const cases = [
  ["HDFC insurance", "HDFCLIFE.NS"],
  ["insurance HDFC", "HDFCLIFE.NS"],
  ["HDFC life insurance", "HDFCLIFE.NS"],
  ["HDFCLIFE", "HDFCLIFE.NS"],
  ["HDFC bank", "HDFCBANK.NS"],
  ["SBI insurance", "SBILIFE.NS"],
];
for (const [q, want] of cases) {
  const got = search(q);
  check(`"${q}" → ${want}`, got[0] === want, JSON.stringify(got.slice(0, 3)));
}

console.log("\n[and the wrong company is not returned]");
check("'HDFC bank' does not return HDFC Life", !search("HDFC bank").includes("HDFCLIFE.NS"), JSON.stringify(search("HDFC bank")));
check("'SBI insurance' does not return HDFC Life", !search("SBI insurance").includes("HDFCLIFE.NS"), JSON.stringify(search("SBI insurance")));
check("'HDFC insurance' does not return HDFC Bank", !search("HDFC insurance").includes("HDFCBANK.NS"), JSON.stringify(search("HDFC insurance")));
check("'HDFC insurance' does not return SBI Life", !search("HDFC insurance").includes("SBILIFE.NS"), JSON.stringify(search("HDFC insurance")));
check("'HDFC insurance' does not return LIC", !search("HDFC insurance").includes("LICI.NS"), JSON.stringify(search("HDFC insurance")));

console.log("\n[filler words carry no weight]");
check("'HDFC insurance company limited' still finds it", search("HDFC insurance company limited")[0] === "HDFCLIFE.NS", JSON.stringify(search("HDFC insurance company limited")));
check("'the HDFC life' still finds it", search("the HDFC life")[0] === "HDFCLIFE.NS", JSON.stringify(search("the HDFC life")));
check("filler is stripped from the token list", JSON.stringify(tokensOf("HDFC Insurance Company Limited")) === '["hdfc","insurance"]', JSON.stringify(tokensOf("HDFC Insurance Company Limited")));
check("a query of only filler still searches those words", tokensOf("the company").length === 2);

console.log("\n[typos]");
check("'hdfc insurence' finds it", search("hdfc insurence")[0] === "HDFCLIFE.NS", JSON.stringify(search("hdfc insurence")));
check("'relaince' finds Reliance", search("relaince")[0] === "RELIANCE.NS", JSON.stringify(search("relaince")));
check("'technologis' finds HCL Tech", search("hcl technologis")[0] === "HCLTECH.NS", JSON.stringify(search("hcl technologis")));
check("edit distance is bounded", editDistance("insurance", "aaaaaaaaa", 2) > 2);
check("a short word gets no typo budget", !search("hdfc bnak").includes("HDFCBANK.NS"), JSON.stringify(search("hdfc bnak")));

console.log("\n[prefix and abbreviation, both directions]");
check("'hdfc ins' finds it", search("hdfc ins")[0] === "HDFCLIFE.NS", JSON.stringify(search("hdfc ins")));
check("'hcl tech' finds HCL", search("hcl tech")[0] === "HCLTECH.NS", JSON.stringify(search("hcl tech")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
