// Indian insider / SAST disclosures from BSE's official corporate-filings feed.
//
// Indian promoter/director "insider trading" disclosures under SEBI (PIT)
// Regulation 7 are published by BSE as filing ANNOUNCEMENTS — a headline, a
// category and the official filing PDF. So that's what we surface: real,
// source-linked disclosures, NOT fabricated share/price columns.
//
// Everything is wrapped defensively: any failure (BSE blocking our IP, endpoint
// drift, a timeout) yields an empty list and the UI shows an honest
// "not available", never invented data. Because BSE actively blocks datacenter
// IPs, this fetcher also returns a small DEBUG object so we can tell, from the
// live site, whether BSE responded at all (IP block) or responded but we
// filtered/parsed it wrong (fixable) — see /api/insider/<TICKER.NS>?debug=1.

export interface IndiaDisclosure {
  id: string;
  ticker: string;
  company: string;
  headline: string;
  category: string;
  date: string; // YYYY-MM-DD
  url?: string; // official BSE filing PDF
}

export interface IndiaDebug {
  via: string; // "scraperapi" (proxy active) | "direct" (no key set)
  premium: boolean; // residential proxies on (needed to beat BSE's datacenter block)
  escalated: boolean; // auto-retried on ultra_premium after a block
  scrip: string | null;
  httpStatus: number | null;
  topLevelKeys: string[];
  rawCount: number;
  keptCount: number;
  sampleCategories: string[];
  bodySnippet?: string; // first bytes of a non-OK response (key error vs BSE block vs timeout)
  bseUrl?: string; // exact BSE URL requested (open it directly from an Indian IP to ground-truth params)
  note?: string;
}

const BSE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.bseindia.com/corporates/ann.html",
  Origin: "https://www.bseindia.com",
};

// Stable BSE scrip codes for common large-caps, so the most-searched names work
// even when BSE's search endpoint blocks our IP. Public, fixed identifiers.
export const BSE_SCRIP: Record<string, string> = {
  RELIANCE: "500325", TCS: "532540", HDFCBANK: "500180", INFY: "500209",
  ICICIBANK: "532174", HINDUNILVR: "500696", SBIN: "500112", BHARTIARTL: "532454",
  ITC: "500875", KOTAKBANK: "500247", LT: "500510", BAJFINANCE: "500034",
  AXISBANK: "532215", ASIANPAINT: "500820", MARUTI: "532500", HCLTECH: "532281",
  SUNPHARMA: "524715", TITAN: "500114", WIPRO: "507685", ULTRACEMCO: "532538",
  NESTLEIND: "500790", TATAMOTORS: "500570", TATASTEEL: "500470", POWERGRID: "532898",
  NTPC: "532555", ADANIENT: "512599", ADANIPORTS: "532921", ONGC: "500312",
  COALINDIA: "533278", TECHM: "532755", MRF: "500290", BAJAJFINSV: "532978",
  ZOMATO: "543320", PAYTM: "543396", DMART: "540376", IRCTC: "542830",
  VEDL: "500295", DLF: "532868", SBICARD: "543066", "M&M": "500520",
};

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null;
const sleep = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));
const asStr = (v: unknown): string =>
  typeof v === "string" ? v : typeof v === "number" ? String(v) : "";
const pick = (o: Rec, ...keys: string[]): string => {
  for (const k of keys) {
    const v = asStr(o[k]).trim();
    if (v) return v;
  }
  return "";
};

// BSE blocks datacenter IPs (like Vercel's), so a live fetch from the server is
// refused. When SCRAPER_API_KEY is set we route the request through ScraperAPI
// from an Indian IP that BSE actually serves — same BSE endpoint and JSON, just
// delivered from an un-blocked address. Without the key we fetch directly (which
// works from a residential IP in dev, and degrades to the honest empty state in
// prod). Set the key in Vercel to turn the feature on.
// Trim defensively — a trailing space/newline pasted into the Vercel env var is
// the most common cause of a ScraperAPI 401 (invalid-key) response.
const scraperKey = (): string => (process.env.SCRAPER_API_KEY || "").trim();
export const usingProxy = (): boolean => scraperKey().length > 0;

// True when residential ("premium") ScraperAPI proxies are in use — on by
// default (see proxied()), since BSE blocks the datacenter IPs ScraperAPI uses
// by default. Exposed for the debug payload.
export const usingPremium = (): boolean =>
  usingProxy() && process.env.SCRAPER_PREMIUM !== "0";

function proxied(url: string, opts?: { ultra?: boolean }): string {
  const key = scraperKey();
  if (!key) return url;
  const p = new URLSearchParams({ api_key: key, url });
  // CRITICAL: ScraperAPI DROPS all custom request headers unless keep_headers is
  // set. BSE's JSON API refuses requests that don't carry its own Referer/Origin
  // (returns 403/empty), so without this the call silently comes back empty even
  // with a perfectly valid key — the single most likely cause of "no trades".
  p.set("keep_headers", "true");
  // BSE blocks datacenter IPs, which is ScraperAPI's DEFAULT proxy pool.
  // Residential ("premium") proxies are the documented way past that block, so
  // this is ON by default. Set SCRAPER_PREMIUM=0 to fall back to datacenter (and
  // save credits) only if you've confirmed BSE serves it.
  if (process.env.SCRAPER_PREMIUM !== "0") p.set("premium", "true");
  // ultra_premium is the toughest (and priciest) tier. We DON'T send it on every
  // call — instead we auto-escalate to it (opts.ultra) only after a normal
  // premium call is actually blocked, so credits are spent only when needed.
  // SCRAPER_ULTRA=1 forces it on always.
  if (opts?.ultra || process.env.SCRAPER_ULTRA === "1") p.set("ultra_premium", "true");
  // country_code (geotargeting) is a paid add-on — only send it if your plan
  // includes it. SCRAPER_COUNTRY=in pins to Indian exit IPs.
  const country = process.env.SCRAPER_COUNTRY;
  if (country) p.set("country_code", country);
  return `https://api.scraperapi.com/?${p.toString()}`;
}

// Fetch JSON and report the HTTP status so a block (403/401/5xx) is visible.
// On a non-OK response we also keep a short body snippet — that's what tells a
// ScraperAPI key error (401 "invalid api key") apart from a BSE block (403/upstream)
// apart from a plan limit, from the live ?debug=1 URL, without more round trips.
async function fetchStatus(
  url: string,
  timeoutMs = usingProxy() ? 18000 : 9000,
  opts?: { ultra?: boolean }
): Promise<{ status: number | null; json: unknown; bodySnippet?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(proxied(url, opts), {
      headers: BSE_HEADERS,
      signal: ctrl.signal,
      next: { revalidate: 1800 },
    });
    // Always read the body as TEXT first, then parse — so a 200 that isn't the
    // JSON we expect (an HTML block page, a wrapped/double-encoded string, an
    // error blob) is still visible via bodySnippet instead of silently becoming
    // an empty result. ScraperAPI sometimes returns the target body JSON-encoded
    // as a string, so we double-decode when the first parse yields a string.
    const text = await res.text().catch(() => "");
    if (!res.ok) return { status: res.status, json: null, bodySnippet: text.slice(0, 220) };

    let json: unknown = null;
    try {
      json = JSON.parse(text);
      if (typeof json === "string") json = JSON.parse(json);
    } catch {
      json = null;
    }
    // Keep a snippet whenever we didn't get a usable object/array back — that's
    // the case worth diagnosing (a 200 with rawCount 0 and no top-level keys).
    const usable = json != null && typeof json === "object";
    return {
      status: res.status,
      json,
      bodySnippet: usable ? undefined : text.slice(0, 220) || "empty-body",
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { status: null, json: null, bodySnippet: aborted ? "timeout" : undefined };
  } finally {
    clearTimeout(timer);
  }
}

const baseSymbol = (ticker: string): string =>
  ticker.toUpperCase().replace(/\.(NS|BO)$/i, "").trim();

async function resolveScripCode(ticker: string): Promise<string | null> {
  const sym = baseSymbol(ticker);
  if (/^\d{6}$/.test(sym)) return sym; // a ".BO" numeric code is the scrip code
  if (BSE_SCRIP[sym]) return BSE_SCRIP[sym];

  const { json } = await fetchStatus(
    `https://api.bseindia.com/BseIndiaAPI/api/PageInoutSearch/w?flag=&text=${encodeURIComponent(sym)}`
  );
  const arr: unknown[] = Array.isArray(json)
    ? json
    : isRec(json) && Array.isArray(json.Table)
    ? (json.Table as unknown[])
    : [];
  for (const row of arr) {
    if (!isRec(row)) continue;
    const code = pick(row, "scrip_cd", "SCRIP_CD", "Scrip_Cd", "scripcode", "SCRIPCD");
    if (/^\d{5,6}$/.test(code)) return code;
  }
  return null;
}

const ymd = (d: Date): string =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

const isInsiderRow = (cat: string, sub: string): boolean =>
  // PIT Reg 7 (insider) and SAST Reg 29/30 (substantial acquisition) — the two
  // categories BSE files promoter/designated-person dealings under.
  /insider|\bsast\b|prohibition of insider|reg(\.|ulation)?\s*(7|29|30)\b|pit\b|acquisition\s*\/\s*disposal|substantial acqui/i.test(
    `${cat} ${sub}`
  );

export async function getIndiaInsiderWithDebug(
  ticker: string,
  limit = 20
): Promise<{ disclosures: IndiaDisclosure[]; debug: IndiaDebug }> {
  const debug: IndiaDebug = {
    via: usingProxy() ? "scraperapi" : "direct",
    premium: usingPremium(),
    escalated: false,
    scrip: null,
    httpStatus: null,
    topLevelKeys: [],
    rawCount: 0,
    keptCount: 0,
    sampleCategories: [],
  };
  try {
    const scrip = await resolveScripCode(ticker);
    debug.scrip = scrip;
    if (!scrip) {
      debug.note = "Could not resolve a BSE scrip code for this symbol.";
      return { disclosures: [], debug };
    }

    const to = new Date();
    const out: IndiaDisclosure[] = [];
    const cats = new Set<string>();

    // BSE's AnnGetData answers "No Record Found!" for date windows it doesn't like
    // (an over-wide range is the usual culprit). Rather than hard-code one window
    // and hope, TRY a few — widest first — and adopt whichever actually returns
    // rows. BSE_WINDOW_DAYS forces a single window if you've confirmed one.
    const forced = Number(process.env.BSE_WINDOW_DAYS) || 0;
    const windows = forced > 0 ? [forced] : [180, 90, 30, 7];

    const PAGES = 3;
    const pageUrlFor = (page: number, days: number) => {
      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      return (
        `https://api.bseindia.com/BseIndiaAPI/api/AnnGetData/w?pageno=${page}&strCat=-1` +
        `&strPrevDate=${ymd(from)}&strScrip=${scrip}&strSearch=P&strToDate=${ymd(to)}&strType=C`
      );
    };
    // Echo the widest URL up front so it's always available to open from an Indian
    // IP for ground truth; overwritten with the winning window if one is found.
    debug.bseUrl = pageUrlFor(1, windows[0]);

    const blocked = (r: { status: number | null }) => r.status == null || r.status >= 400;
    const rowsFor = (json: unknown): unknown[] =>
      isRec(json) && Array.isArray(json.Table)
        ? (json.Table as unknown[])
        : Array.isArray(json)
        ? (json as unknown[])
        : [];

    // Fetch one URL, with the RIGHT recovery per failure kind:
    //   • 429 (ScraperAPI concurrency) → back off and retry the SAME request once.
    //   • 403 (a genuine IP block) → one ultra_premium retry (residential-heavy).
    // A TIMEOUT (status null) is NOT a block — escalating to the slower ultra tier
    // on a timeout is what blew the 60s budget, so we do NOT escalate on it.
    const fetchUrl = async (url: string, allowUltra: boolean) => {
      let r = await fetchStatus(url);
      if (r.status === 429) {
        await sleep(2500);
        r = await fetchStatus(url);
      } else if (allowUltra && r.status === 403 && usingProxy() && process.env.SCRAPER_ULTRA !== "1") {
        debug.escalated = true;
        const retry = await fetchStatus(url, undefined, { ultra: true });
        if (!blocked(retry)) r = retry;
      }
      return r;
    };

    // Pull insider/SAST rows out of one page's rows into `out`.
    const collect = (rows: unknown[], page: number) => {
      for (const r of rows) {
        if (!isRec(r)) continue;
        const cat = pick(r, "CATEGORYNAME", "Category", "NEWSCATEGORYNAME", "News_Category");
        const sub = pick(r, "NEWSSUB", "HEADLINE", "NEWS_SUB", "Headline", "NEWSSUBJECT");
        if (cat) cats.add(cat);
        if (!isInsiderRow(cat, sub)) continue;

        const dtRaw = pick(r, "NEWS_DT", "News_submission_dt", "DT_TM", "News_Dt", "NEWSDATE");
        const t = Date.parse(dtRaw);
        const date = isFinite(t) ? new Date(t).toISOString().slice(0, 10) : dtRaw.slice(0, 10);
        const att = pick(r, "ATTACHMENTNAME", "Attachment", "ATTACHMENT");
        const company = pick(r, "SLONGNAME", "Sname", "SNAME") || baseSymbol(ticker);

        out.push({
          id: pick(r, "NEWSID", "NEWS_ID") || `${scrip}-${page}-${out.length}`,
          ticker: ticker.toUpperCase(),
          company,
          headline: sub || cat || "Insider / SAST disclosure",
          category: cat || "Insider Trading / SAST",
          date,
          url: att
            ? `https://www.bseindia.com/xml-data/corpfiling/AttachLive/${att}`
            : undefined,
        });
        if (out.length >= limit) break;
      }
    };

    // 1) Probe windows (page 1) until one returns rows. Record diagnostics from
    //    the FIRST physical attempt so ?debug=1 always reflects a real call.
    let chosenDays = 0;
    let page1Rows: unknown[] = [];
    let firstCaptured = false;
    for (const days of windows) {
      const r = await fetchUrl(pageUrlFor(1, days), !firstCaptured);
      if (!firstCaptured) {
        firstCaptured = true;
        debug.httpStatus = r.status;
        debug.topLevelKeys = isRec(r.json) ? Object.keys(r.json) : [];
        if (r.bodySnippet) debug.bodySnippet = r.bodySnippet;
        debug.rawCount = rowsFor(r.json).length;
      }
      const rows = rowsFor(r.json);
      if (rows.length > 0) {
        chosenDays = days;
        page1Rows = rows;
        debug.bseUrl = pageUrlFor(1, days);
        debug.httpStatus = r.status;
        debug.topLevelKeys = isRec(r.json) ? Object.keys(r.json) : [];
        debug.bodySnippet = r.bodySnippet;
        debug.rawCount = rows.length;
        break;
      }
      // If the proxy timed out or hard-failed, stop probing — more windows will
      // just time out too and blow the function budget. BSE answering "No Record
      // Found!" (status 200) is fast, so we DO keep trying other windows there.
      if (r.status == null || r.status >= 500) break;
    }

    // 2) If a window worked, collect page 1 then walk further pages with it.
    if (chosenDays > 0) {
      collect(page1Rows, 1);
      for (let page = 2; page <= PAGES && out.length < limit; page++) {
        const r = await fetchUrl(pageUrlFor(page, chosenDays), false);
        const rows = rowsFor(r.json);
        if (rows.length === 0) break;
        collect(rows, page);
      }
    }

    debug.keptCount = out.length;
    debug.sampleCategories = Array.from(cats).slice(0, 12);
    if (out.length === 0 && debug.httpStatus == null)
      debug.note =
        debug.bodySnippet === "timeout"
          ? "The proxied BSE request timed out — try SCRAPER_PREMIUM (on) or raise the route maxDuration."
          : "BSE did not respond (blocked, or network unavailable from this host).";
    else if (out.length === 0 && debug.httpStatus === 429)
      debug.note =
        `ScraperAPI 429 — your plan's CONCURRENT-request limit was hit (requests are now ` +
        `sequential, so this usually means other traffic is using the same key at once, ` +
        `or the free plan allows only 1 concurrent thread). Upgrade the plan's concurrency ` +
        `or reduce simultaneous scans. See bodySnippet.`;
    else if (out.length === 0 && debug.httpStatus && debug.httpStatus >= 400)
      debug.note =
        `Upstream returned HTTP ${debug.httpStatus}. 401/403 with a ScraperAPI body ` +
        `usually means an invalid key or a plan that can't reach BSE (need premium/residential); ` +
        `a BSE 403 means the IP is still blocked. See bodySnippet.`;
    else if (out.length === 0 && /no record found/i.test(debug.bodySnippet ?? ""))
      debug.note =
        `PROXY WORKS — this is BSE's own "No Record Found!", not a block: the key, IP and scrip ` +
        `all resolve and BSE answers. We already tried multiple date windows (180/90/30/7d) and ` +
        `all came back empty, so it's a PARAMETER, not the window. Fastest fix: on bseindia.com/` +
        `corporates/ann.html filter for this company, open DevTools ▸ Network, and copy the ` +
        `AnnGetData request URL that returns data — that gives the exact params to match. ` +
        `(debug.bseUrl is the URL we send.)`;
    else if (out.length === 0 && debug.topLevelKeys.length === 0)
      debug.note =
        `HTTP ${debug.httpStatus} but the body was NOT the expected BSE JSON (no "Table"). See bodySnippet: ` +
        `if it starts with "<" it's an HTML block/challenge page from the proxy; if it's JSON in a different shape, we'll adjust the parser.`;
    else if (out.length === 0 && debug.rawCount === 0)
      debug.note =
        `BSE responded (HTTP ${debug.httpStatus}) with keys [${debug.topLevelKeys.join(", ")}] but an empty Table — no announcements for this scrip in the window.`;
    else if (out.length === 0)
      debug.note = `BSE returned ${debug.rawCount} announcements but none were insider/SAST in the window.`;
    return { disclosures: out, debug };
  } catch (err) {
    debug.note = `error: ${err instanceof Error ? err.message : "unknown"}`;
    return { disclosures: [], debug };
  }
}

// Thin wrapper for callers that only want the list.
export async function getIndiaInsiderDisclosures(
  ticker: string,
  limit = 20
): Promise<IndiaDisclosure[]> {
  return (await getIndiaInsiderWithDebug(ticker, limit)).disclosures;
}
