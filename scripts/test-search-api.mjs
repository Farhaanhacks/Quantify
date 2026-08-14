#!/usr/bin/env node
// End-to-end behaviour of symbol search, with the upstream indexes stubbed to
// behave the way the real ones do: a PHRASE they do not know returns nothing,
// a single word returns that word's companies.
//
// Run: node scripts/test-search-api.mjs
//
// This exists because the unit tests on searchRank kept passing while the live
// search kept failing. They tested whether a row MATCHES; they never tested
// whether the row is ever fetched in the first place. This mirrors the route's
// own algorithm over a stubbed index and asserts the thing the user actually
// asked for: that word order does not matter.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "srch-"));
execFileSync("npx", ["tsc", join(root, "src/lib/searchRank.ts"), "--outDir", out,
  "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler"], { stdio: "pipe" });
const { tokensOf, coversAllTokens, rank } = await import(join(out, "searchRank.js"));
rmSync(out, { recursive: true, force: true });

let pass = 0, fail = 0;
const check = (n, c, e = "") => { if (c) { pass++; console.log(`  ok   ${n}`); } else { fail++; console.log(`  FAIL ${n} ${e}`); } };

const S = (symbol, name, kind = "Stock", exchange = "NSE") => ({ symbol, name, type: "", exchange, flag: "", kind });

// What the real indexes return, per the app's own screenshots.
const INDEX = {
  "hdfc life": [S("HDFCLIFE.NS", "HDFC LIFE INS CO LTD"), S("HDFCLIFE.BO", "HDFC LIFE INSURANCE COMPANY LI", "Stock", "Bombay")],
  hdfc: [S("HDFCBANK.NS", "HDFC BANK LTD"), S("HDFCAMC.NS", "HDFC ASSET MANAGEMENT CO LTD"), S("HDFCLIFE.NS", "HDFC LIFE INS CO LTD")],
  insurance: [S("SBILIFE.NS", "SBI LIFE INSURANCE CO LTD"), S("ICICIGI.NS", "ICICI LOMBARD GEN INSURANCE"), S("HDFCLIFE.BO", "HDFC LIFE INSURANCE COMPANY LI", "Stock", "Bombay")],
  life: [S("SBILIFE.NS", "SBI LIFE INSURANCE CO LTD"), S("HDFCLIFE.NS", "HDFC LIFE INS CO LTD")],
};
const search = (q) => INDEX[q.toLowerCase().trim()] ?? [];   // a phrase it doesn't know → nothing

// The route's algorithm, mirrored.
function route(q) {
  const merged = [];
  const seen = new Set();
  for (const hit of search(q)) {
    const k = hit.symbol.toUpperCase();
    if (!seen.has(k)) { seen.add(k); merged.push(hit); }
  }
  const tokens = tokensOf(q).slice(0, 4);
  if (tokens.length > 1) {
    const candidates = [];
    for (const hit of tokens.flatMap((w) => search(w))) {
      const k = hit.symbol.toUpperCase();
      if (!seen.has(k)) { seen.add(k); candidates.push(hit); }
    }
    // EVERY word, or the row does not appear. No "closest match" consolation.
    for (const hit of candidates) if (coversAllTokens(hit, tokens)) merged.push(hit);
  }
  merged.sort((a, b) => rank(a, q) - rank(b, q));
  return merged.slice(0, 8).map((h) => h.symbol);
}

console.log("\n[the reported query]");
const r1 = route("hdfc insurance");
check("'hdfc insurance' returns HDFC Life", r1.some((s) => s.startsWith("HDFCLIFE")), JSON.stringify(r1));
check("and puts it first", r1[0]?.startsWith("HDFCLIFE"), JSON.stringify(r1));
check("does not return HDFC Bank", !r1.includes("HDFCBANK.NS"), JSON.stringify(r1));
check("does not return SBI Life", !r1.includes("SBILIFE.NS"), JSON.stringify(r1));

console.log("\n[order genuinely does not matter]");
for (const q of ["hdfc insurance", "insurance hdfc", "hdfc life", "life hdfc", "hdfc ins", "insurance HDFC"]) {
  const r = route(q);
  check(`"${q}" finds HDFC Life`, r.some((s) => s.startsWith("HDFCLIFE")), JSON.stringify(r));
}

console.log("\n[single word and known phrases still work]");
check("'hdfc' returns the HDFC companies", route("hdfc").length === 3, JSON.stringify(route("hdfc")));
check("'hdfc life' still works", route("hdfc life").some((s) => s.startsWith("HDFCLIFE")));
check("'insurance' alone lists insurers", route("insurance").includes("SBILIFE.NS"));

console.log("\n[a query matching nothing in full returns NOTHING]");
// A previous version offered "rows matching the most words" here, which
// answered "hdfc insurance" with Zurich, UNIQA, Goosehead and The Hartford.
// A list of plausible wrong answers is worse than an empty one.
const r2 = route("hdfc aviation");
check("no partial matches are offered", r2.length === 0, JSON.stringify(r2));

console.log("\n[the wrong answers that were shipped]");
INDEX.insurance = INDEX.insurance.concat([
  S("ZURN.SW", "ZURICH INSURANCE N", "Stock", "Swiss"),
  S("UQA.VI", "UNIQA Insurance Group AG", "Stock", "Vienna"),
  S("GSHD", "Goosehead Insurance, Inc.", "Stock", "NASDAQ"),
  S("HIG", "The Hartford Insurance Group, I", "Stock", "NYSE"),
  S("LICI.NS", "LIFE INSURA CORP OF INDIA"),
]);
const r3 = route("hdfc insurance");
check("no Zurich", !r3.includes("ZURN.SW"), JSON.stringify(r3));
check("no UNIQA", !r3.includes("UQA.VI"), JSON.stringify(r3));
check("no Goosehead", !r3.includes("GSHD"), JSON.stringify(r3));
check("no Hartford", !r3.includes("HIG"), JSON.stringify(r3));
check("no LIC", !r3.includes("LICI.NS"), JSON.stringify(r3));
check("no HDFC Bank", !r3.includes("HDFCBANK.NS"), JSON.stringify(r3));
check("still finds HDFC Life", r3.some((x) => x.startsWith("HDFCLIFE")), JSON.stringify(r3));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
