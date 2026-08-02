// Repairs source files saved with a byte-order mark or as UTF-16 before the
// build reads them. Node and TypeScript expect UTF-8 with no BOM; a Windows
// editor that writes anything else makes every parser fail on line 1, column 1
// ("TS1005: '{' expected") with nothing visibly wrong in the file.
//
// Wired to `prebuild`, so it runs locally and on Vercel.
//
// IMPORTANT: this cannot save vercel.json. Vercel parses that file to plan the
// deployment, before it installs dependencies or runs any script — by the time
// this executes, that check has already passed or failed. vercel.json has to be
// correct in the repository itself.

import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const SKIP = new Set(["node_modules", ".next", ".git", "out", "dist", "build", ".vercel"]);
const EXTS = [".json", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".md", ".mts"];

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const p = join(dir, entry);
    let st;
    try {
      st = statSync(p);
    } catch {
      continue;
    }
    if (st.isDirectory()) yield* walk(p);
    else if (EXTS.some((e) => entry.endsWith(e))) yield p;
  }
}

const fixed = [];

for (const file of walk(process.cwd())) {
  let buf;
  try {
    buf = readFileSync(file);
  } catch {
    continue;
  }
  if (buf.length < 2) continue;

  let text = null;
  let kind = null;

  if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    kind = "UTF-8 BOM";
    text = buf.subarray(3).toString("utf8");
  } else if (buf[0] === 0xff && buf[1] === 0xfe) {
    kind = "UTF-16 LE";
    text = buf.subarray(2).toString("utf16le");
  } else if (buf[0] === 0xfe && buf[1] === 0xff) {
    kind = "UTF-16 BE";
    // Node has no utf16be decoder; swap the byte pairs and decode as LE.
    const swapped = Buffer.from(buf.subarray(2));
    swapped.swap16();
    text = swapped.toString("utf16le");
  }

  if (text == null) continue;

  try {
    writeFileSync(file, Buffer.from(text.replace(/^﻿/, ""), "utf8"));
    fixed.push(`${file.replace(process.cwd() + "/", "")} (${kind})`);
  } catch {
    /* read-only file — report it rather than failing the build */
  }
}

if (fixed.length) {
  console.log(`[fix-encoding] repaired ${fixed.length} file(s) written with a BOM or as UTF-16:`);
  for (const f of fixed) console.log(`  - ${f}`);
} else {
  console.log("[fix-encoding] all source files are UTF-8 without a BOM.");
}
