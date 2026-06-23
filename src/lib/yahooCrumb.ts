// Shared Yahoo Finance auth + fetch helpers. Yahoo's quoteSummary endpoint now
// requires a cookie + "crumb" handshake, and it rate-limits that handshake hard.
// Previously every lib (fundamentals, ETF, company) ran its OWN handshake on
// every request, so a single page load triggered 3 handshakes and routinely hit
// Yahoo's limiter — which surfaced to users as "Analysis not available" for
// perfectly valid stocks and ETFs.
//
// This module centralises it: one cached crumb (reused for ~10 min within a warm
// server instance), retries with backoff, multiple cookie/crumb hosts, and a
// quoteSummary helper that transparently refreshes the crumb and retries when
// Yahoo answers 401/403/429. Net effect: far fewer handshakes, far fewer false
// "not available" results. Keyless, for personal non-commercial use.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

interface Crumb {
  crumb: string;
  cookie: string;
}

let cached: (Crumb & { at: number }) | null = null;
let inflight: Promise<Crumb | null> | null = null;
const TTL_MS = 10 * 60 * 1000; // reuse a good crumb for 10 minutes

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// One handshake attempt. Yahoo's consent/cookie flow varies by region and host,
// so we try a couple of cookie sources and both query hosts before giving up.
async function handshake(): Promise<Crumb | null> {
  const cookieSources = ["https://fc.yahoo.com/", "https://finance.yahoo.com/"];
  for (const src of cookieSources) {
    let cookie = "";
    try {
      const r1 = await fetch(src, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(8000),
      });
      cookie = (r1.headers.get("set-cookie") ?? "").split(";")[0];
    } catch {
      continue;
    }
    if (!cookie) continue;

    for (const host of ["query2", "query1"]) {
      try {
        const r2 = await fetch(`https://${host}.finance.yahoo.com/v1/test/getcrumb`, {
          headers: { "User-Agent": UA, Cookie: cookie, Accept: "text/plain" },
          signal: AbortSignal.timeout(8000),
        });
        const crumb = (await r2.text()).trim();
        if (crumb && crumb.length <= 40 && !crumb.includes("<")) {
          return { crumb, cookie };
        }
      } catch {
        /* try next host */
      }
    }
  }
  return null;
}

// Get a usable crumb, preferring the cache. `force` skips the cache (used after
// an auth failure). Retries the handshake a few times with backoff, and as a
// last resort falls back to a stale cached crumb rather than failing outright.
export async function getYahooCrumb(force = false): Promise<Crumb | null> {
  if (!force && cached && Date.now() - cached.at < TTL_MS) {
    return { crumb: cached.crumb, cookie: cached.cookie };
  }
  // Collapse concurrent refreshes (a page hits score+etf+company at once).
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        const cc = await handshake();
        if (cc) {
          cached = { ...cc, at: Date.now() };
          return cc;
        }
        await sleep(300 * (attempt + 1));
      }
      // Stale-but-present beats nothing — Yahoo often still honours an old crumb.
      if (cached) return { crumb: cached.crumb, cookie: cached.cookie };
      return null;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export function invalidateYahooCrumb(): void {
  cached = null;
}

// Fetch one quoteSummary result with automatic crumb refresh + retry. Returns the
// first result object, or undefined if the symbol genuinely has nothing. Auth
// failures (401/403/429) transparently refresh the crumb and retry once.
export async function yahooQuoteSummary(
  symbol: string,
  modules: string,
  revalidate = 3600
): Promise<Record<string, unknown> | undefined> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const cc = await getYahooCrumb(attempt > 0);
    if (!cc) continue;
    try {
      const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
        symbol
      )}?modules=${modules}&crumb=${encodeURIComponent(cc.crumb)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Cookie: cc.cookie },
        next: { revalidate },
        signal: AbortSignal.timeout(9000),
      });
      if (res.status === 401 || res.status === 403 || res.status === 429) {
        invalidateYahooCrumb();
        continue; // refresh crumb and retry once
      }
      if (!res.ok) return undefined;
      const json = (await res.json()) as {
        quoteSummary?: { result?: Record<string, unknown>[] };
      };
      return json?.quoteSummary?.result?.[0];
    } catch {
      invalidateYahooCrumb();
    }
  }
  return undefined;
}

// Resolve a free-text symbol or company name to a real Yahoo symbol. Keyless
// search endpoint — no crumb required. "ADANIENT" -> "ADANIENT.NS".
export async function resolveYahooSymbol(
  input: string
): Promise<{ symbol: string; name?: string } | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        input
      )}&quotesCount=8&newsCount=0`,
      { headers: { "User-Agent": UA }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(7000) }
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { quotes?: Record<string, unknown>[] };
    const quotes = (j?.quotes ?? []).filter(
      (q) => typeof q.symbol === "string" && (q.symbol as string).length
    );
    if (!quotes.length) return null;
    const up = input.trim().toUpperCase();
    const exact = quotes.find((q) => (q.symbol as string).toUpperCase() === up);
    const pick = exact ?? quotes[0];
    const name =
      (typeof pick.shortname === "string" && pick.shortname) ||
      (typeof pick.longname === "string" && pick.longname) ||
      undefined;
    return { symbol: pick.symbol as string, name: name || undefined };
  } catch {
    return null;
  }
}
