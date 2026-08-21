# Quantifi filing storage: Cloudflare R2

This package connects the existing filing-ingestion pipeline to Cloudflare R2.
It does **not** contain an NSE/BSE scraping bypass. Automatic exchange downloads
still require a licensed feed or another source whose terms permit automation.

## 1. Create the bucket

In Cloudflare Dashboard:

1. Open **R2 Object Storage**.
2. Create a bucket named `quantifi-filings-raw`.
3. Keep it private. Quantifi should publish derived facts and the original
   exchange URL, not a public copy of every source document.

## 2. Create the Cloudflare key

Open **R2 > Manage R2 API Tokens** and create a token with:

- Permission: **Object Read & Write**
- Scope: only `quantifi-filings-raw`

Cloudflare will show an **Access Key ID** and a **Secret Access Key**. Put them
in Vercel using these exact names:

```text
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME=quantifi-filings-raw
R2_FILINGS_PREFIX=filings
```

There is no single “R2 database key”. `R2_ACCESS_KEY_ID` identifies the token;
`R2_SECRET_ACCESS_KEY` is its secret. Never prefix either variable with
`NEXT_PUBLIC_`, commit it to GitHub, paste it into a client component, or send
the secret value to another person.

## 3. Create the ingestion secret

This is separate from Cloudflare. Generate it locally:

```bash
openssl rand -base64 48
```

Save the result in Vercel as `FILINGS_INGEST_SECRET`. A scheduled worker sends
it as:

```text
Authorization: Bearer <FILINGS_INGEST_SECRET>
```

## 4. Install and verify

Copy this overlay into the current Quantifi repository, then run:

```bash
npm install
npm run build
node scripts/check-r2-config.mjs
```

The final command checks names only and never prints secret values.

## 5. How objects are stored

```text
filings/india/{source}/{company-id}/{period-end}/{sha256}.{extension}
```

Example:

```text
filings/india/nse/isin-ine040a01034/2026-03-31/abc123....xbrl
```

Content hashes make documents immutable and deduplicate identical copies.

## 6. What this changes

- Raw XBRL/XML/PDF content goes to R2.
- Raw documents no longer fall back to Redis.
- Filing metadata and parsed facts continue to use the existing KV layer.
- An upload failure is returned explicitly instead of being silently ignored.

For production scale, migrate filing metadata and facts from KV to PostgreSQL
later. That migration is not required to begin testing R2 storage.

## 7. Automatic downloads

R2 is the destination, not the source. The existing adapter boundary supports:

- licensed NSE corporate-data staging;
- authenticated BSE corporate-data API;
- manual official XBRL uploads for development.

Do not enter the Cloudflare key into `NSE_FEED_TOKEN` or `BSE_API_KEY`; they are
different services and different credentials.
