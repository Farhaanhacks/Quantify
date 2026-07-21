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
function proxied(url: string, session?: number): string {
  const key = scraperKey();
  if (!key) return url;
  const p = new URLSearchParams({ api_key: key, url });
  p.set("keep_headers", "true");
  if (process.env.SCRAPER_PREMIUM !== "0") p.set("premium", "true");
  if (process.env.SCRAPER_ULTRA === "1") p.set("ultra_premium", "true");
  if (session != null) p.set("session_number", String(session));
  const country = process.env.SCRAPER_COUNTRY;
  if (country) p.set("country_code", country);
  return `https://api.scraperapi.com/?${p.toString()}`;
}

async function nseFetch(
  url: string,
  session: number,
  timeoutMs = usingProxy() ? 12000 : 8000
): Promise<{ status: number | null; json: unknown; snippet?: string }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(proxied(url, session), {
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

// One session attempt: warm up cookies, then hit the PIT API. Returns the parsed
// rows plus the raw status so the caller can decide whether to retry.
async function attemptOnce(
  ticker: string,
  symbol: string,
  limit: number
): Promise<{ out: IndiaDisclosure[]; status: number | null; rawCount: number; snippet?: string }> {
  const session = Math.floor(Math.random() * 900000) + 100000;

  // 1) Warm up: load the insider-filings page so NSE issues its cookies into this
  //    session. Best-effort — we just want the Set-Cookie.
  await nseFetch(
    "https://www.nseindia.com/companies-listing/corporate-filings-insider-trading",
    session
  ).catch(() => undefined);

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
    if (!isRec(row)) continue;
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
    const headline = parts.join(" · ") || "Insider / SAST disclosure";
    const xbrl = str(row.xbrl);

    out.push({
      id: `nse-${symbol}-${out.length}`,
      ticker: ticker.toUpperCase(),
      company: str(row.company) || symbol,
      headline,
      category: cat || "Insider Trading (PIT Reg 7)",
      date,
      url: /^https?:\/\//.test(xbrl) ? xbrl : undefined,
    });
    if (out.length >= limit) break;
  }
  return { out, status, rawCount: data.length, snippet };
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
  const MAX = 3;
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
