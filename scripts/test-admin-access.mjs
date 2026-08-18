#!/usr/bin/env node
// Tests for the email allowlists behind Pro comps and staff access.
//
// Run: node scripts/test-admin-access.mjs
//
// The failure that matters here is not a wrong answer, it is a PERMISSIVE one.
// An unset ADMIN_EMAILS must mean nobody is staff; a stray separator must not
// admit an empty string; a wildcard must not work, because nobody wrote the
// code to support one and a "*" in an env var should fail closed rather than
// open the operations page to every signed-in account.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "allowlist-"));
execFileSync(
  "npx",
  ["tsc", join(root, "src/lib/emailAllowlist.ts"), "--outDir", out, "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler"],
  { stdio: "pipe" }
);
const { parseEmailAllowlist, emailInAllowlist } = await import(join(out, "emailAllowlist.js"));
rmSync(out, { recursive: true, force: true });

let pass = 0;
let fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};

console.log("\n[an unset list admits nobody]");
check("undefined", emailInAllowlist("a@b.com", undefined) === false);
check("null", emailInAllowlist("a@b.com", null) === false);
check("empty string", emailInAllowlist("a@b.com", "") === false);
check("whitespace only", emailInAllowlist("a@b.com", "   ") === false);
check("separators only", emailInAllowlist("a@b.com", " , ; ") === false);
check("an empty email is never admitted", emailInAllowlist("", "a@b.com") === false);
check("a missing email is never admitted", emailInAllowlist(undefined, "a@b.com") === false);

console.log("\n[no wildcards — an allowlist is a list]");
check("a star does not admit everyone", emailInAllowlist("anyone@example.com", "*") === false);
check("nor does 'all'", emailInAllowlist("anyone@example.com", "all") === false);
check("nor an empty-ish entry", emailInAllowlist("anyone@example.com", ",,,") === false);
check("a domain alone does not admit its users",
  emailInAllowlist("someone@example.com", "example.com") === false);

console.log("\n[listed addresses are admitted, tolerantly]");
const list = " Owner@Example.com, ops@example.com ; staff@example.com\nsecond@example.com ";
check("comma separated", emailInAllowlist("ops@example.com", list));
check("semicolon separated", emailInAllowlist("staff@example.com", list));
check("newline separated", emailInAllowlist("second@example.com", list));
check("case-insensitive on the list", emailInAllowlist("owner@example.com", list));
check("case-insensitive on the input", emailInAllowlist("OPS@EXAMPLE.COM", list));
check("surrounding whitespace ignored", emailInAllowlist("  ops@example.com  ", list));
check("an unlisted address is refused", emailInAllowlist("someone@example.com", list) === false);
check("a near miss is refused", emailInAllowlist("ops@example.co", list) === false);
check("a substring is not a match", emailInAllowlist("ps@example.com", list) === false);

console.log("\n[parsing]");
check("count", parseEmailAllowlist(list).size === 4, String(parseEmailAllowlist(list).size));
check("entries are normalised", parseEmailAllowlist("A@B.COM").has("a@b.com"));
check("blanks are dropped", parseEmailAllowlist("a@b.com,,  ,c@d.com").size === 2);

console.log("\n[the guard fails closed, in the code as written]");
// Belt and braces: read the source and confirm the admin path has no early
// "return true" for an unset variable, which is the one edit that would quietly
// open the operations page to everyone.
const access = readFileSync(join(root, "src/lib/access.ts"), "utf8");
check("isAdminEmail delegates to the tested helper",
  /export function isAdminEmail[\s\S]{0,200}emailInAllowlist/.test(access));
check("the admin list is separate from PRO_EMAILS",
  /ADMIN_EMAILS/.test(access) && !/PRO_EMAILS[\s\S]{0,80}ADMIN/.test(access));

const guard = readFileSync(join(root, "src/lib/adminGuard.ts"), "utf8");
// Match the STATUS CODE, not the digits anywhere in the file — the comment
// above it explains the 403 it deliberately avoids returning.
check("the API guard answers 404, never 403",
  /status:\s*404/.test(guard) && !/status:\s*403/.test(guard));
check("and it reads the session server-side", /currentUser\(\)/.test(guard));

const page = readFileSync(join(root, "src/app/admin/page.tsx"), "utf8");
check("the page re-checks rather than trusting middleware",
  /isAdminEmail\(user\.email\)/.test(page) && /notFound\(\)/.test(page));
check("and is marked noindex", /robots:\s*\{\s*index:\s*false/.test(page));

const runner = readFileSync(join(root, "src/app/api/admin/run/[job]/route.ts"), "utf8");
check("jobs are a fixed map, not a caller-supplied path",
  /const JOBS/.test(runner) && /JOBS\[params\.job\]/.test(runner));
check("the runner is POST-only", /export async function POST/.test(runner) && !/export async function GET/.test(runner));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
