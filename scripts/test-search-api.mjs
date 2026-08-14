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
    for (const hit of candidates) if (coversAllTokens(hit, tokens)) merged.push(hit);
    if (!merged.length) {
      const scored = candidates.map((h) => ({ h, n: tokens.filter((t) => coversAllTokens(h, [t])).length }))
        .filter((x) => x.n > 0).sort((a, b) => b.n - a.n);
      const best = scored[0]?.n ?? 0;
      for (const x of scored) if (x.n === best) merged.push(x.h);
    }
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

console.log("\n[a query matching nothing in full]");
const r2 = route("hdfc aviation");
check("falls back to the closest rather than an empty panel", r2.length > 0, JSON.stringify(r2));
check("and that fallback is the HDFC rows", r2.every((s) => s.startsWith("HDFC")), JSON.stringify(r2));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
