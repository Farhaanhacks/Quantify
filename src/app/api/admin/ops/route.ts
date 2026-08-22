import { NextResponse } from "next/server";
import { adminOr404, isNextResponse } from "@/lib/adminGuard";
import { adminConfigured } from "@/lib/access";
import { kvConfigured } from "@/lib/kv";
import { getIngestMeta } from "@/lib/insiderStore";
import { getTaiwanIngestMeta } from "@/lib/taiwan/insiderStore";
import { indiaIndexSize } from "@/lib/indiaCompanies";
import { fairValueHistoryConfigured } from "@/lib/fairValueHistory";
import { getUsageReport } from "@/lib/analytics";

// What the team sees that a user does not: the state of the machinery.
//
// Every figure here is about THIS DEPLOYMENT rather than about a company —
// which integration is configured, when each ingest last ran, how large the
// search index is. None of it is secret in itself, but together it is a map of
// the infrastructure, so it is staff-only and it never returns a secret's
// VALUE — only whether one is set.

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const isSet = (v: string | undefined) => Boolean(v && v.trim());

export async function GET() {
  const guard = adminOr404();
  if (isNextResponse(guard)) return guard;

  const [india, taiwan, indexSize, usage] = await Promise.all([
    getIngestMeta().catch(() => null),
    getTaiwanIngestMeta().catch(() => null),
    indiaIndexSize().catch(() => 0),
    getUsageReport().catch(() => null),
  ]);

  return NextResponse.json(
    {
      ok: true,
      you: guard.email,
      env: {
        // Booleans only. A page that prints which keys exist is useful; one that
        // prints their values is a credential leak with a nice layout.
        redis: kvConfigured(),
        fairValueHistory: fairValueHistoryConfigured(),
        adminAllowlist: adminConfigured(),
        cronSecret: isSet(process.env.CRON_SECRET),
        // The filings pipeline. Without R2 a large document is parsed and its
        // original is not kept, and without a table list the bulk import has
        // nothing to fetch; both fail quietly, so both are shown.
        filingsIngestSecret: isSet(process.env.FILINGS_INGEST_SECRET),
        r2: isSet(process.env.R2_ACCOUNT_ID) && isSet(process.env.R2_BUCKET) &&
          isSet(process.env.R2_ACCESS_KEY_ID) && isSet(process.env.R2_SECRET_ACCESS_KEY),
        rbiTables: isSet(process.env.RBI_TABLES),
        logoDev: isSet(process.env.LOGO_DEV_TOKEN),
        eodhd: isSet(process.env.EODHD_API_KEY),
        scraperApi: isSet(process.env.SCRAPER_API_KEY),
        vendorInsider: isSet(process.env.INSIDER_API_URL) && isSet(process.env.INSIDER_API_KEY),
        edgarUserAgent: isSet(process.env.EDGAR_USER_AGENT),
        razorpay: isSet(process.env.RAZORPAY_KEY_ID) && isSet(process.env.RAZORPAY_KEY_SECRET),
        googleAuth: isSet(process.env.GOOGLE_CLIENT_ID),
      },
      // Safety: the background routes and whether a caller without the secret is
      // turned away. These endpoints run market-wide scrapes and write to the
      // store, so an unprotected one is a button anyone who guesses the path can
      // press, repeatedly, at our expense.
      protection: {
        cronSecretSet: isSet(process.env.CRON_SECRET),
        // Every route that does real work on a GET, and the header/param it
        // checks. Listed explicitly so a new job added without a guard is
        // visible by its absence here.
        guardedRoutes: [
          "/api/cron/insider-in",
          "/api/cron/insider-tw",
          "/api/cron/filings-rbi",
          "/api/cron/filings-banks",
          "/api/insider/status",
          "/api/admin/ops",
          "/api/admin/run/[job]",
        ],
        method: "Authorization: Bearer <CRON_SECRET>, or ?key=<CRON_SECRET>",
        // The admin routes do not depend on the cron secret at all: they check
        // the signed session against the staff allowlist, so they stay closed
        // even while CRON_SECRET is unset.
        adminRoutesUseSession: true,
      },
      ingest: { india, taiwan },
      search: { indiaCompanies: indexSize },
      usage,
      now: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
