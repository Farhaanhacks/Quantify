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
  scrip: string | null;
  httpStatus: number | null;
  topLevelKeys: string[];
  rawCount: number;
  keptCount: number;
  sampleCategories: string[];
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
const BSE_SCRIP: Record<string, string> = {
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

function proxied(url: string): string {
  const key = scraperKey();
  if (!key) return url;
  // country_code (geotargeting) is a PAID ScraperAPI feature — sending it on the
  // free plan can fail the request. Off by default (free plan works fine, since
  // ScraperAPI's default residential IPs usually get past BSE's datacenter
  // block). Set SCRAPER_COUNTRY=in only if your plan includes geotargeting.
  const country = process.env.SCRAPER_COUNTRY;
  const geo = country ? `&country_code=${encodeURIComponent(country)}` : "";
  return `https://api.scraperapi.com/?api_key=${key}${geo}&url=${encodeURIComponent(url)}`;
}

// Fetch JSON and report the HTTP status so a block (403/401/5xx) is visible.
async function fetchStatus(
  url: string,
  timeoutMs = usingProxy() ? 25000 : 9000
): Promise<{ status: number | null; json: unknown }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(proxied(url), {
      headers: BSE_HEADERS,
      signal: ctrl.signal,
      next: { revalidate: 1800 },
    });
    if (!res.ok) return { status: res.status, json: null };
    return { status: res.status, json: await res.json().catch(() => null) };
  } catch {
    return { status: null, json: null };
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
  /insider|sast|prohibition of insider|reg(\.|ulation)?\s*7|pit\b|acquisition\/disposal/i.test(
    `${cat} ${sub}`
  );

export async function getIndiaInsiderWithDebug(
  ticker: string,
  limit = 20
): Promise<{ disclosures: IndiaDisclosure[]; debug: IndiaDebug }> {
  const debug: IndiaDebug = {
    via: usingProxy() ? "scraperapi" : "direct",
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
    const from = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
    const out: IndiaDisclosure[] = [];
    const cats = new Set<string>();

    // Walk a few pages of announcements (they're paged newest-first, so the
    // insider filings may not be on page 1) until we have enough or run out.
    for (let page = 1; page <= 4 && out.length < limit; page++) {
      const url =
        `https://api.bseindia.com/BseIndiaAPI/api/AnnGetData/w?pageno=${page}&strCat=-1` +
        `&strPrevDate=${ymd(from)}&strScrip=${scrip}&strSearch=P&strToDate=${ymd(to)}&strType=C`;
      const { status, json } = await fetchStatus(url);
      if (page === 1) {
        debug.httpStatus = status;
        if (isRec(json)) debug.topLevelKeys = Object.keys(json);
      }
      const rows: unknown[] =
        isRec(json) && Array.isArray(json.Table)
          ? (json.Table as unknown[])
          : Array.isArray(json)
          ? (json as unknown[])
          : [];
      if (page === 1) debug.rawCount = rows.length;
      if (rows.length === 0) break;

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
    }

    debug.keptCount = out.length;
    debug.sampleCategories = Array.from(cats).slice(0, 12);
    if (out.length === 0 && debug.httpStatus == null)
      debug.note = "BSE did not respond (blocked, or network unavailable from this host).";
    else if (out.length === 0 && debug.rawCount === 0)
      debug.note = `BSE responded (HTTP ${debug.httpStatus}) but returned no announcements for this scrip.`;
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
