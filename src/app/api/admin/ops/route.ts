import { NextResponse } from "next/server";
import { adminOr404, isNextResponse } from "@/lib/adminGuard";
import { adminConfigured } from "@/lib/access";
import { kvConfigured } from "@/lib/kv";
import { getIngestMeta } from "@/lib/insiderStore";
import { getTaiwanIngestMeta } from "@/lib/taiwan/insiderStore";
import { indiaIndexSize } from "@/lib/indiaCompanies";
import { fairValueHistoryConfigured } from "@/lib/fairValueHistory";

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

  const [india, taiwan, indexSize] = await Promise.all([
    getIngestMeta().catch(() => null),
    getTaiwanIngestMeta().catch(() => null),
    indiaIndexSize().catch(() => 0),
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
        logoDev: isSet(process.env.LOGO_DEV_TOKEN),
        eodhd: isSet(process.env.EODHD_API_KEY),
        scraperApi: isSet(process.env.SCRAPER_API_KEY),
        vendorInsider: isSet(process.env.INSIDER_API_URL) && isSet(process.env.INSIDER_API_KEY),
        edgarUserAgent: isSet(process.env.EDGAR_USER_AGENT),
        razorpay: isSet(process.env.RAZORPAY_KEY_ID) && isSet(process.env.RAZORPAY_KEY_SECRET),
        googleAuth: isSet(process.env.GOOGLE_CLIENT_ID),
      },
      ingest: { india, taiwan },
      search: { indiaCompanies: indexSize },
      now: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
