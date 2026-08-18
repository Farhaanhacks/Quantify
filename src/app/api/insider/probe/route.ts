import { NextResponse } from "next/server";

// Which Indian data sources will actually answer THIS deployment.
//
// Every exchange host is blocked from the environment this code was written in,
// so the one question that decides the whole feature — does NSE serve a Vercel
// IP at all, or only refuse its API? — cannot be answered there. It can be
// answered here, from the IP that matters, which is the point of this endpoint.
//
// Read the results like this:
//
//   nse-home 200 + nse-api 403  → the IP is fine, it is the cookie handshake.
//                                 A session-aware fetch can work; no proxy needed.
//   nse-home 403                → the IP itself is refused. Only a residential
//                                 proxy or a vendor API can get past it.
//   nse-archive 200             → the static CDN serves us even if the API does
//                                 not, which is a route worth building on.
//   everything 403/000          → the scraping route is closed; buy the vendor feed.
//
// The URL list is fixed in code. Nothing here takes a caller-supplied address,
// so this cannot be used to make the server fetch arbitrary hosts.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const auth = req.headers.get("authorization") || "";
  const key = new URL(req.url).searchParams.get("key") || "";
  return auth === `Bearer ${secret}` || key === secret;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const today = new Date();
const ddmmyyyy = (d: Date): string =>
  `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
const yyyymmdd = (d: Date): string =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
const weekAgo = new Date(today.getTime() - 7 * 864e5);

interface Target {
  id: string;
  url: string;
  /** What a 200 here would tell us. */
  meaning: string;
  headers?: Record<string, string>;
}

const TARGETS: Target[] = [
  {
    id: "egress-ip",
    url: "https://api.ipify.org?format=json",
    meaning: "The public IP this deployment goes out from, which tells you the region and provider.",
  },
  {
    id: "nse-home",
    url: "https://www.nseindia.com/",
    meaning:
      "THE decisive one. 200 means NSE serves this IP and the problem is only its cookie handshake. 403 means the IP is refused outright.",
    headers: { Accept: "text/html,application/xhtml+xml" },
  },
  {
    id: "nse-api-pit",
    url: "https://www.nseindia.com/api/corporates-pit?index=equities&symbol=RELIANCE",
    meaning: "The structured insider feed itself, called cold with no session cookies.",
  },
  {
    id: "nse-archive",
    url: "https://nsearchives.nseindia.com/content/equities/EQUITY_L.csv",
    meaning:
      "NSE's static archive CDN. Often served where the API is not; if this answers, a file-based route exists.",
    headers: { Accept: "text/csv,*/*" },
  },
  {
    id: "bse-home",
    url: "https://www.bseindia.com/",
    meaning: "Same question as nse-home, for BSE.",
    headers: { Accept: "text/html,application/xhtml+xml" },
  },
  {
    id: "bse-api-ann",
    url: `https://api.bseindia.com/BseIndiaAPI/api/AnnGetData/w?pageno=1&strCat=-1&strPrevDate=${yyyymmdd(
      weekAgo
    )}&strScrip=500325&strSearch=P&strToDate=${yyyymmdd(today)}&strType=C`,
    meaning: "BSE's announcements feed, the current fallback source.",
    headers: {
      Referer: "https://www.bseindia.com/corporates/ann.html",
      Origin: "https://www.bseindia.com",
    },
  },
  {
    id: "bse-insider-page",
    url: `https://www.bseindia.com/corporates/Insider_Trading_new.aspx?expandable=0&flag=0&fdate=${ddmmyyyy(
      weekAgo
    )}&tdate=${ddmmyyyy(today)}`,
    meaning: "BSE's insider-trading HTML page, as a non-API route to the same filings.",
    headers: { Accept: "text/html,application/xhtml+xml" },
  },
  {
    id: "sebi-home",
    url: "https://www.sebi.gov.in/",
    meaning: "Whether the regulator's own site is reachable at all.",
    headers: { Accept: "text/html,application/xhtml+xml" },
  },
];

async function probe(t: Target) {
  const started = Date.now();
  try {
    const res = await fetch(t.url, {
      headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9", ...(t.headers ?? {}) },
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
      redirect: "follow",
    });
    const body = await res.text().catch(() => "");
    return {
      id: t.id,
      status: res.status,
      ok: res.ok,
      ms: Date.now() - started,
      contentType: res.headers.get("content-type") ?? null,
      bytes: body.length,
      // Enough to tell a real payload from a block page, without dumping a
      // whole document into the response.
      snippet: body.slice(0, 220).replace(/\s+/g, " ").trim(),
      meaning: t.meaning,
    };
  } catch (e) {
    return {
      id: t.id,
      status: null,
      ok: false,
      ms: Date.now() - started,
      contentType: null,
      bytes: 0,
      snippet: `threw: ${String(e).slice(0, 160)}`,
      meaning: t.meaning,
    };
  }
}

export async function GET(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const results = await Promise.all(TARGETS.map(probe));

  const byId = Object.fromEntries(results.map((r) => [r.id, r]));
  const verdict: string[] = [];
  const home = byId["nse-home"];
  const api = byId["nse-api-pit"];
  const archive = byId["nse-archive"];

  if (home?.ok && !api?.ok) {
    verdict.push(
      "NSE serves this IP but refuses the API cold. The blocker is the cookie handshake, not the address. A session-aware fetch from this deployment can work without any proxy."
    );
  } else if (home && !home.ok) {
    verdict.push(
      "NSE refuses this IP outright. No amount of session handling fixes that; it needs a residential proxy or a vendor feed."
    );
  }
  if (archive?.ok) {
    verdict.push(
      "NSE's static archive answers this deployment, so a file-based route to exchange data exists even if the API stays closed."
    );
  }
  if (results.filter((r) => r.id !== "egress-ip").every((r) => !r.ok)) {
    verdict.push(
      "Nothing Indian answers this deployment at all. The scraping route is closed from here; a vendor API is the only path."
    );
  }
  if (!verdict.length) verdict.push("Mixed results. Read the individual probes below.");

  return NextResponse.json({ ok: true, verdict, results });
}
