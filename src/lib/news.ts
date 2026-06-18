import * as cheerio from "cheerio";
import { detectTickersServer } from "@/lib/tickerDetect";

export interface NewsArticle {
  title: string;
  link: string;
  source: string;
  published: string; // ISO
  publishedMs: number;
  summary: string;
  region: "US" | "India" | "Global";
  tickers?: string[];
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

interface Feed {
  url: string;
  source: string;
  region: NewsArticle["region"];
}

// Keyless RSS feeds. Google News search feeds are reliable and dense.
const FEEDS: Feed[] = [
  {
    url: "https://news.google.com/rss/search?q=stock%20market%20OR%20earnings%20OR%20nasdaq%20OR%20wall%20street&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    region: "US",
  },
  {
    url: "https://news.google.com/rss/search?q=sensex%20OR%20nifty%20OR%20NSE%20OR%20BSE%20OR%20indian%20stocks&hl=en-IN&gl=IN&ceid=IN:en",
    source: "Google News",
    region: "India",
  },
  {
    url: "https://news.google.com/rss/search?q=federal%20reserve%20OR%20inflation%20OR%20S%26P%20500%20OR%20bonds&hl=en-US&gl=US&ceid=US:en",
    source: "Google News",
    region: "US",
  },
  {
    url: "https://finance.yahoo.com/news/rssindex",
    source: "Yahoo Finance",
    region: "Global",
  },
  {
    url: "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    source: "CNBC",
    region: "US",
  },
];

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchFeed(feed: Feed): Promise<NewsArticle[]> {
  try {
    const res = await fetch(feed.url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 1800 },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const $ = cheerio.load(xml, { xmlMode: true });
    const out: NewsArticle[] = [];

    $("item").each((_, el) => {
      const $el = $(el);
      let title = stripHtml($el.find("title").first().text());
      const link = $el.find("link").first().text().trim();
      const pub = $el.find("pubDate").first().text().trim();
      const srcTag = $el.find("source").first().text().trim();
      const summary = stripHtml($el.find("description").first().text()).slice(0, 220);
      const source = srcTag || feed.source;

      // Google News appends " - Publisher" to titles.
      if (srcTag && title.endsWith(` - ${srcTag}`)) {
        title = title.slice(0, -(` - ${srcTag}`).length);
      }
      const ms = pub ? Date.parse(pub) : NaN;
      if (!title || !link) return;
      out.push({
        title,
        link,
        source,
        published: isFinite(ms) ? new Date(ms).toISOString() : new Date().toISOString(),
        publishedMs: isFinite(ms) ? ms : Date.now(),
        summary,
        region: feed.region,
      });
    });
    return out;
  } catch {
    return [];
  }
}

export async function getMarketNews(): Promise<NewsArticle[]> {
  const results = await Promise.all(FEEDS.map(fetchFeed));
  const all = results.flat();

  // Dedupe by normalized title, keep newest.
  const seen = new Map<string, NewsArticle>();
  for (const a of all) {
    const key = a.title.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 60);
    const existing = seen.get(key);
    if (!existing || a.publishedMs > existing.publishedMs) seen.set(key, a);
  }

  const top = Array.from(seen.values())
    .sort((a, b) => b.publishedMs - a.publishedMs)
    .slice(0, 60);

  // Detect mentioned stocks against the full universe (server-side).
  await Promise.all(
    top.map(async (a) => {
      try {
        a.tickers = await detectTickersServer(`${a.title} ${a.summary}`);
      } catch {
        a.tickers = [];
      }
    })
  );

  return top;
}
