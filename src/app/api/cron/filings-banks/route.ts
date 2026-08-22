import { NextResponse } from "next/server";
import { discoverBseResults } from "@/lib/filings/adapters/bseAnnouncements";
import { discoverNseResults } from "@/lib/filings/adapters/nseAnnouncements";
import { ingestFiling } from "@/lib/filings/adapters/manualUpload";
import { INDIAN_BANKS } from "@/data/indianBanks";
import { kvConfigured, kvGet, kvSet } from "@/lib/kv";
import { recordError } from "@/lib/filings/store";
import { primarySymbol } from "@/lib/filings/adapters/rbiBankTables";

// The job that was missing.
//
// Everything else was in place — a parser, a store, a bucket, two exchange
// adapters, a card that knows what to do with the facts — and nothing ever went
// and fetched a filing. The scheduler ran insider disclosures and only insider
// disclosures, so the bank cards sat at four of eight indefinitely, and no
// amount of correctness elsewhere was going to change that.
//
// Two things shape the design:
//
//   It works through the list a few banks at a time, keeping a cursor. Forty
//   banks against two exchanges, each needing a rendered warm-up and a document
//   download, is far past any serverless time budget. A run that times out
//   halfway is worse than a small run that finishes: it writes some banks,
//   reports nothing, and starts from the top next time, so the tail of the list
//   is never reached.
//
//   It tries both exchanges. A company files with both, the feeds fail
//   independently, and a filing missing from one is usually present in the
//   other. A pipeline behind a single exchange reports "no filings" for an
//   outage, which is the same sentence it uses for a company that filed
//   nothing.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CURSOR = "filings:banks:cursor";
const DEFAULT_BATCH = 6;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization") || "";
  const key = new URL(req.url).searchParams.get("key") || "";
  return auth === `Bearer ${secret}` || key === secret;
}

interface BankOutcome {
  bank: string;
  companyId: string;
  source?: "bse" | "nse";
  found: number;
  ingested: number;
  facts: number;
  duplicates: number;
  unmapped?: string[];
  reason?: string;
}

export async function GET(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "not found" }, { status: 404 });

  const url = new URL(req.url);
  const dryRun = url.searchParams.get("dry") === "1";
  const only = url.searchParams.get("symbol");
  const batchSize = Math.max(1, Math.min(20, Number(url.searchParams.get("batch") ?? DEFAULT_BATCH)));

  if (!kvConfigured() && !dryRun) {
    return NextResponse.json(
      { error: "Storage is not configured; the run would download filings and keep nothing." },
      { status: 503 }
    );
  }

  // One bank by name, or a slice of the list from where the last run stopped.
  const root = (x: string) => x.toUpperCase().replace(/\.(NS|BO)$/, "");
  let batch = INDIAN_BANKS;
  let start = 0;
  if (only) {
    batch = INDIAN_BANKS.filter((b) => b.symbols.some((s) => root(s) === root(only)));
    if (!batch.length) {
      return NextResponse.json({ error: `${only} is not in the bank master.` }, { status: 404 });
    }
  } else {
    const saved = kvConfigured() ? await kvGet(CURSOR) : null;
    start = Number(saved) || 0;
    if (!isFinite(start) || start < 0 || start >= INDIAN_BANKS.length) start = 0;
    batch = INDIAN_BANKS.slice(start, start + batchSize);
  }

  const outcomes: BankOutcome[] = [];

  for (const bank of batch) {
    const symbol = primarySymbol(bank);
    const outcome: BankOutcome = {
      bank: bank.legalName,
      companyId: bank.companyId,
      found: 0,
      ingested: 0,
      facts: 0,
      duplicates: 0,
    };

    // BSE first: its announcements API answers without a rendered warm-up, so
    // it is both faster and cheaper in proxy credits. The NSE is the fallback
    // rather than the second half of a pair, because a filing found on one is
    // the same document as the filing on the other.
    let found = await discoverBseResults({ symbol, limit: 2 });
    let usedSource: "bse" | "nse" = "bse";
    if (!found.filings.length) {
      const nse = await discoverNseResults({ symbol, limit: 2 });
      if (nse.filings.length) {
        found = nse;
        usedSource = "nse";
      } else {
        outcome.reason = `BSE: ${found.unavailableReason ?? "nothing"}. NSE: ${nse.unavailableReason ?? "nothing"}.`;
      }
    }

    outcome.found = found.filings.length;
    outcome.source = found.filings.length ? usedSource : undefined;

    if (!found.filings.length) {
      // Recorded, because a company that stops appearing is a taxonomy change
      // or a blocked proxy far more often than it is a company that stopped
      // filing, and neither raises an exception.
      await recordError({
        at: new Date().toISOString(),
        companyId: bank.companyId,
        stage: "fetch",
        message: `${bank.legalName}: ${outcome.reason ?? "no results filing found"}`,
      });
      outcomes.push(outcome);
      continue;
    }

    if (dryRun) {
      outcomes.push(outcome);
      continue;
    }

    for (const f of found.filings) {
      const result = await ingestFiling({
        companyId: bank.companyId,
        industry: "bank",
        content: f.content,
        format: "xbrl",
        source: usedSource,
        sourceUrl: f.sourceUrl,
        exchangeFilingId: f.exchangeFilingId,
        category: f.category,
        submittedAt: f.filedAt,
        periodEnd: f.periodEnd,
        // Both listings. Half the readers arrive at the other symbol.
        symbols: bank.symbols,
      });
      if (result.duplicate) outcome.duplicates++;
      else if (result.ok) {
        outcome.ingested++;
        outcome.facts += result.facts ?? 0;
        // The unmapped tags are the actionable output of a first run: each one
        // is a figure the document carries and the alias table does not know.
        if (result.unmapped?.length) {
          outcome.unmapped = Array.from(new Set([...(outcome.unmapped ?? []), ...result.unmapped])).slice(0, 25);
        }
      } else if (result.error) {
        outcome.reason = result.error;
      }
    }
    outcomes.push(outcome);
  }

  // Advance the cursor only on a full pass through the list, and only when this
  // was not a single-bank run.
  let nextCursor = start;
  if (!only && kvConfigured() && !dryRun) {
    nextCursor = start + batch.length >= INDIAN_BANKS.length ? 0 : start + batch.length;
    await kvSet(CURSOR, String(nextCursor));
  }

  const unmappedAcross = Array.from(
    new Set(outcomes.flatMap((o) => o.unmapped ?? []))
  ).slice(0, 40);

  return NextResponse.json({
    ok: outcomes.some((o) => o.ingested > 0 || o.duplicates > 0),
    dryRun,
    banksInMaster: INDIAN_BANKS.length,
    processed: batch.length,
    cursor: { from: start, next: only ? start : nextCursor },
    // The single most useful field on a first run.
    unmappedTags: unmappedAcross,
    outcomes,
  });
}
