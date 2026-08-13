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

import { readdirSync, statSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";

const SKIP = new Set(["node_modules", ".next", ".git", "out", "dist", "build", ".vercel"]);
const EXTS = [".json", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css", ".md", ".mts"];
// The walk already yields .json, so package.json is covered.

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

// A stray copy of the project nested inside the tree — a release zip extracted
// into src/ or scripts/ rather than at the repo root. It has happened three
// times: it shadows the real configs, and it puts files where the linter and
// the compiler will try to read them. A package.json anywhere but the root is
// the reliable tell, so fail loudly and name the directory instead of leaving
// a confusing error in some minified vendor file thirty screens later.
function findNestedProjectCopies() {
  const hits = [];
  const root = process.cwd();
  let rootName;
  try {
    rootName = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).name;
  } catch {
    rootName = undefined;
  }
  for (const file of walk(root)) {
    if (!file.endsWith("/package.json") && !file.endsWith("\\package.json")) continue;
    if (file === join(root, "package.json")) continue;
    // Only a copy of THIS project, identified by the package name matching the
    // root's. A genuine nested package (a workspace, a vendored tool) has its
    // own name and is left alone — this must never delete something it merely
    // failed to recognise.
    let name;
    try {
      name = JSON.parse(readFileSync(file, "utf8")).name;
    } catch {
      continue;
    }
    if (rootName && name !== rootName) {
      console.warn(`[preflight] leaving nested package '${name}' at ${file} alone`);
      continue;
    }
    hits.push(dirname(file));
  }
  return hits;
}

// The files an extracted project copy brings with it. Only these are removed,
// never the directory holding them — the copies land *alongside* real source
// (src/ ends up holding both the stray package.json and the actual src/app),
// so deleting the parent would take the application with it. That is not a
// hypothetical: the first version of this repair did exactly that, and the
// test below is what caught it.
const COPY_FILES = [
  "package.json", "package-lock.json", "next.config.mjs", "tsconfig.json",
  "tailwind.config.ts", "postcss.config.mjs", "vercel.json", ".eslintrc.json",
  ".gitignore", ".gitattributes", ".editorconfig", "README.md",
  "SECURITY-HEADERS.md", "next-env.d.ts", ".env.local",
];
const COPY_DIRS = ["src", "scripts", "public", ".next", "out", "node_modules"];

// Repair rather than refuse.
//
// This used to print the offending directories and exit 1. That was right as a
// diagnosis and useless as a fix: the build failed, and the copies stayed
// exactly where they were until someone deleted them by hand — which, on this
// project, is a thing that has had to happen four times. A release archive
// extracted into the wrong folder cannot be undone by extracting it again,
// because unzipping only adds and overwrites; it never removes. So the only
// place this can actually be put right is here.
//
// The directory is removed and the build carries on. On a build server the
// checkout is disposable, so this simply lets the deploy succeed. On a working
// copy the files really are deleted, so the next `git add -A` records the
// removal and the repository is finally clean.
const nested = findNestedProjectCopies();
if (nested.length) {
  console.warn("\n[preflight] A copy of the project was nested inside the repository:\n");
  for (const dir of nested) {
    const rel = dir.replace(process.cwd() + "/", "");
    for (const entry of [...COPY_FILES, ...COPY_DIRS]) {
      const target = join(dir, entry);
      let exists = true;
      try {
        statSync(target);
      } catch {
        exists = false;
      }
      if (!exists) continue;
      try {
        rmSync(target, { recursive: true, force: true });
        console.warn(`  removed  ${rel}/${entry}`);
      } catch (err) {
        console.error(`  FAILED to remove ${rel}/${entry} — ${err.message}`);
        process.exit(1);
      }
    }
  }
  console.warn(
    "\nThis happens when a release archive is extracted into a subfolder rather than\n" +
      "the repository root. The copies above have been deleted and the build is\n" +
      "continuing. If this was a working copy rather than a build server, commit the\n" +
      "deletions (git add -A) so the repository stops carrying them.\n"
  );
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
