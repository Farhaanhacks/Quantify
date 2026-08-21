#!/usr/bin/env node

const required = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
];

const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`R2 configuration is incomplete. Missing: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Cloudflare R2 environment variables are present.");
console.log(`Bucket: ${process.env.R2_BUCKET_NAME}`);
console.log(`Prefix: ${process.env.R2_FILINGS_PREFIX || "filings"}`);
console.log("Secret values were intentionally not printed.");
