#!/usr/bin/env node
// Tests for the RBI bank-wise statistical tables.
//
// Run: node scripts/test-rbi-tables.mjs
//
// This is the source that makes a hundred and forty banks affordable: the
// regulator publishes, once a year and free, exactly the four measures every
// bank's balance-sheet card is missing. The catch is that it identifies banks
// by name and by nothing else, and Indian bank names are a minefield. Bank of
// India, Indian Bank, Central Bank of India, Union Bank of India and Indian
// Overseas Bank are five separate listed companies whose names differ by one or
// two of the commonest words in the language.
//
// So most of what follows is about refusing to guess. A row that does not
// resolve to exactly one bank is reported and skipped, and the cost of that is
// one bank's data until an alias is added. The alternative is a fuzzy match
// that writes one bank's bad-loan ratio onto another bank's page, permanently,
// with no symptom at all.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "rbi-"));
execFileSync(
  "npx",
  ["tsc", join(root, "src/lib/filings/adapters/rbiBankTables.ts"), "--outDir", out,
   "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler"],
  { stdio: "pipe" }
);
const { parseRbiTable, parseRbiNumber, splitCsvLine, normaliseBankName, matchBank } =
  await import(join(out, "rbiBankTables.js"));
rmSync(out, { recursive: true, force: true });

const csv = readFileSync(join(root, "scripts/fixtures/filings/rbi-npa-crar.csv"), "utf8");

let passed = 0;
let failed = 0;
const ok = (name, cond) => {
  if (cond) passed++;
  else {
    failed++;
    console.error(`  FAIL: ${name}`);
  }
};

// ── Numbers as a regulator's table writes them ──────────────────────────────
{
  ok("a plain ratio", parseRbiNumber("1.33") === 1.33);
  ok("Indian grouping", parseRbiNumber("1,23,45,678") === 12345678);
  ok("Western grouping", parseRbiNumber("2,550,000") === 2550000);
  // A dash means "no value". Read as zero it reports a bank with no bad loans,
  // which is the most flattering possible way to be wrong.
  ok("a dash is not zero", parseRbiNumber("-") === undefined);
  ok("nor is an em-dash", parseRbiNumber("—") === undefined);
  ok("nor a double dash", parseRbiNumber("--") === undefined);
  ok("n.a. is not zero", parseRbiNumber("n.a.") === undefined);
  ok("NA is not zero", parseRbiNumber("NA") === undefined);
  ok("nil is not zero", parseRbiNumber("Nil") === undefined);
  ok("blank is not zero", parseRbiNumber("") === undefined);
  ok("but a real zero is zero", parseRbiNumber("0") === 0);
  // Footnote markers are glued to the figure in these tables.
  ok("a trailing marker is stripped", parseRbiNumber("12.4@") === 12.4);
  ok("a hash too", parseRbiNumber("8.9 #") === 8.9);
  ok("and an asterisk", parseRbiNumber("1.33*") === 1.33);
  ok("parentheses are negative", parseRbiNumber("(450)") === -450);
  ok("text is not a number", parseRbiNumber("Total") === undefined);
}

// ── CSV, with quoted fields ─────────────────────────────────────────────────
{
  ok("plain fields", JSON.stringify(splitCsvLine("a,b,c")) === '["a","b","c"]');
  ok("quoted fields", JSON.stringify(splitCsvLine('"a","b","c"')) === '["a","b","c"]');
  ok("a comma inside quotes does not split",
    JSON.stringify(splitCsvLine('"Bank, The","1,234"')) === '["Bank, The","1,234"]');
  ok("an escaped quote", splitCsvLine('"say ""hi"""')[0] === 'say "hi"');
  ok("empty cells survive", splitCsvLine("a,,c").length === 3);
}

// ── Reading the table ───────────────────────────────────────────────────────
const table = parseRbiTable(csv);
{
  ok("the table parses", table.errors.length === 0);
  // The header row is FOUND, not assumed: RBI tables carry a title, a unit
  // line, a date line and a blank row before it, and the count changes.
  ok("the header row is found past the preamble", Object.keys(table.columns).length >= 6);
  ok("gross NPA ratio is located", table.columns.grossNpaRatio != null);
  ok("net NPA ratio is located", table.columns.netNpaRatio != null);
  ok("CRAR is located", table.columns.capitalAdequacyRatio != null);
  ok("tier 1 is located", table.columns.tier1Ratio != null);
  ok("and the amounts", table.columns.grossNpa != null && table.columns.advances != null);
  // "Net NPA Ratio" contains "NPA Ratio", so the specific pattern must win.
  ok("net and gross ratios are not confused", table.columns.netNpaRatio !== table.columns.grossNpaRatio);

  // The unit line above the header, applied to currency columns only.
  ok("crore is read from the header", table.scale === 1e7);

  ok("eleven banks, a stranger and a blank row are read", table.rows.length === 13);
  const hdfc = table.rows.find((r) => /HDFC/.test(r.bankName));
  ok("HDFC's gross NPA ratio", hdfc.values.grossNpaRatio === 1.33);
  ok("its net NPA ratio", hdfc.values.netNpaRatio === 0.43);
  ok("its CRAR", hdfc.values.capitalAdequacyRatio === 18.8);
  ok("its tier 1", hdfc.values.tier1Ratio === 17.2);
  // Ratios stay as filed; only currency columns take the scale.
  ok("the ratio is not scaled", hdfc.values.grossNpaRatio < 100);
  ok("but the amount is", hdfc.values.grossNpa === 33915 * 1e7);
  ok("and advances too", hdfc.values.advances === 2550000 * 1e7);
  ok("each row remembers its line", hdfc.line > 5);

  // Structure that is not data.
  ok("the group heading is not a bank", !table.rows.some((r) => /SCHEDULED COMMERCIAL/.test(r.bankName)));
  ok("the note is not a bank", !table.rows.some((r) => /^Note/i.test(r.bankName)));
  ok("nor the source line", !table.rows.some((r) => /^Source/i.test(r.bankName)));
  // A row of dashes is a bank with no figures, not a bank with zeroes.
  const empty = table.rows.find((r) => /Loss Making/.test(r.bankName));
  ok("a row of dashes still parses its advances", empty.values.advances === 5000 * 1e7);
  ok("and reports no NPA ratio at all", empty.values.grossNpaRatio === undefined);
  ok("rather than zero", empty.values.grossNpaRatio !== 0);
}

// ── A table it cannot read says so ──────────────────────────────────────────
{
  ok("an empty file is an error", parseRbiTable("").errors.length > 0);
  ok("a file with no header is an error", parseRbiTable("a,b,c\n1,2,3").errors.length > 0);
  ok("and produces no rows", parseRbiTable("a,b,c\n1,2,3").rows.length === 0);
  const headerOnly = parseRbiTable('"Name of the Bank","Gross NPA Ratio"');
  ok("a header with no data is an error", headerOnly.errors.length > 0);
  ok("lakhs are read as lakhs", parseRbiTable('"(Amount in lakh)"\n"Bank","Gross NPAs"\n"X Bank","10"').scale === 1e5);
  ok("plain rupees have no multiplier", parseRbiTable('"Bank","Gross NPAs"\n"X Bank","10"').scale === 1);
}

// ── The matcher, which must never guess ─────────────────────────────────────
{
  const master = [
    { companyId: "c1", symbol: "BANKINDIA.NS", legalName: "Bank of India" },
    { companyId: "c2", symbol: "INDIANB.NS", legalName: "Indian Bank" },
    { companyId: "c3", symbol: "CENTRALBK.NS", legalName: "Central Bank of India" },
    { companyId: "c4", symbol: "UNIONBANK.NS", legalName: "Union Bank of India" },
    { companyId: "c5", symbol: "IOB.NS", legalName: "Indian Overseas Bank" },
    { companyId: "c6", symbol: "BANKBARODA.NS", legalName: "Bank of Baroda" },
    { companyId: "c7", symbol: "HDFCBANK.NS", legalName: "HDFC Bank Limited", rbiNames: ["HDFC Bank Ltd."] },
  ];

  // The five names that are the reason this is strict. Each must land on
  // exactly its own company and no other.
  ok("Bank of India", matchBank("Bank of India", master).entry?.companyId === "c1");
  ok("Indian Bank", matchBank("Indian Bank", master).entry?.companyId === "c2");
  ok("Central Bank of India", matchBank("Central Bank of India", master).entry?.companyId === "c3");
  ok("Union Bank of India", matchBank("Union Bank of India", master).entry?.companyId === "c4");
  ok("Indian Overseas Bank", matchBank("Indian Overseas Bank", master).entry?.companyId === "c5");
  ok("Bank of Baroda", matchBank("Bank of Baroda", master).entry?.companyId === "c6");

  // The normalisation must keep them apart. Stripping "of" and "India" leaves
  // Bank of India and Indian Bank as the same single word.
  ok("Bank of India and Indian Bank do not normalise alike",
    normaliseBankName("Bank of India") !== normaliseBankName("Indian Bank"));
  ok("nor Central Bank of India and Bank of India",
    normaliseBankName("Central Bank of India") !== normaliseBankName("Bank of India"));
  ok("nor Indian Bank and Indian Overseas Bank",
    normaliseBankName("Indian Bank") !== normaliseBankName("Indian Overseas Bank"));

  // But a legal suffix carries no identity.
  ok("Ltd and Limited are the same bank",
    normaliseBankName("HDFC Bank Ltd.") === normaliseBankName("HDFC Bank Limited"));
  ok("and a leading 'The' is not a difference",
    normaliseBankName("The Federal Bank Ltd.") === normaliseBankName("Federal Bank Limited"));
  // "HDFC Bank Ltd." and "HDFC Bank Limited" reduce to the same string, so that
  // pair never reaches the alias branch. A real alias is a name that does not
  // reduce to the legal one, which is what the list is for: a bank that has
  // been renamed, and whose old name the RBI may still be using.
  ok("an exact name matches exactly", matchBank("HDFC Bank Ltd.", master).matchedOn === "exact");
  const renamed = [
    { companyId: "z", symbol: "CSBBANK.NS", legalName: "CSB Bank Limited", rbiNames: ["Catholic Syrian Bank Ltd."] },
  ];
  ok("a former name resolves through the alias list",
    matchBank("Catholic Syrian Bank Ltd.", renamed).matchedOn === "alias");
  ok("to the right company", matchBank("Catholic Syrian Bank Ltd.", renamed).entry?.companyId === "z");
  ok("and the current name still matches exactly",
    matchBank("CSB Bank Limited", renamed).matchedOn === "exact");

  // No substring matching, ever.
  ok("a substring does not match", matchBank("Bank", master).entry === undefined);
  ok("and says why", /not in the bank master/i.test(matchBank("Bank", master).reason));
  ok("an unknown bank does not match", matchBank("Some Bank That Does Not Exist Ltd.", master).entry === undefined);
  ok("an empty name does not match", matchBank("", master).entry === undefined);

  // Two identical names in the master is a data error, not a coin toss.
  const clashing = [
    { companyId: "x", symbol: "X.NS", legalName: "Duplicate Bank Ltd." },
    { companyId: "y", symbol: "Y.NS", legalName: "Duplicate Bank Limited" },
  ];
  ok("an ambiguous name resolves to nothing", matchBank("Duplicate Bank Ltd.", clashing).entry === undefined);
  ok("and says it was ambiguous", /matches 2/.test(matchBank("Duplicate Bank Ltd.", clashing).reason));
}

// ── The fixture against the real master ─────────────────────────────────────
{
  const bankMasterPath = join(root, "src/data/indianBanks.ts");
  const src = readFileSync(bankMasterPath, "utf8");
  // An ISIN appears only where one was supplied or read from a filing. Every
  // other entry keys on a provisional symbol id and is upgraded later.
  const isins = Array.from(src.matchAll(/isin: "([^"]+)"/g)).map((m) => m[1]);
  ok("any ISIN present is well formed", isins.every((i) => /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(i)));
  ok("no two banks claim the same ISIN", new Set(isins).size === isins.length);
  ok("the id matches the ISIN where there is one", isins.every((i) => src.includes(`companyId: "isin:${i}"`)));
  ok("the rest are provisional", /provisional:nse:/.test(src));

  // Both listings, always. Linking only the NSE line leaves a reader who
  // arrived at the BSE symbol looking at an empty card.
  const symbolLists = Array.from(src.matchAll(/symbols: \[([^\]]+)\]/g)).map((m) =>
    Array.from(m[1].matchAll(/"([^"]+)"/g)).map((a) => a[1])
  );
  ok("every bank lists its symbols", symbolLists.length >= 30);
  ok("and lists two of them", symbolLists.every((l) => l.length === 2));
  ok("one NSE and one BSE", symbolLists.every((l) => l.some((x) => x.endsWith(".NS")) && l.some((x) => x.endsWith(".BO"))));
  ok("with the same root", symbolLists.every((l) => l[0].replace(/\.NS$/, "") === l[1].replace(/\.BO$/, "")));
  const allSymbols = symbolLists.flat();
  ok("no symbol belongs to two banks", new Set(allSymbols).size === allSymbols.length);

  const names = Array.from(src.matchAll(/legalName: "([^"]+)"/g)).map((m) => m[1]);
  ok("the master has the major banks", names.length >= 30);
  const normalised = names.map(normaliseBankName);
  ok("no two banks normalise to the same name", new Set(normalised).size === normalised.length);
  ok("every name is non-empty once normalised", normalised.every((n) => n.length > 2));
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
