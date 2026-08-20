#!/usr/bin/env node
// Acceptance tests for listing selection and company grouping.
//
// Run: node scripts/test-listing-rank.mjs
//
// The bug: searching "nike" returned Stuttgart:NKE.SG and nothing else. Four
// faults lined up, and each gets its own tests here.
//
//   1. No exchange ranking, so a German secondary venue and the New York Stock
//      Exchange were interchangeable and the tie fell to name length.
//   2. De-duplication on the ticker ROOT, so NKE and NKE.SG were one string.
//   3. The de-duplication DELETED the alternatives rather than keeping them.
//   4. An "NYSE:" prefix was stripped from the query and discarded.
//
// The ordering rule that matters most is the one that is easy to get backwards:
// a depositary receipt is not the ordinary share. NYSE outranks every venue for
// an American company, and NSE outranks the New York ADR for an Indian one,
// because the ADR is a receipt for the shares that trade in Mumbai.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "listingrank-"));
execFileSync(
  "npx",
  ["tsc", join(root, "src/lib/listingRank.ts"), "--outDir", out, "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler"],
  { stdio: "pipe" }
);
const {
  parseSearchQuery,
  exchangeCodeOf,
  exchangeRank,
  isDepositaryReceipt,
  listingPreference,
  companyIdentity,
  normaliseCompanyName,
  groupListings,
} = await import(join(out, "listingRank.js"));
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

// The listings a search for "nike" actually returns, Stuttgart first, which is
// the order that produced the bug.
const NIKE = [
  { symbol: "NKE.SG", name: "Nike Inc.", type: "Equity", exchange: "Stuttgart", country: "DE", currency: "EUR", kind: "Stock" },
  { symbol: "NIKE80.BK", name: "NIKE80_DR NIKE#KTB", type: "Equity", exchange: "SET", country: "TH", currency: "THB", kind: "Stock" },
  { symbol: "0QZ6.L", name: "NIKE INC NIKE ORD CLASS B", type: "Equity", exchange: "London", country: "GB", currency: "GBP", kind: "Stock" },
  { symbol: "NKE", name: "NIKE, Inc.", type: "Equity", exchange: "NYSE", country: "US", currency: "USD", kind: "Stock" },
];

// ── Exchange codes ──────────────────────────────────────────────────────────
{
  ok("NYSE by name", exchangeCodeOf({ symbol: "NKE", name: "", type: "", exchange: "NYSE" }) === "NYSE");
  ok("New York Stock Exchange by name", exchangeCodeOf({ symbol: "NKE", name: "", type: "", exchange: "New York Stock Exchange" }) === "NYSE");
  ok("Stuttgart by name", exchangeCodeOf({ symbol: "NKE.SG", name: "", type: "", exchange: "Stuttgart" }) === "STU");
  ok("Stuttgart by suffix alone", exchangeCodeOf({ symbol: "NKE.SG", name: "", type: "", exchange: "" }) === "STU");
  ok("NSE by suffix", exchangeCodeOf({ symbol: "HDFCBANK.NS", name: "", type: "", exchange: "" }) === "NSE");
  ok("BSE by suffix", exchangeCodeOf({ symbol: "HDFCBANK.BO", name: "", type: "", exchange: "" }) === "BSE");
  ok("London by suffix", exchangeCodeOf({ symbol: "0QZ6.L", name: "", type: "", exchange: "" }) === "LSE");
  ok("NYSE Arca is not NYSE", exchangeCodeOf({ symbol: "X", name: "", type: "", exchange: "NYSE Arca" }) === "NYSE ARCA");
  ok("NYSE American is not NYSE", exchangeCodeOf({ symbol: "X", name: "", type: "", exchange: "NYSE American" }) === "NYSE AMERICAN");
  ok("an unknown row is not claimed as NYSE", exchangeCodeOf({ symbol: "ABC", name: "", type: "", exchange: "" }) !== "NYSE");
}

// ── Ranking ─────────────────────────────────────────────────────────────────
{
  const at = (ex, sym = "X") => exchangeRank({ symbol: sym, name: "", type: "", exchange: ex });
  ok("NYSE outranks NASDAQ", at("NYSE") < at("NASDAQ"));
  ok("NASDAQ outranks NYSE American", at("NASDAQ") < at("NYSE American"));
  ok("NYSE American outranks NYSE Arca", at("NYSE American") < at("NYSE Arca"));
  ok("NYSE Arca outranks a home market", at("NYSE Arca") < at("NSE"));
  ok("NSE outranks BSE", at("NSE") < at("BSE"));
  ok("a home market outranks a major global venue", at("NSE") < at("XETRA"));
  ok("a major venue outranks a secondary quotation", at("XETRA") < at("Stuttgart"));
  ok("a secondary quotation outranks OTC", at("Stuttgart") < at("OTC"));
  ok("OTC outranks nothing but grey", at("OTC") < at("Grey Market"));
  // The headline requirement.
  for (const ex of ["NASDAQ", "NYSE American", "NSE", "BSE", "LSE", "XETRA", "Stuttgart", "OTC"]) {
    ok(`NYSE beats ${ex}`, at("NYSE") < at(ex));
  }
}

// ── Depositary receipts ─────────────────────────────────────────────────────
{
  const adr = { symbol: "HDB", name: "HDFC Bank Limited", type: "ADR", exchange: "NYSE" };
  ok("an ADR type is detected", isDepositaryReceipt(adr) === true);
  ok("an ADR in the name is detected", isDepositaryReceipt({ symbol: "X", name: "Infosys Ltd ADR", type: "Equity", exchange: "NYSE" }) === true);
  ok("a GDR is detected", isDepositaryReceipt({ symbol: "X", name: "Some Co GDR", type: "Equity", exchange: "LSE" }) === true);
  ok("an ordinary share is not", isDepositaryReceipt({ symbol: "NKE", name: "NIKE, Inc.", type: "Equity", exchange: "NYSE" }) === false);
  ok("an explicit flag wins", isDepositaryReceipt({ symbol: "X", name: "Plain Co", type: "Equity", exchange: "NYSE", isAdr: true }) === true);
  ok("and can force it off", isDepositaryReceipt({ ...adr, isAdr: false }) === false);

  // The ordering consequence: an Indian company's home listing beats its ADR.
  const nse = { symbol: "HDFCBANK.NS", name: "HDFC Bank Limited", type: "Equity", exchange: "NSE" };
  ok("NSE beats the New York ADR", listingPreference(nse) < listingPreference(adr));
  // ... while an ordinary NYSE listing still beats NSE, for an American company.
  const nyse = { symbol: "NKE", name: "NIKE, Inc.", type: "Equity", exchange: "NYSE" };
  ok("an ordinary NYSE listing beats NSE", listingPreference(nyse) < listingPreference(nse));
}

// ── Query parsing ───────────────────────────────────────────────────────────
{
  const p = parseSearchQuery("NYSE:NKE");
  ok("the symbol is extracted", p.q === "NKE");
  ok("and the exchange is kept, not discarded", p.exchangeHint === "NYSE");

  ok("lower case works", parseSearchQuery("nyse:nke").exchangeHint === "NYSE");
  ok("spacing works", parseSearchQuery("NYSE: NKE").q === "NKE");
  ok("NSE is understood", parseSearchQuery("NSE:RELIANCE").exchangeHint === "NSE");
  ok("BSE is understood", parseSearchQuery("BSE:523373").exchangeHint === "BSE");
  ok("NASDAQ is understood", parseSearchQuery("NASDAQ:AAPL").exchangeHint === "NASDAQ");
  ok("and the symbol survives", parseSearchQuery("NASDAQ:AAPL").q === "AAPL");

  const unknown = parseSearchQuery("XYZ:AAPL");
  ok("an unknown prefix is still stripped", unknown.q === "AAPL");
  ok("but names no exchange", unknown.exchangeHint === undefined);

  ok("a bare query is untouched", parseSearchQuery("nike").q === "nike");
  ok("with no hint", parseSearchQuery("nike").exchangeHint === undefined);
  ok("a colon with nothing after it is left alone", parseSearchQuery("NYSE:").q === "NYSE:");
  ok("an empty query is empty", parseSearchQuery("").q === "");

  // The instruction must actually win.
  const nyse = { symbol: "NKE", name: "NIKE, Inc.", type: "Equity", exchange: "NYSE" };
  const stu = { symbol: "NKE.SG", name: "Nike Inc.", type: "Equity", exchange: "Stuttgart" };
  ok("NYSE:NKE selects NYSE", listingPreference(nyse, { exchangeHint: "NYSE" }) < listingPreference(stu, { exchangeHint: "NYSE" }));
  // ... and can select a venue that would otherwise lose.
  ok("STU:NKE selects Stuttgart", listingPreference(stu, { exchangeHint: "STU" }) < listingPreference(nyse, { exchangeHint: "STU" }));
}

// ── Company identity ────────────────────────────────────────────────────────
{
  ok("corporate suffixes are dropped", normaliseCompanyName("NIKE, Inc.") === normaliseCompanyName("Nike Inc"));
  ok("ADR wording is dropped", normaliseCompanyName("HDFC Bank Limited ADR") === normaliseCompanyName("HDFC Bank Ltd"));
  ok("ordinary wording is dropped", normaliseCompanyName("NIKE INC NIKE ORD CLASS B").includes("nike"));
  ok("different companies stay different", normaliseCompanyName("Nike Inc") !== normaliseCompanyName("Adidas AG"));

  // ISIN wins where a provider supplies one.
  const a = { symbol: "NKE", name: "NIKE, Inc.", type: "Equity", exchange: "NYSE", isin: "US6541061031" };
  const b = { symbol: "NKE.SG", name: "Nike Inc.", type: "Equity", exchange: "Stuttgart", isin: "US6541061031" };
  ok("the same ISIN is the same company", companyIdentity(a) === companyIdentity(b));
  const c = { symbol: "GOOG", name: "Alphabet Inc.", type: "Equity", exchange: "NASDAQ", isin: "US02079K1079" };
  const d = { symbol: "GOOGL", name: "Alphabet Inc.", type: "Equity", exchange: "NASDAQ", isin: "US02079K3059" };
  ok("different ISINs are different securities", companyIdentity(c) !== companyIdentity(d));

  // Never the ticker root.
  const e = { symbol: "ABC", name: "Alpha Beta Corp", type: "Equity", exchange: "NYSE" };
  const f = { symbol: "ABC.NS", name: "Something Else Ltd", type: "Equity", exchange: "NSE" };
  ok("a shared ticker is not a shared company", companyIdentity(e) !== companyIdentity(f));
}

// ── nike: the acceptance case ───────────────────────────────────────────────
{
  const groups = groupListings(NIKE);
  ok("one company", groups.length === 1);
  const g = groups[0];
  ok("NYSE:NKE is preferred", g.preferred.symbol === "NKE");
  ok("on NYSE", exchangeCodeOf(g.preferred) === "NYSE");
  // The old behaviour deleted these.
  ok("every listing is kept", g.listings.length === 4);
  ok("+3 listings behind it", g.listings.length - 1 === 3);
  ok("Stuttgart is still there", g.listings.some((l) => l.symbol === "NKE.SG"));
  ok("London is still there", g.listings.some((l) => l.symbol === "0QZ6.L"));
  ok("Thailand is still there", g.listings.some((l) => l.symbol === "NIKE80.BK"));
  ok("each one is individually addressable", g.listings.every((l) => typeof l.symbol === "string" && l.symbol.length > 0));

  // Stuttgart arriving FIRST must not remove NYSE. This is the exact input
  // order that produced the bug.
  ok("Stuttgart first does not win", groupListings(NIKE)[0].preferred.symbol === "NKE");
  const reversed = groupListings(NIKE.slice().reverse());
  ok("nor does input order change the answer", reversed[0].preferred.symbol === "NKE");
  ok("with the same listing count", reversed[0].listings.length === 4);

  // NKE.SG remains selectable, and keeps its own currency and country.
  const sg = g.listings.find((l) => l.symbol === "NKE.SG");
  ok("NKE.SG keeps its currency", sg.currency === "EUR");
  ok("and its country", sg.country === "DE");
  ok("while the preferred keeps its own", g.preferred.currency === "USD");
  ok("listings are ordered by preference", exchangeRank(g.listings[0]) <= exchangeRank(g.listings[1]));

  // An explicit exchange picks a different listing without losing the others.
  const hinted = groupListings(NIKE, { exchangeHint: "STU" })[0];
  ok("STU:NKE prefers Stuttgart", hinted.preferred.symbol === "NKE.SG");
  ok("and still keeps NYSE", hinted.listings.some((l) => l.symbol === "NKE"));
}

// ── HDFC Bank: home listing, ADR kept separate ──────────────────────────────
{
  const HDFC = [
    { symbol: "HDB", name: "HDFC Bank Limited", type: "ADR", exchange: "NYSE", country: "US", currency: "USD", kind: "Stock" },
    { symbol: "HDFCBANK.NS", name: "HDFC Bank Limited", type: "Equity", exchange: "NSE", country: "IN", currency: "INR", kind: "Stock" },
    { symbol: "HDFCBANK.BO", name: "HDFC Bank Ltd", type: "Equity", exchange: "BSE", country: "IN", currency: "INR", kind: "Stock" },
  ];
  const groups = groupListings(HDFC);
  ok("one company", groups.length === 1);
  const g = groups[0];
  ok("NSE is preferred for an Indian company", g.preferred.symbol === "HDFCBANK.NS");
  ok("all three listings are grouped", g.listings.length === 3);
  ok("the BSE line is kept", g.listings.some((l) => l.symbol === "HDFCBANK.BO"));
  ok("the ADR is kept", g.listings.some((l) => l.symbol === "HDB"));

  // Prices and currencies must never be mixed between them.
  const adr = g.listings.find((l) => l.symbol === "HDB");
  ok("the ADR keeps USD", adr.currency === "USD");
  ok("the ordinary keeps INR", g.preferred.currency === "INR");
  ok("the ADR keeps its own country", adr.country === "US");
  ok("the ordinary keeps its own", g.preferred.country === "IN");
  ok("the ADR is marked as one", isDepositaryReceipt(adr) === true);
  ok("the ordinary is not", isDepositaryReceipt(g.preferred) === false);
  ok("no two listings share a symbol", new Set(g.listings.map((l) => l.symbol)).size === 3);
}

// ── GOOG and GOOGL stay distinct ────────────────────────────────────────────
{
  const ALPHABET = [
    { symbol: "GOOGL", name: "Alphabet Inc.", type: "Equity", exchange: "NASDAQ", country: "US", currency: "USD", kind: "Stock" },
    { symbol: "GOOG", name: "Alphabet Inc.", type: "Equity", exchange: "NASDAQ", country: "US", currency: "USD", kind: "Stock" },
  ];
  const groups = groupListings(ALPHABET);
  ok("two share classes, two results", groups.length === 2);
  const syms = groups.map((g) => g.preferred.symbol).sort();
  ok("both survive", syms[0] === "GOOG" && syms[1] === "GOOGL");
  ok("neither absorbs the other", groups.every((g) => g.listings.length === 1));

  // With ISINs, the same holds for the right reason rather than by luck.
  const withIsin = groupListings([
    { ...ALPHABET[0], isin: "US02079K3059" },
    { ...ALPHABET[1], isin: "US02079K1079" },
  ]);
  ok("distinct ISINs stay distinct", withIsin.length === 2);

  // Two DECLARED and different classes are two securities, even across
  // exchanges. One that names a class and one that says nothing are not: Nike's
  // NYSE line is Class B stock and does not mention it, while London writes the
  // same security as "NIKE INC NIKE ORD CLASS B".
  const classes = groupListings([
    { symbol: "SOMEA", name: "Some Co Class A", type: "Equity", exchange: "NYSE", kind: "Stock" },
    { symbol: "SOMEC.L", name: "Some Co Class C", type: "Equity", exchange: "London", kind: "Stock" },
  ]);
  ok("different declared classes stay apart", classes.length === 2);
  const quiet = groupListings([
    { symbol: "SOME", name: "Some Co", type: "Equity", exchange: "NYSE", kind: "Stock" },
    { symbol: "SOME.L", name: "Some Co ORD CLASS B", type: "Equity", exchange: "London", kind: "Stock" },
  ]);
  ok("a class named on one side only still groups", quiet.length === 1);
}

// ── OTC never replaces a real listing ───────────────────────────────────────
{
  const groups = groupListings([
    { symbol: "SOMEF", name: "Some Company AG", type: "Equity", exchange: "OTC Markets", country: "US", currency: "USD", kind: "Stock" },
    { symbol: "SOME.DE", name: "Some Company AG", type: "Equity", exchange: "XETRA", country: "DE", currency: "EUR", kind: "Stock" },
  ]);
  ok("one company", groups.length === 1);
  ok("the exchange listing is preferred", groups[0].preferred.symbol === "SOME.DE");
  ok("and the OTC line is kept, not deleted", groups[0].listings.length === 2);
  ok("OTC is last", groups[0].listings[groups[0].listings.length - 1].symbol === "SOMEF");

  // Even arriving first, and even against a secondary German venue.
  const otcFirst = groupListings([
    { symbol: "SOMEF", name: "Some Company AG", type: "Equity", exchange: "Pink Sheets", kind: "Stock" },
    { symbol: "SOME.SG", name: "Some Company AG", type: "Equity", exchange: "Stuttgart", kind: "Stock" },
  ]);
  ok("OTC does not win on arrival order", otcFirst[0].preferred.symbol === "SOME.SG");
}

// ── Degenerate input ────────────────────────────────────────────────────────
{
  ok("no listings, no groups", groupListings([]).length === 0);
  const one = groupListings([{ symbol: "NKE", name: "NIKE, Inc.", type: "Equity", exchange: "NYSE" }]);
  ok("a single listing is a group of one", one.length === 1 && one[0].listings.length === 1);
  ok("and is its own preferred", one[0].preferred.symbol === "NKE");
  ok("a nameless row still groups", groupListings([{ symbol: "ABC", name: "", type: "", exchange: "" }]).length === 1);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
