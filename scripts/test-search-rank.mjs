#!/usr/bin/env node
// Tests for symbol-search ranking and word matching.
//
// Run: node scripts/test-search-rank.mjs
//
// These exist because the thing they check cannot be checked any other way in a
// test environment: the route reaches Yahoo and EODHD, both unreachable from
// CI, so every ordering change here used to ship on reasoning alone. The pure
// logic lives in src/lib/searchRank.ts precisely so it can be exercised here.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "searchrank-"));
execFileSync(
  "npx",
  ["tsc", join(root, "src/lib/searchRank.ts"), "--outDir", out, "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler"],
  { stdio: "pipe" }
);
const { tokensOf, coversAllTokens, rank, wordMatches } = await import(join(out, "searchRank.js"));
rmSync(out, { recursive: true, force: true });

let pass = 0;
let fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

const stock = (symbol, name, exchange = "NSE") => ({
  symbol, name, type: "Common Stock", exchange, flag: "", kind: "Stock",
});

const HDFC_LIFE = stock("HDFCLIFE.NS", "HDFC Life Insurance Company Limited");
const HDFC_BANK = stock("HDFCBANK.NS", "HDFC Bank Limited");
const SBI_LIFE = stock("SBILIFE.NS", "SBI Life Insurance Company Limited");
const ICICI_LOMBARD = stock("ICICIGI.NS", "ICICI Lombard General Insurance Company Limited");

// Order results the way the route does.
const order = (hits, q) => [...hits].sort((a, b) => rank(a, q) - rank(b, q)).map((h) => h.symbol);

console.log("\n[tokenising]");
check("splits on whitespace", JSON.stringify(tokensOf("hdfc insurance")) === '["hdfc","insurance"]');
check("drops punctuation", JSON.stringify(tokensOf("HDFC Life Insurance Co.")) === '["hdfc","life","insurance","co"]');
check("ignores one-letter fragments", JSON.stringify(tokensOf("a hdfc")) === '["hdfc"]');
check("case-insensitive", JSON.stringify(tokensOf("HDFC")) === '["hdfc"]');

console.log("\n[word coverage, order-independent]");
const t = tokensOf("hdfc insurance");
check("matches words out of order", coversAllTokens(HDFC_LIFE, t));
check("rejects a row missing a word", !coversAllTokens(HDFC_BANK, t));
check("rejects a different insurer", !coversAllTokens(SBI_LIFE, t));
check("matches on the symbol too", coversAllTokens(stock("X.NS", "Life Insurance Corp"), tokensOf("life x")));

console.log("\n[ranking: the reported bug]");
const pool = [SBI_LIFE, ICICI_LOMBARD, HDFC_BANK, HDFC_LIFE];
const scrambled = order(pool, "hdfc insurance");
check("'hdfc insurance' ranks HDFC Life first", scrambled[0] === "HDFCLIFE.NS", scrambled.join(","));
const reversed = order(pool, "insurance hdfc");
check("'insurance hdfc' ranks HDFC Life first", reversed[0] === "HDFCLIFE.NS", reversed.join(","));
const ordered = order(pool, "hdfc life insurance");
check("the registered order still ranks it first", ordered[0] === "HDFCLIFE.NS", ordered.join(","));

console.log("\n[ranking: nothing else regressed]");
check("a single word still favours the exact name", order([HDFC_BANK, HDFC_LIFE], "hdfc bank")[0] === "HDFCBANK.NS");
check("an exact ticker wins", order([SBI_LIFE, HDFC_LIFE], "HDFCLIFE")[0] === "HDFCLIFE.NS");
check(
  "companies still outrank funds",
  order(
    [{ ...stock("0P00.BO", "HDFC Insurance Fund"), kind: "Fund" }, HDFC_LIFE],
    "hdfc insurance"
  )[0] === "HDFCLIFE.NS"
);
check(
  "a row named only after its own code sinks",
  order([stock("0P0000GBDS.BO", "0P0000GBDS.BO"), HDFC_LIFE], "hdfc insurance")[0] === "HDFCLIFE.NS"
);

console.log("\n[abbreviated exchange names — the reported miss]");
// These are the EXACT names the app displayed for this company.
const NSE_ABBREV = stock("HDFCLIFE.NS", "HDFC LIFE INS CO LTD");
const BSE_TRUNC = stock("HDFCLIFE.BO", "HDFC LIFE INSURANCE COMPANY LI", "Bombay");
const t2 = tokensOf("hdfc insurance");
check("'insurance' matches a filing that says 'INS'", coversAllTokens(NSE_ABBREV, t2), JSON.stringify(t2));
check("the spelled-out listing still matches", coversAllTokens(BSE_TRUNC, t2));
check("'hdfc insurance' ranks the insurer above the bank", order([HDFC_BANK, NSE_ABBREV], "hdfc insurance")[0] === "HDFCLIFE.NS", order([HDFC_BANK, NSE_ABBREV], "hdfc insurance").join(","));
check("typing the abbreviation works too", coversAllTokens(BSE_TRUNC, tokensOf("hdfc ins")));
check("'co' matches 'COMPANY'", coversAllTokens(BSE_TRUNC, tokensOf("hdfc co")));

console.log("\n[the loosening must not match everything]");
check("a two-letter fragment does not match a long word", !coversAllTokens(stock("X.NS", "Indus Towers Limited"), tokensOf("hdfc in")));
check("an unrelated insurer is still excluded", !coversAllTokens(SBI_LIFE, t2));
check("a bank is still excluded", !coversAllTokens(HDFC_BANK, t2));
check("'tech' matches 'TECHNOLOGIES'", coversAllTokens(stock("HCLTECH.NS", "HCL TECHNOLOGIES LTD"), tokensOf("hcl tech")));
check("'technologies' matches a filing that says 'TECH'", coversAllTokens(stock("HCLTECH.NS", "HCL TECH LTD"), tokensOf("hcl technologies")));
check("a different company is not dragged in", !coversAllTokens(stock("TCS.NS", "TATA CONSULTANCY SERVICES LTD"), tokensOf("hcl technologies")));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
