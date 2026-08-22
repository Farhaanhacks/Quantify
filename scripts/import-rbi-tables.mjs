#!/usr/bin/env node
// Import the RBI's bank-wise statistical tables.
//
//   node scripts/import-rbi-tables.mjs --file rbi-npa-2026.csv --period-end 2026-03-31 \
//        --name "Gross and Net NPAs and Capital Adequacy" \
//        --source-url https://rbi.org.in/... [--write --api https://your-deployment]
//
// Dry by default, and the dry run is the point. It prints which banks matched,
// which rows did not, and which banks in the master the table never mentioned.
// The unmatched list is the only thing standing between this and a wrong
// number: a row that does not resolve to exactly one bank is skipped, and the
// fix is an alias in src/data/indianBanks.ts, not a looser matcher.
//
// The RBI publishes these as spreadsheets behind a portal page. Convert to CSV
// first; doing it here would mean parsing XLSX inside a job with a timeout, and
// the conversion is a one-line job for any spreadsheet tool.

import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const flag = (n, d) => {
  const i = args.indexOf(`--${n}`);
  return i > -1 && args[i + 1] ? args[i + 1] : d;
};
const has = (n) => args.includes(`--${n}`);

const file = flag("file");
const periodEnd = flag("period-end");
const name = flag("name", "RBI bank-wise table");
const sourceUrl = flag("source-url", "");
const api = flag("api", process.env.QUANTIFI_BASE_URL || "");
const secret = process.env.CRON_SECRET || "";
const write = has("write");

if (!file || !periodEnd) {
  console.error("--file and --period-end are required.");
  console.error("  --period-end is the date the table is AS OF, e.g. 2026-03-31.");
  console.error("  Importing last year's table today must date its facts last year, or a card");
  console.error("  will present a year-old bad-loan ratio as current.");
  process.exit(1);
}

const csv = readFileSync(file, "utf8");
console.log(`${file}: ${csv.length.toLocaleString()} characters, as of ${periodEnd}`);

if (!write) {
  // Parse locally so the dry run needs no deployment and no credentials.
  const { execFileSync } = await import("node:child_process");
  const { mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const root = new URL("..", import.meta.url).pathname;
  const out = mkdtempSync(join(tmpdir(), "rbi-dry-"));
  execFileSync(
    "npx",
    ["tsc", join(root, "src/lib/filings/adapters/rbiBankTables.ts"), "--outDir", out,
     "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler"],
    { stdio: "pipe" }
  );
  const { parseRbiTable, matchBank } = await import(join(out, "rbiBankTables.js"));
  rmSync(out, { recursive: true, force: true });

  // The master is TypeScript data, so read the names out of it rather than
  // compiling the whole module for a dry run.
  const masterSrc = readFileSync(new URL("../src/data/indianBanks.ts", import.meta.url), "utf8");
  const master = Array.from(
    masterSrc.matchAll(/companyId: "([^"]+)", symbol: "([^"]+)", legalName: "([^"]+)"(?:, rbiNames: \[([^\]]*)\])?/g)
  ).map((m) => ({
    companyId: m[1],
    symbol: m[2],
    legalName: m[3],
    rbiNames: m[4] ? Array.from(m[4].matchAll(/"([^"]+)"/g)).map((a) => a[1]) : [],
  }));

  const table = parseRbiTable(csv);
  if (table.errors.length) console.error(`  errors: ${table.errors.join("; ")}`);
  console.log(`  columns found: ${Object.keys(table.columns).join(", ") || "none"}`);
  console.log(`  scale: x${table.scale.toLocaleString()}`);
  console.log(`  rows: ${table.rows.length}, master: ${master.length} banks`);

  const unmatched = [];
  let matched = 0;
  const seen = new Set();
  for (const row of table.rows) {
    const m = matchBank(row.bankName, master);
    if (m.entry) {
      matched++;
      seen.add(m.entry.companyId);
    } else unmatched.push(`${row.bankName} (line ${row.line}): ${m.reason}`);
  }
  console.log(`  matched: ${matched}`);
  if (unmatched.length) {
    console.log(`  UNMATCHED (${unmatched.length}). Each is a bank whose data is being skipped:`);
    for (const u of unmatched) console.log(`    ${u}`);
    console.log("  Fix by adding the name to rbiNames in src/data/indianBanks.ts.");
  }
  const missing = master.filter((m) => !seen.has(m.companyId));
  if (missing.length) {
    console.log(`  in the master but not in this table (${missing.length}):`);
    for (const m of missing.slice(0, 20)) console.log(`    ${m.legalName}`);
  }
  console.log("\nDry run. Pass --write with --api to import.");
  process.exit(0);
}

if (!api) {
  console.error("--api or QUANTIFI_BASE_URL is required to write.");
  process.exit(1);
}
if (!secret) {
  console.error("CRON_SECRET is required: the import route is guarded.");
  process.exit(1);
}
console.error("Writing goes through the deployment, which fetches the table itself.");
console.error("Set RBI_TABLES on the deployment to a JSON array of { url, name, periodEnd },");
console.error("then call /api/cron/filings-rbi. This flag exists to say so, not to bypass it:");
console.error("the job has to be re-runnable from a schedule, and a local upload is not.");
console.error(`  RBI_TABLES=[{"url":"${sourceUrl || "https://..."}","name":"${name}","periodEnd":"${periodEnd}"}]`);
console.error(`  curl -H "Authorization: Bearer $CRON_SECRET" ${api.replace(/\/$/, "")}/api/cron/filings-rbi?dry=1`);
process.exit(1);
