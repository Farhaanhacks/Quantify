# TWSE / TPEx insider dataset samples

These JSON files are what `scripts/test-taiwan-insider.mjs` parses. They pin the
column names the parser reads, so a column rename at the exchange fails a test
instead of quietly producing rows with blanks in them — or, worse, no rows and a
page that says the company disclosed nothing.

## Provenance — read this before trusting them

The files here were **reconstructed from the published dataset schemas**, not
captured from a live response. The environment this was written in has no route
to `openapi.twse.com.tw` or `www.tpex.org.tw`, so a real capture was not
possible. They are the right *shape* and use the documented Chinese column
names, but the exchange is the authority on both, not this directory.

Two consequences worth being plain about:

1. The tests prove the parser handles the schema **as documented**. They do not
   prove the live feed matches that schema today.
2. If the live columns differ, the parser will not invent values — a required
   column it cannot find is a hard parse failure, which surfaces to the reader as
   *"Source temporarily unavailable"* and to the operator as a failed ingest with
   the payload's real column names recorded in `insider:tw:v1:_meta`.

## Replacing them with real captures

Once the ingest has run anywhere with network access, replace each file with the
first few rows of the real response and re-run the tests:

```sh
curl -s https://openapi.twse.com.tw/v1/opendata/t187ap11_L | jq '.[0:3]' \
  > scripts/fixtures/taiwan/t187ap11_L.json
curl -s https://openapi.twse.com.tw/v1/opendata/t187ap12_L | jq '.[0:3]' \
  > scripts/fixtures/taiwan/t187ap12_L.json
curl -s https://openapi.twse.com.tw/v1/opendata/t187ap13_L | jq '.[0:3]' \
  > scripts/fixtures/taiwan/t187ap13_L.json
curl -s https://www.tpex.org.tw/openapi/v1/t187ap11_O | jq '.[0:3]' \
  > scripts/fixtures/taiwan/t187ap11_O.json
curl -s https://www.tpex.org.tw/openapi/v1/t187ap12_O | jq '.[0:3]' \
  > scripts/fixtures/taiwan/t187ap12_O.json
curl -s https://www.tpex.org.tw/openapi/v1/t187ap13_O | jq '.[0:3]' \
  > scripts/fixtures/taiwan/t187ap13_O.json

node scripts/test-taiwan-insider.mjs
```

A failure at that point is the test doing its job: it means the live schema and
the one the parser knows have diverged, and the alias lists in
`src/lib/taiwan/insiderParse.ts` need the real names adding.

The live column names are also recorded on every ingest run
(`datasets[].seenColumns` in the metadata, and in the cron route's JSON
response), so you can read them off a run without fetching anything by hand.
