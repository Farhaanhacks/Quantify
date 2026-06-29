// Server-only. A polite HTTP fetcher for the data-ingestion layer: it sets a
// User-Agent, times out, and leans on Next's cache so we never hammer a source.
//
// RESPONSIBILITY: only point ingestion at sources you are permitted to use.
// Always check the target's robots.txt and Terms of Service first, and respect
// its rate limits. Public/official sources (SEC EDGAR, regulatory filings,
// company IR pages) are the safe default; most commercial finance sites forbid
// scraping and their data is licensed.

export interface PoliteFetchOptions {
  userAgent?: string;
  revalidateSeconds?: number;
  timeoutMs?: number;
  accept?: string;
}

export async function politeFetch(
  url: string,
  opts: PoliteFetchOptions = {}
): Promise<Response> {
  const { userAgent, revalidateSeconds = 3600, timeoutMs = 10000, accept } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      headers: {
        ...(userAgent ? { "User-Agent": userAgent } : {}),
        ...(accept ? { Accept: accept } : {}),
      },
      signal: controller.signal,
      next: { revalidate: revalidateSeconds },
    });
  } finally {
    clearTimeout(timer);
  }
}
