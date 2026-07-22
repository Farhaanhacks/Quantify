// NSE structured insider trading (SEBI PIT Regulation 7) — richer than BSE's
// headline-only announcements. NSE's "corporates-pit" endpoint returns
// per-transaction rows: the acquirer, their category (Promoter / Designated
// Person…), the security type, the NUMBER of securities acquired/disposed, the
// value, and the transaction type (Buy/Sell) — the same shape screener.in shows.
//
// Like BSE, NSE blocks datacenter IPs and additionally gates its API behind a
// cookie handshake (load a page first so NSE sets cookies, then call the API with
// them). We route through ScraperAPI with a stable session_number so the warm-up
// request's cookies carry into the API request. The handshake is not 100%
// reliable through a rotating proxy — it succeeds for some requests and not
// others (which reads as "works for big names, not smaller ones" purely because
// of which sessions happened to land) — so we RETRY with a fresh session when the
// first attempt comes back empty or unauthorised. Everything is defensive: any
// failure yields an empty list (+ a debug reason) and the caller falls back to
// BSE — never fabricated data.

import type { IndiaDisclosure } from "@/lib/insiderIndia";

export interface NSEDebug {
  source: "nse";
  symbol: string;
  attempts: number; // how many session attempts it took
  httpStatus: number | null;
  rawCount: number;
  keptCount: number;
  snippet?: string;
  note?: string;
}

const NSE_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  Referer: "https://www.nseindia.com/companies-listing/corporate-filings-insider-trading",
};

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === "object" && v !== null;
const str = (v: unknown): string =>
  typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "";
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const scraperKey = (): string => (process.env.SCRAPER_API_KEY || "").trim();
const usingProxy = (): boolean => scraperKey().length > 0;

// ScraperAPI wrapper. session_number keeps cookies across the warm-up + API call
// (NSE won't serve the API without the cookies its pages set). Same premium/ultra
// knobs as the BSE path.
function proxied(url: string, session?: number, render = false): string {
  const key = scraperKey();
  if (!key) return url;
  const p = new URLSearchParams({ api_key: key, url });
  p.set("keep_headers", "true");
  if (process.env.SCRAPER_PREMIUM !== "0") p.set("premium", "true");
  if (process.env.SCRAPER_ULTRA === "1") p.set("ultra_premium", "true");
  if (session != null) p.set("session_number", String(session));
  // render=true runs a headless browser that executes NSE's JavaScript and sets
  // the cookies its API demands. This is the fix for the silent "200 with an empty
  // array" response — a plain GET doesn't fully establish NSE's cookies, so the
  // API returns no rows even for stocks that clearly have filings (e.g. NMDC).
  // Used on the warm-up page; the JSON API call reuses the session's cookies.
  if (render) p.set("render", "true");
  const country = process.env.SCRAPER_COUNTRY;
  if (country) p.set("country_code", country);
  return `https://api.scraperapi.com/?${p.toString()}`;
}

async function nseFetch(
  url: string,
  session: number,
  timeoutMs = usingProxy() ? 12000 : 8000,
  render = false
): Promise<{ status: number | null; json: unknown; snippet?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(proxied(url, session, render), {
      headers: NSE_HEADERS,
      signal: ctrl.signal,
      next: { revalidate: 1800 },
    });
    const text = await res.text().catch(() => "");
    if (!res.ok) return { status: res.status, json: null, snippet: text.slice(0, 200) };
    let json: unknown = null;
    try {
      json = JSON.parse(text);
      if (typeof json === "string") json = JSON.parse(json);
    } catch {
      json = null;
    }
    const usable = json != null && typeof json === "object";
    return { status: res.status, json, snippet: usable ? undefined : text.slice(0, 200) || "empty-body" };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return { status: null, json: null, snippet: aborted ? "timeout" : undefined };
  } finally {
    clearTimeout(timer);
  }
}

const nseSymbol = (ticker: string): string =>
  ticker.toUpperCase().replace(/\.(NS|BO)$/i, "").trim();

// NSE's PIT API wants dates as DD-MM-YYYY.
const ddmmyyyy = (d: Date): string =>
  `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;

// NSE dates come as "05-Jul-2026 15:30:00" or ISO — normalise to YYYY-MM-DD.
function normDate(s: string): string {
  const t = Date.parse(s);
  if (isFinite(t)) return new Date(t).toISOString().slice(0, 10);
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : s.slice(0, 10);
}

// Parse one NSE PIT row into a disclosure. Each row carries its own `symbol`, so
// this works for both the per-symbol API and the market-wide feed.
function pitRowToDisclosure(
  row: unknown,
  fallbackTicker?: string
): { symbol: string; disc: IndiaDisclosure } | null {
  if (!isRec(row)) return null;
  const sym = str(row.symbol) || (fallbackTicker ? nseSymbol(fallbackTicker) : "");
  if (!sym) return null;
  const acq = str(row.acqName);
  const cat = str(row.personCategory);
  const tx = str(row.tdpTransactionType) || str(row.acqMode);
  const secType = str(row.secType) || "shares";
  const secAcq = str(row.secAcq);
  const secVal = str(row.secVal);
  const date = normDate(
    str(row.date) || str(row.anexDate) || str(row.acqfromDt) || str(row.besdate)
  );
  // Human headline that carries the real numbers, e.g.
  // "Nandan M. Nilekani · Promoter · Buy · 6,400 Equity Shares · ₹…".
  const parts = [acq, cat, tx, secAcq ? `${secAcq} ${secType}` : "", secVal ? `₹${secVal}` : ""].filter(Boolean);
  const xbrl = str(row.xbrl);
  // Stable id from content so re-ingesting the same filing dedupes cleanly.
  const id = `nse-${sym}-${date}-${acq.slice(0, 10)}-${secAcq}-${tx}`.replace(/\s+/g, "");
  const disc: IndiaDisclosure = {
    id,
    ticker: `${sym}.NS`,
    company: str(row.company) || sym,
    headline: parts.join(" · ") || "Insider / SAST disclosure",
    category: cat || "Insider Trading (PIT Reg 7)",
    date,
    url: /^https?:\/\//.test(xbrl) ? xbrl : undefined,
  };
  return { symbol: sym, disc };
}

// One session attempt: warm up cookies, then hit the PIT API. Returns the parsed
// rows plus the raw status so the caller can decide whether to retry.
async function attemptOnce(
  ticker: string,
  symbol: string,
  limit: number
): Promise<{ out: IndiaDisclosure[]; status: number | null; rawCount: number; snippet?: string }> {
  const session = Math.floor(Math.random() * 900000) + 100000;

  // 1) Warm up on the NSE HOMEPAGE with browser render — this is the exact
  //    handshake the working NSE libraries (NseIndiaApi, stock-nse-india) use:
  //    the homepage is where NSE's base cookies (nsit, nseappid) are set, and the
  //    JS render establishes them. Those cookies then authorise every /api call in
  //    the same session — the fix for the silent 200-with-empty-array.
  await nseFetch("https://www.nseindia.com/", session, usingProxy() ? 40000 : 8000, true).catch(
    () => undefined
  );

  // 2) The structured PIT API (endpoint is "corporates-pit"), DD-MM-YYYY range.
  const toD = new Date();
  const fromD = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
  const apiUrl =
    `https://www.nseindia.com/api/corporates-pit?index=equities&symbol=${encodeURIComponent(symbol)}` +
    `&from_date=${ddmmyyyy(fromD)}&to_date=${ddmmyyyy(toD)}`;

  const { status, json, snippet } = await nseFetch(apiUrl, session);
  const data: unknown[] = isRec(json) && Array.isArray(json.data) ? (json.data as unknown[]) : [];

  const out: IndiaDisclosure[] = [];
  for (const row of data) {
    const parsed = pitRowToDisclosure(row, ticker);
    if (!parsed) continue;
    out.push(parsed.disc);
    if (out.length >= limit) break;
  }
  return { out, status, rawCount: data.length, snippet };
}

// Market-wide PIT feed (no `symbol` param) — one call returns EVERY company's
// insider filings in the window. This is what the daily ingest cron uses: fetch
// once, bucket by symbol, store. Retries hard (off the user path) because NSE's
// cookie handshake is flaky through a rotating proxy.
export async function fetchNSEInsiderMarketWide(
  maxSessions = 3
): Promise<{
  bySymbol: Map<string, IndiaDisclosure[]>;
  sessions: number;
  status: number | null;
  rawCount: number;
  wonWith?: string;
  tried: { q: string; status: number | null; rows: number }[];
}> {
  const today = new Date();
  const win = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const base = "https://www.nseindia.com/api/corporates-pit?index=equities";
  // A market-wide query over a wide window comes back empty (too large), so probe
  // SHORT windows and a no-date "latest" variant. Widest useful first.
  const variants: { q: string; url: string }[] = [
    { q: "7d", url: `${base}&from_date=${ddmmyyyy(win(7))}&to_date=${ddmmyyyy(today)}` },
    { q: "3d", url: `${base}&from_date=${ddmmyyyy(win(3))}&to_date=${ddmmyyyy(today)}` },
    { q: "1d", url: `${base}&from_date=${ddmmyyyy(win(1))}&to_date=${ddmmyyyy(today)}` },
    { q: "latest(no-date)", url: base },
  ];

  const tried: { q: string; status: number | null; rows: number }[] = [];
  let status: number | null = null;

  for (let s = 0; s < maxSessions; s++) {
    const session = Math.floor(Math.random() * 900000) + 100000;
    // Warm up on the NSE HOMEPAGE with browser render (the handshake the working
    // NSE libraries use — base cookies live there). Off the user path, so the
    // extra render time is fine.
    await nseFetch("https://www.nseindia.com/", session, usingProxy() ? 40000 : 8000, true).catch(
      () => undefined
    );

    let sawAuthFail = false;
    for (const v of variants) {
      const res = await nseFetch(v.url, session, usingProxy() ? 22000 : 10000);
      status = res.status;
      const data: unknown[] =
        isRec(res.json) && Array.isArray(res.json.data) ? (res.json.data as unknown[]) : [];
      tried.push({ q: v.q, status: res.status, rows: data.length });

      if (data.length > 0) {
        const bySymbol = new Map<string, IndiaDisclosure[]>();
        for (const row of data) {
          const parsed = pitRowToDisclosure(row);
          if (!parsed) continue;
          const list = bySymbol.get(parsed.symbol) ?? [];
          list.push(parsed.disc);
          bySymbol.set(parsed.symbol, list);
        }
        return { bySymbol, sessions: s + 1, status, rawCount: data.length, wonWith: v.q, tried };
      }
      // A null/401/403 means the session (cookies) failed — a fresh session may
      // help, so stop trying variants on this one and re-warm. A clean 200-empty
      // is a query problem; move to the next variant.
      if (res.status == null || res.status === 401 || res.status === 403) {
        sawAuthFail = true;
        break;
      }
    }
    // Every variant returned a clean 200-empty → not a session issue; a new
    // session won't change the result, so stop.
    if (!sawAuthFail) break;
    await sleep(800);
  }

  return { bySymbol: new Map(), sessions: maxSessions, status, rawCount: 0, tried };
}

export async function getNSEInsiderWithDebug(
  ticker: string,
  limit = 20
): Promise<{ disclosures: IndiaDisclosure[]; debug: NSEDebug }> {
  const symbol = nseSymbol(ticker);
  const debug: NSEDebug = {
    source: "nse",
    symbol,
    attempts: 0,
    httpStatus: null,
    rawCount: 0,
    keptCount: 0,
  };

  // NSE's cookie handshake through a rotating proxy is flaky — a fresh session
  // often succeeds where the previous one returned 401/empty. Retry a couple of
  // times, adopting the first attempt that yields rows. We DON'T retry once we
  // have rows (success). Empty/401 → try a new session.
  // Render warm-up is slow (~40s) but reliable, so one attempt is enough and keeps
  // the whole call within the route's 60s budget (3 rendered attempts would blow it).
  const MAX = 1;
  try {
    for (let attempt = 1; attempt <= MAX; attempt++) {
      debug.attempts = attempt;
      const { out, status, rawCount, snippet } = await attemptOnce(ticker, symbol, limit);
      // Keep the freshest diagnostics.
      debug.httpStatus = status;
      debug.rawCount = rawCount;
      debug.keptCount = out.length;
      debug.snippet = snippet;

      if (out.length > 0) return { disclosures: out, debug };
      // A clean 200 with rows already returned above; a 200 with zero rows COULD
      // be a soft cookie failure, so we still retry (bounded) — small caps with
      // genuine activity were coming back empty on the first session. Back off a
      // touch so the next session isn't rejected for hammering.
      if (attempt < MAX) await sleep(600);
    }

    // Exhausted attempts with nothing.
    if (debug.httpStatus == null)
      debug.note =
        debug.snippet === "timeout"
          ? "NSE timed out through the proxy on every attempt."
          : "NSE did not respond (blocked or network error) on every attempt.";
    else if (debug.httpStatus >= 400)
      debug.note = `NSE returned HTTP ${debug.httpStatus} on every attempt (cookie handshake still failing or IP not accepted). See snippet.`;
    else
      debug.note = `NSE responded (HTTP ${debug.httpStatus}) but had no insider rows for ${symbol} across ${debug.attempts} sessions — likely a genuine empty window, or the symbol differs on NSE.`;
    return { disclosures: [], debug };
  } catch (err) {
    debug.note = `error: ${err instanceof Error ? err.message : "unknown"}`;
    return { disclosures: [], debug };
  }
}
