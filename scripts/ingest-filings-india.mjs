#!/usr/bin/env node
// Ingest filings from a local folder.
//
//   node scripts/ingest-filings-india.mjs --dir ./filings --company isin:INE040A01034 \
//        --industry bank --period-end 2026-03-31 --scope consolidated
//
// The development path, and the one to build the reader against. There is no
// way to reach the NSE's or the BSE's feed without a licence, so the honest
// order of work is: download a handful of real filings by hand, get the parser
// producing figures that match what the documents say when read by eye, and
// only then pay for a firehose. Everything downstream of the adapter is the
// same whichever way a document arrived.
//
// Dry by default. It prints what it WOULD store, because the first thing anyone
// wants from a new parser is to see what it made of a document, not to have the
// results written somewhere.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, extname } from "node:path";

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i > -1 && args[i + 1] ? args[i + 1] : fallback;
};
const has = (name) => args.includes(`--${name}`);

const dir = flag("dir", "./filings");
const companyId = flag("company");
const industry = flag("industry", "bank");
const periodEnd = flag("period-end");
const scope = flag("scope");
const apiBase = flag("api", process.env.QUANTIFI_BASE_URL || "");
const cookie = process.env.QUANTIFI_ADMIN_COOKIE || "";
const write = has("write");

if (!companyId) {
  console.error("--company is required, and must be an identifier: isin:INE040A01034 or cin:...");
  console.error("A ticker is not an identity. See src/lib/filings/companyMaster.ts.");
  process.exit(1);
}

let files;
try {
  files = readdirSync(dir)
    .filter((f) => [".xml", ".xbrl"].includes(extname(f).toLowerCase()))
    .filter((f) => statSync(join(dir, f)).isFile());
} catch {
  console.error(`Cannot read ${dir}.`);
  process.exit(1);
}
if (!files.length) {
  console.error(`No .xml or .xbrl files in ${dir}.`);
  process.exit(1);
}

console.log(`${files.length} document(s) in ${dir}`);
console.log(write ? "Writing." : "Dry run. Pass --write to store.");

for (const name of files) {
  const content = readFileSync(join(dir, name), "utf8");
  const payload = {
    companyId,
    industry,
    content,
    format: "xbrl",
    source: "manual",
    periodEnd,
    scope,
    sourceUrl: `file://${join(dir, name)}`,
  };

  if (!write) {
    console.log(`  ${name}: ${content.length} bytes, would post to /api/filings/ingest`);
    continue;
  }
  if (!apiBase) {
    console.error("  --api or QUANTIFI_BASE_URL is required to write.");
    process.exit(1);
  }
  if (!cookie) {
    console.error("  QUANTIFI_ADMIN_COOKIE is required: the ingest endpoint is admin-only.");
    process.exit(1);
  }
  try {
    const res = await fetch(`${apiBase.replace(/\/$/, "")}/api/filings/ingest`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify(payload),
    });
    const out = await res.json();
    if (out.duplicate) {
      console.log(`  ${name}: already held (${out.contentHash?.slice(0, 12)})`);
    } else if (out.ok) {
      console.log(`  ${name}: ${out.facts} facts, ${out.rejected} rejected, ${out.unmapped?.length ?? 0} unmapped tags`);
      for (const t of (out.unmapped ?? []).slice(0, 5)) console.log(`      unmapped: ${t}`);
      for (const i of (out.issues ?? []).slice(0, 5)) console.log(`      issue: ${i.concept}: ${i.reason}`);
      if (!out.rawStored) console.log(`      note: the original was NOT stored (${out.rawStoreReason})`);
    } else {
      console.error(`  ${name}: ${out.error}`);
    }
  } catch (e) {
    console.error(`  ${name}: ${e.message}`);
  }
}
