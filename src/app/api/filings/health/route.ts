import { NextResponse } from "next/server";
import { adminOr404, isNextResponse } from "@/lib/adminGuard";
import { kvConfigured, kvGet, kvSet } from "@/lib/kv";
import { r2Config, r2Put } from "@/lib/filings/r2";
import { getCompanyFacts, companyIdForSymbol } from "@/lib/filings/store";
import { discoverBseResults } from "@/lib/filings/adapters/bseAnnouncements";
import { discoverNseResults } from "@/lib/filings/adapters/nseAnnouncements";
import { usingProxy } from "@/lib/insiderIndia";
import { INDIAN_BANKS } from "@/data/indianBanks";
import { primarySymbol } from "@/lib/filings/adapters/rbiBankTables";

// One URL that says where the chain is broken.
//
// This exists because the same question kept being asked and kept being
// answered in prose: everything is in place, so why is the card still empty.
// Prose is the wrong instrument. The chain has seven links — credentials, a
// proxy, two exchanges, a parser, a store, a bucket, a symbol lookup — and any
// one of them failing produces exactly the same symptom at the far end, which
// is a bank card reading four of eight.
//
// So this walks the chain in order and reports each link. It is deliberately
// end-to-end rather than a set of environment checks: a variable being SET is
// not the same as a store being writable, and the difference is precisely the
// kind of thing that hides for a week.
//
// Ordered by what blocks what. The first failure is usually the only one worth
// fixing, because the ones after it are consequences.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const isSet = (v?: string) => !!v && v.trim().length > 0;

interface Link {
  step: string;
  ok: boolean;
  detail: string;
  /** What to do about it, when it is not ok. */
  fix?: string;
  /** Anything the step wants to say that is not the headline. */
  notes?: string[];
}

export async function GET(req: Request) {
  const gate = adminOr404();
  if (isNextResponse(gate)) return gate;

  const url = new URL(req.url);
  const symbol = (url.searchParams.get("symbol") ?? "HDFCBANK.NS").trim();
  const probeExchanges = url.searchParams.get("probe") !== "0";
  const links: Link[] = [];

  // 1. Can anything be kept at all.
  let kvOk = false;
  if (!kvConfigured()) {
    links.push({
      step: "Fact storage (KV)",
      ok: false,
      detail: "Not configured.",
      fix: "Set KV_REST_API_URL and KV_REST_API_TOKEN. Without these the pipeline downloads, parses, and keeps nothing.",
    });
  } else {
    const probe = `filings:health:${Date.now()}`;
    const wrote = await kvSet(probe, "1", 60);
    const read = wrote ? await kvGet(probe) : null;
    kvOk = read === "1";
    links.push({
      step: "Fact storage (KV)",
      ok: kvOk,
      detail: kvOk ? "Configured, and a write round-tripped." : "Configured, but a write did not read back.",
      fix: kvOk ? undefined : "The credentials are present but the database is not answering. Check the Upstash instance is live.",
    });
  }

  // 2. Where the original documents go. Not fatal: a small document falls back
  //    to KV, so this is a warning rather than a stop.
  const r2 = r2Config();
  if (!r2) {
    links.push({
      step: "Document archive (R2)",
      ok: false,
      detail: "Not configured. Documents under 400KB fall back to KV; larger ones are parsed and not archived.",
      fix: "Set R2_ACCOUNT_ID, R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.",
    });
  } else {
    const put = await r2Put(`health/${Date.now()}.txt`, "quantifi filings health probe", "text/plain");
    links.push({
      step: "Document archive (R2)",
      ok: put.ok,
      detail: put.ok ? "Wrote a probe object." : (put.error ?? "Write failed."),
      fix: put.ok
        ? undefined
        : put.status === 403
          ? "403 is the access key or the signature. Check R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY."
          : put.status === 404
            ? "404 is the bucket name. Check R2_BUCKET."
            : "A network error here is usually R2_ACCOUNT_ID, which forms the hostname.",
    });
  }

  // 3. The proxy. Both exchanges block datacenter IPs, so without this the
  //    downloaders will report blocks that are not really blocks.
  links.push({
    step: "Exchange proxy (ScraperAPI)",
    ok: usingProxy(),
    detail: usingProxy()
      ? "Configured."
      : "Not configured. Requests go direct, and both exchanges block datacenter addresses.",
    fix: usingProxy() ? undefined : "Set SCRAPER_API_KEY. The insider pages use the same key.",
  });

  // 4. Is the job guarded, and is it scheduled.
  links.push({
    step: "Scheduled job",
    ok: isSet(process.env.CRON_SECRET),
    detail: isSet(process.env.CRON_SECRET)
      ? "CRON_SECRET is set, so /api/cron/filings-banks is guarded."
      : "CRON_SECRET is not set, so the job is callable by anyone.",
    fix: isSet(process.env.CRON_SECRET) ? undefined : "Set CRON_SECRET.",
  });

  // 5. The identity join. A filing stored under an id no page looks up is the
  //    failure that produces no error anywhere.
  const bank = INDIAN_BANKS.find((b) =>
    b.symbols.some((s) => s.toUpperCase().replace(/\.(NS|BO)$/, "") === symbol.toUpperCase().replace(/\.(NS|BO)$/, ""))
  );
  const resolvedId = await companyIdForSymbol(symbol);
  links.push({
    step: `Identity for ${symbol}`,
    ok: !!bank,
    detail: bank
      ? `In the bank master as ${bank.legalName}, stored under ${bank.companyId}, reachable by ${bank.symbols.join(" and ")}. This page looks up ${resolvedId}.`
      : `${symbol} is not in the bank master, so the bank checklist will not be used for it.`,
    fix: bank
      ? bank.companyId === resolvedId
        ? undefined
        : "The master's id and the page's lookup disagree, which means an ingest has not yet written the symbol link. It is written on the first successful ingest."
      : "Add it to src/data/indianBanks.ts.",
  });

  // 6. What is actually stored.
  let stored = 0;
  let periods: string[] = [];
  try {
    const facts = await getCompanyFacts(resolvedId);
    const published = facts.filter((f) => !f.rejectedReason);
    stored = published.length;
    periods = Array.from(new Set(published.map((f) => f.periodEnd).filter(Boolean) as string[])).sort().reverse();
  } catch {
    /* reported as zero below */
  }
  links.push({
    step: "Facts held",
    ok: stored > 0,
    detail: stored > 0
      ? `${stored} facts across ${periods.length} period(s): ${periods.slice(0, 4).join(", ")}.`
      : "None. This is why the card reads four of eight.",
    fix: stored > 0 ? undefined : "Run /api/cron/filings-banks?symbol=" + symbol.replace(/\.(NS|BO)$/, "") + " once the links above are green.",
  });

  // 7. Can either exchange actually be reached, right now, for this company.
  //    The expensive check, so it can be skipped.
  if (probeExchanges) {
    const target = bank ? primarySymbol(bank) : symbol;
    const bse = await discoverBseResults({ symbol: target, limit: 1 });
    links.push({
      step: "BSE results feed",
      ok: bse.filings.length > 0,
      detail: bse.filings.length
        ? `Found ${bse.filings.length} document(s). Latest: ${bse.filings[0].sourceUrl}`
        : bse.unavailableReason ?? "Nothing returned.",
      fix: bse.filings.length
        ? undefined
        : "If this says a status code, it is a block or a moved endpoint. If it says no XBRL attachment, the company filed a PDF only and the NSE is the better source.",
      notes: bse.notes?.slice(0, 6),
    });

    if (!bse.filings.length) {
      const nse = await discoverNseResults({ symbol: target, limit: 1 });
      links.push({
        step: "NSE results feed",
        ok: nse.filings.length > 0,
        detail: nse.filings.length
          ? `Found ${nse.filings.length} document(s). Latest: ${nse.filings[0].sourceUrl}`
          : nse.unavailableReason ?? "Nothing returned.",
        fix: nse.filings.length
          ? undefined
          : "An empty list from the NSE usually means the session cookies were not established, which is a proxy problem rather than a missing filing.",
      });
    }
  }

  const firstBroken = links.find((l) => !l.ok);
  return NextResponse.json({
    symbol,
    // The one line worth reading. Everything after the first break is a
    // consequence of it.
    verdict: firstBroken
      ? `Blocked at: ${firstBroken.step}. ${firstBroken.fix ?? firstBroken.detail}`
      : "Every link is working and facts are held for this company.",
    links,
  });
}
