import { NextResponse } from "next/server";
import { getIngestMeta, kvConfigured } from "@/lib/insiderStore";
import { getNSEInsiderWithDebug } from "@/lib/insiderIndiaNSE";
import { getIndiaInsiderWithDebug } from "@/lib/insiderIndia";
import { getCompanyInsiderTrades } from "@/lib/insider";

// One endpoint that answers "why is there no insider data?" definitively.
//
// The Indian pipeline has four independent things that can each silently stop
// it — a missing Redis, a missing proxy key, a cron that has never run, and an
// exchange that blocks datacenter IPs — and from the outside all four look
// identical: an empty list. Guessing between them by redeploying is slow, so
// this reports which layers are CONFIGURED and then actually PROBES each one.
//
// It never returns a secret's value, only whether it is set.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function authorized(req: Request): boolean {
  // Same rule as the ingest cron: protected when CRON_SECRET is set, open when
  // it isn't (this exposes no secret values either way).
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization") || "";
  const key = new URL(req.url).searchParams.get("key") || "";
  return auth === `Bearer ${secret}` || key === secret;
}

const isSet = (v: string | undefined): boolean => Boolean(v && v.trim());

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const inSymbol = (url.searchParams.get("in") || "RELIANCE.NS").toUpperCase();
  const usSymbol = (url.searchParams.get("us") || "AAPL").toUpperCase();
  const probe = url.searchParams.get("probe") !== "0";

  const config = {
    // Layer 1 — a paid vendor serving SEBI PIT disclosures as JSON. Set these
    // and India works without touching an exchange at all.
    vendorApi: isSet(process.env.INSIDER_API_URL) && isSet(process.env.INSIDER_API_KEY),
    // Layer 2 — residential proxy. NSE and BSE both block datacenter IPs, which
    // is every IP a Vercel function has. Without this, India cannot work.
    scraperApiKey: isSet(process.env.SCRAPER_API_KEY),
    scraperPremium: isSet(process.env.SCRAPER_PREMIUM),
    scraperUltra: isSet(process.env.SCRAPER_ULTRA),
    // The store the daily cron fills, and every user request reads.
    redis: kvConfigured(),
    // The US path needs only a declared User-Agent; SEC asks for a contact
    // address and rate-limits rather than blocking.
    edgarUserAgent: isSet(process.env.EDGAR_USER_AGENT),
    cronSecret: isSet(process.env.CRON_SECRET),
  };

  const meta = await getIngestMeta().catch(() => null);

  let probes: Record<string, unknown> = { skipped: true };
  if (probe) {
    const [nse, bse, us] = await Promise.all([
      getNSEInsiderWithDebug(inSymbol, 5).catch((e) => ({
        disclosures: [],
        debug: { error: String(e).slice(0, 200) },
      })),
      getIndiaInsiderWithDebug(inSymbol, 5).catch((e) => ({
        disclosures: [],
        debug: { error: String(e).slice(0, 200) },
      })),
      getCompanyInsiderTrades(usSymbol, 5).catch(() => []),
    ]);
    probes = {
      nse: { symbol: inSymbol, rows: nse.disclosures.length, debug: nse.debug },
      bse: { symbol: inSymbol, rows: bse.disclosures.length, debug: bse.debug },
      sec: { symbol: usSymbol, rows: Array.isArray(us) ? us.length : 0 },
    };
  }

  // The single sentence a human actually wants.
  const verdict: string[] = [];
  if (!config.redis) {
    verdict.push(
      "Redis is not configured (KV_REST_API_URL / KV_REST_API_TOKEN), so the daily ingest cron aborts and nothing is ever stored."
    );
  } else if (!meta) {
    verdict.push(
      "Redis is configured but the ingest cron has never completed a run — no stored disclosures exist yet. Trigger /api/cron/insider-in once."
    );
  }
  if (!config.vendorApi && !config.scraperApiKey) {
    verdict.push(
      "Neither a vendor API nor a residential proxy is configured. NSE and BSE block datacenter IPs, which is every IP this app runs on, so live Indian fetches cannot succeed."
    );
  }
  if (!config.edgarUserAgent) {
    verdict.push(
      "EDGAR_USER_AGENT is not set. SEC asks for a declared contact string and throttles requests without one, so US Form 4 data may be rate-limited."
    );
  }
  if (!verdict.length) verdict.push("All layers configured.");

  return NextResponse.json({
    ok: true,
    verdict,
    config,
    ingest: meta ?? null,
    probes,
    reference: {
      india:
        "SEBI (PIT) Regulation 7 disclosures are published by NSE and BSE, not by EDGAR. screener.in and tickertape read the same filings from Indian infrastructure.",
      us: "SEC Form 4 via EDGAR, which serves datacenter IPs given a User-Agent.",
    },
  });
}
