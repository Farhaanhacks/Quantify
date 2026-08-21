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
  inferIssuerCountry,
  listingCountryOf,
  securityTypeOf,
  isHomePrimaryListing,
  declaredDepositaryReceipt,
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

  // The ordinary lines have the company's ISIN; the ADR is a different
  // security and therefore has its own. Better provider metadata must not split
  // the same company back into separate search rows.
  const identified = groupListings([
    { ...HDFC[0], isin: "US40415F1012" },
    { ...HDFC[1], isin: "INE040A01034" },
    { ...HDFC[2], isin: "INE040A01034", name: "HDFC Bank Limited" },
  ]);
  ok("ordinary-share and ADR ISINs still form one company", identified.length === 1);
  ok("all identified HDFC listings remain available", identified[0].listings.length === 3);
  ok("identified HDFC still defaults to NSE", identified[0].preferred.symbol === "HDFCBANK.NS");
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

// ── The home-market rule ────────────────────────────────────────────────────
//
// "NYSE always wins" was an overcorrection for Nike, and it broke HDFC Bank:
// searching "hdfc" returned NYSE:HDB, a New York depositary receipt, as the
// bank's listing. The receipt trades in dollars at a different price for a
// different number of underlying shares, so preferring it is the same class of
// error as preferring Stuttgart for Nike.
//
// These are the REAL provider shapes. Yahoo returns HDB as an unremarkable
// "EQUITY" on "NYQ" named "HDFC Bank Limited" — no ADR marker anywhere — which
// is precisely why text matching could not see it and why the domicile has to
// be derived from the set of listings instead.
{
  const HDFC_RAW = [
    { symbol: "HDB", name: "HDFC Bank Limited", type: "EQUITY", exchange: "NYQ", currency: "USD", kind: "Stock" },
    { symbol: "HDFCBANK.NS", name: "HDFC Bank Limited", type: "EQUITY", exchange: "NSI", currency: "INR", kind: "Stock" },
    { symbol: "HDFCBANK.BO", name: "HDFC Bank Limited", type: "EQUITY", exchange: "BSE", currency: "INR", kind: "Stock" },
  ];
  ok("nothing in the feed calls HDB a receipt", HDFC_RAW.every((l) => declaredDepositaryReceipt(l) === false));

  const g = groupListings(HDFC_RAW)[0];
  ok("hdfc -> NSE:HDFCBANK.NS", g.preferred.symbol === "HDFCBANK.NS");
  ok("the issuer is read as Indian", g.issuerCountry === "IN");
  ok("HDB is still available", g.listings.some((l) => l.symbol === "HDB"));
  ok("as an ALTERNATIVE, not the default", g.alternatives.some((l) => l.symbol === "HDB"));
  ok("and is derived to be a receipt", g.listings.find((l) => l.symbol === "HDB").securityType === "depositary-receipt");
  ok("which names the share it is a claim on", g.listings.find((l) => l.symbol === "HDB").underlyingSymbol === "HDFCBANK.NS");
  ok("the NSE line is the home primary", g.preferred.isHomePrimary === true);
  ok("the BSE line is ordinary too", g.listings.find((l) => l.symbol === "HDFCBANK.BO").securityType === "ordinary");
  ok("BSE ranks above the ADR", g.listings.findIndex((l) => l.symbol === "HDFCBANK.BO") < g.listings.findIndex((l) => l.symbol === "HDB"));
  ok("the alternatives never repeat the main listing", !g.alternatives.some((l) => l.symbol === g.preferred.symbol));
  ok("and account for every other listing", g.alternatives.length === g.listings.length - 1);
  ok("currencies stay with their own line", g.preferred.currency === "INR" && g.listings.find((l) => l.symbol === "HDB").currency === "USD");

  // The instruction still wins. Yahoo calls the venue "NYQ" and the user types
  // "NYSE"; those have to be the same exchange or the explicit form is ignored.
  ok("NYSE and NYQ are one venue", exchangeCodeOf({ symbol: "HDB", name: "", type: "", exchange: "NYQ" }) === "NYSE");
  const hinted = groupListings(HDFC_RAW, { exchangeHint: "NYSE" })[0];
  ok("NYSE:HDB selects HDB", hinted.preferred.symbol === "HDB");
  ok("and keeps the ordinary shares behind it", hinted.alternatives.some((l) => l.symbol === "HDFCBANK.NS"));
  ok("the parsed prefix is canonical", parseSearchQuery("NYSE:HDB").exchangeHint === "NYSE");
  ok("and so is a vendor code typed by hand", parseSearchQuery("NYQ:HDB").exchangeHint === "NYSE");

  // Same rule, opposite answer, no company named anywhere in it.
  const NIKE_RAW = [
    { symbol: "NKE.SG", name: "Nike Inc.", type: "EQUITY", exchange: "STU", currency: "EUR", kind: "Stock" },
    { symbol: "0QZ6.L", name: "NIKE INC NIKE ORD CLASS B", type: "EQUITY", exchange: "LSE", currency: "GBP", kind: "Stock" },
    { symbol: "NKE", name: "NIKE, Inc.", type: "EQUITY", exchange: "NYQ", currency: "USD", kind: "Stock" },
  ];
  const n = groupListings(NIKE_RAW)[0];
  ok("nike -> NYSE:NKE", n.preferred.symbol === "NKE");
  ok("the issuer is read as American", n.issuerCountry === "US");
  ok("NKE is the home primary", n.preferred.isHomePrimary === true);
  // A London line for an American company is the ordinary share quoted abroad,
  // not a receipt. Labelling it one would misdescribe it AND move it.
  ok("London is not called a receipt", n.listings.find((l) => l.symbol === "0QZ6.L").securityType === "ordinary");
  ok("but it is not home either", n.listings.find((l) => l.symbol === "0QZ6.L").isHomePrimary === false);
  ok("and it ranks below New York", n.listings.findIndex((l) => l.symbol === "NKE") < n.listings.findIndex((l) => l.symbol === "0QZ6.L"));
  ok("Stuttgart is last", n.listings[n.listings.length - 1].symbol === "NKE.SG");
}

// ── The rule generalises, and is not two special cases ──────────────────────
{
  // A German issuer with a New York receipt. Neither market is India and
  // neither is the United States-as-home, so nothing learned from HDFC or Nike
  // can be carrying this one.
  const SAP = groupListings([
    { symbol: "SAP", name: "SAP SE", type: "EQUITY", exchange: "NYQ", currency: "USD", kind: "Stock" },
    { symbol: "SAP.DE", name: "SAP SE", type: "EQUITY", exchange: "XETRA", currency: "EUR", kind: "Stock" },
  ])[0];
  ok("a German issuer prefers Xetra", SAP.preferred.symbol === "SAP.DE");
  ok("over its New York line", SAP.issuerCountry === "DE");
  ok("which is derived to be a receipt", SAP.listings.find((l) => l.symbol === "SAP").securityType === "depositary-receipt");

  // A Canadian issuer whose New York line is an ORDINARY share, not a receipt.
  // Canada, Israel and the offshore holding jurisdictions list directly in New
  // York, and calling those ADRs would be wrong about what the security is.
  const SHOP = groupListings([
    { symbol: "SHOP", name: "Shopify Inc.", type: "EQUITY", exchange: "NYQ", currency: "USD", kind: "Stock" },
    { symbol: "SHOP.TO", name: "Shopify Inc.", type: "EQUITY", exchange: "TOR", currency: "CAD", kind: "Stock" },
  ])[0];
  ok("a Canadian issuer prefers Toronto", SHOP.preferred.symbol === "SHOP.TO");
  ok("and its New York line is ordinary", SHOP.listings.find((l) => l.symbol === "SHOP").securityType === "ordinary");
  ok("so it is not demoted as a receipt", SHOP.listings.findIndex((l) => l.symbol === "SHOP") === 1);

  // A Japanese issuer.
  const TOYOTA = groupListings([
    { symbol: "TM", name: "Toyota Motor Corporation", type: "EQUITY", exchange: "NYQ", currency: "USD", kind: "Stock" },
    { symbol: "7203.T", name: "Toyota Motor Corporation", type: "EQUITY", exchange: "JPX", currency: "JPY", kind: "Stock" },
  ])[0];
  ok("a Japanese issuer prefers Tokyo", TOYOTA.preferred.symbol === "7203.T");

  // A purely American company keeps its American answer.
  const AAPL = groupListings([
    { symbol: "APC.F", name: "Apple Inc.", type: "EQUITY", exchange: "FRA", currency: "EUR", kind: "Stock" },
    { symbol: "AAPL", name: "Apple Inc.", type: "EQUITY", exchange: "NMS", currency: "USD", kind: "Stock" },
  ])[0];
  ok("an American issuer prefers NASDAQ", AAPL.preferred.symbol === "AAPL");
  ok("over a Frankfurt quotation", AAPL.issuerCountry === "US");
}

// ── Domicile: what it reads, and what it cannot ─────────────────────────────
{
  // An ISIN settles it outright — the first two characters ARE the country.
  ok("an ISIN names the country", inferIssuerCountry([
    { symbol: "HDB", name: "HDFC Bank Limited", type: "EQUITY", exchange: "NYQ", isin: "INE040A01034" },
  ]) === "IN");
  ok("even against a US venue", inferIssuerCountry([
    { symbol: "HDB", name: "X", type: "EQUITY", exchange: "NYQ", isin: "INE040A01034" },
    { symbol: "X.NS", name: "X", type: "EQUITY", exchange: "NSI" },
  ]) === "IN");
  ok("a US ISIN says US", inferIssuerCountry([
    { symbol: "NKE", name: "NIKE, Inc.", type: "EQUITY", exchange: "NYQ", isin: "US6541061031" },
  ]) === "US");
  // XS is a clearing system, not a country, and must not be read as one.
  ok("XS is not a country", inferIssuerCountry([
    { symbol: "X", name: "X", type: "EQUITY", exchange: "NYQ", isin: "XS1234567890" },
  ]) === "US");

  // A market that lists domestic issuers and almost nothing else outweighs one
  // that hosts the world's receipts. That single comparison is the whole rule.
  ok("NSE outweighs NYSE", inferIssuerCountry([
    { symbol: "HDB", name: "X", type: "EQUITY", exchange: "NYQ" },
    { symbol: "X.NS", name: "X", type: "EQUITY", exchange: "NSI" },
  ]) === "IN");
  ok("NYSE outweighs Stuttgart", inferIssuerCountry([
    { symbol: "X.SG", name: "X", type: "EQUITY", exchange: "STU" },
    { symbol: "X", name: "X", type: "EQUITY", exchange: "NYQ" },
  ]) === "US");
  ok("input order does not matter", inferIssuerCountry([
    { symbol: "X.NS", name: "X", type: "EQUITY", exchange: "NSI" },
    { symbol: "HDB", name: "X", type: "EQUITY", exchange: "NYQ" },
  ]) === "IN");
  ok("a declared receipt does not vote for its own venue", inferIssuerCountry([
    { symbol: "HDB", name: "HDFC Bank Ltd ADR", type: "ADR", exchange: "NYQ" },
    { symbol: "X.NS", name: "X", type: "EQUITY", exchange: "NSI" },
  ]) === "IN");
  // An unknown domicile is a real answer, and must not default to America.
  ok("nothing to go on means no answer", inferIssuerCountry([]) === undefined);

  ok("listing country from a suffix", listingCountryOf({ symbol: "HDFCBANK.NS", name: "", type: "", exchange: "" }) === "IN");
  ok("listing country from a venue", listingCountryOf({ symbol: "HDB", name: "", type: "", exchange: "NYQ" }) === "US");
  ok("Euronext Paris is France", listingCountryOf({ symbol: "MC.PA", name: "", type: "", exchange: "" }) === "FR");
  ok("Euronext Amsterdam is the Netherlands", listingCountryOf({ symbol: "ASML.AS", name: "", type: "", exchange: "" }) === "NL");

  const inNy = { symbol: "HDB", name: "HDFC Bank Limited", type: "EQUITY", exchange: "NYQ" };
  ok("an Indian issuer's New York line is a receipt", securityTypeOf(inNy, "IN") === "depositary-receipt");
  ok("and is not home primary", isHomePrimaryListing(inNy, "IN") === false);
  ok("with no domicile, nothing is claimed", securityTypeOf(inNy) === "unknown");
  ok("nor is home primary claimed", isHomePrimaryListing(inNy) === false);
  const inMumbai = { symbol: "HDFCBANK.NS", name: "HDFC Bank Limited", type: "EQUITY", exchange: "NSI" };
  ok("the Mumbai line is home primary", isHomePrimaryListing(inMumbai, "IN") === true);
  // A secondary German quotation of an Indian share is not a receipt: it is the
  // same security quoted elsewhere, and receipts rank ABOVE secondary
  // quotations, so mislabelling it would promote it.
  ok("Stuttgart is not a receipt", securityTypeOf({ symbol: "X.SG", name: "X", type: "EQUITY", exchange: "STU" }, "IN") === "ordinary");
}

// ── Tier order is the published priority ────────────────────────────────────
{
  const at = (l, issuerCountry) => listingPreference(l, { issuerCountry });
  const IN = "IN";
  const home = { symbol: "X.NS", name: "X", type: "EQUITY", exchange: "NSI" };
  const home2 = { symbol: "X.BO", name: "X", type: "EQUITY", exchange: "BSE" };
  const foreign = { symbol: "X.L", name: "X", type: "EQUITY", exchange: "LSE" };
  const receipt = { symbol: "X", name: "X ADR", type: "ADR", exchange: "NYQ" };
  const secondary = { symbol: "X.SG", name: "X", type: "EQUITY", exchange: "STU" };
  const offExchange = { symbol: "XF", name: "X", type: "EQUITY", exchange: "Pink Sheets" };
  ok("home primary first", at(home, IN) < at(home2, IN));
  ok("second home listing next", at(home2, IN) < at(foreign, IN));
  ok("then a major foreign listing", at(foreign, IN) < at(receipt, IN));
  ok("then depositary receipts", at(receipt, IN) < at(secondary, IN));
  ok("then secondary quotations", at(secondary, IN) < at(offExchange, IN));
  ok("an explicit exchange beats every tier", at(offExchange, IN) > listingPreference(offExchange, { issuerCountry: IN, exchangeHint: "OTC" }));
  ok("and wins outright", listingPreference(offExchange, { issuerCountry: IN, exchangeHint: "OTC" }) < at(home, IN));
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
