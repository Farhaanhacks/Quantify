import { NextResponse } from "next/server";
import { importRbiTable } from "@/lib/filings/adapters/rbiImport";
import { INDIAN_BANKS } from "@/data/indianBanks";
import { kvConfigured, recordError } from "@/lib/filings/store";

// The scheduled bulk import: one table, every listed bank.
//
// This is the job that makes a hundred and forty banks a fixed cost rather than
// a per-bank one. The RBI publishes its bank-wise statistical tables once a
// year, free, with exactly the four measures every bank's balance-sheet card is
// missing, and one pass over one file updates all of them.
//
// It is annual, so the schedule is not the point of it. The point is that a
// re-run is idempotent and cheap: the same table produces the same filing ids
// and replaces its own facts, so this can be triggered after any correction to
// the bank master or the column patterns and the whole market catches up.
//
// The table URL is configuration rather than a constant. The RBI changes the
// path each year and the download is an XLSX behind a portal page; converting
// it to CSV is a step that has to happen somewhere, and doing it outside means
// this route never has to parse a spreadsheet format inside a serverless
// function with a timeout.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization") || "";
  const key = new URL(req.url).searchParams.get("key") || "";
  return auth === `Bearer ${secret}` || key === secret;
}

interface TableSource {
  url: string;
  name: string;
  periodEnd: string;
}

/**
 * Which tables to import, from the environment.
 *
 * RBI_TABLES is a JSON array of { url, name, periodEnd }. Configuration rather
 * than code because the URL changes annually and the period is a property of
 * the file rather than of the run: importing last year's table today must date
 * its facts last year, or a card will present a year-old bad-loan ratio as
 * current.
 */
function sources(): TableSource[] {
  const raw = process.env.RBI_TABLES;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as TableSource[];
    return Array.isArray(parsed)
      ? parsed.filter((t) => t && typeof t.url === "string" && typeof t.periodEnd === "string")
      : [];
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const dryRun = new URL(req.url).searchParams.get("dry") === "1";

  if (!kvConfigured() && !dryRun) {
    return NextResponse.json(
      { error: "Storage is not configured; the import would parse and keep nothing." },
      { status: 503 }
    );
  }
  const tables = sources();
  if (!tables.length) {
    return NextResponse.json(
      {
        error:
          'No tables configured. Set RBI_TABLES to a JSON array of { "url", "name", "periodEnd" }, pointing at CSV conversions of the RBI bank-wise tables.',
      },
      { status: 400 }
    );
  }

  const reports = [];
  for (const table of tables) {
    let csv: string;
    try {
      const res = await fetch(table.url, { signal: AbortSignal.timeout(60000) });
      if (!res.ok) {
        reports.push({ table: table.name, error: `Source responded ${res.status}.` });
        await recordError({
          at: new Date().toISOString(),
          stage: "fetch",
          message: `RBI table ${table.name}: HTTP ${res.status} from ${table.url}`,
        });
        continue;
      }
      csv = await res.text();
    } catch (e) {
      reports.push({ table: table.name, error: `Unreachable: ${(e as Error).message}` });
      continue;
    }

    const report = await importRbiTable({
      csv,
      periodEnd: table.periodEnd,
      sourceUrl: table.url,
      tableName: table.name,
      master: INDIAN_BANKS,
      dryRun,
    });
    reports.push({ table: table.name, ...report });
  }

  return NextResponse.json({
    ok: reports.some((r) => "ok" in r && r.ok),
    dryRun,
    banksInMaster: INDIAN_BANKS.length,
    reports,
  });
}
