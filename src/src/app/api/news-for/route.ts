import { NextResponse } from "next/server";
import { getCompanyNews } from "@/lib/news";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const STRIP =
  /\b(inc|incorporated|corp|corporation|ltd|limited|plc|co|company|holdings|group|the|class\s+[a-c])\b/gi;

// Resolve a company's display name from its ticker via Yahoo (same source as
// the quote endpoint), so we can build a focused news query.
async function resolveName(symbol: string): Promise<string | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
      symbol
    )}?range=1d&interval=1d`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(7000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      chart?: { result?: { meta?: Record<string, unknown> }[] };
    };
    const meta = json?.chart?.result?.[0]?.meta;
    const name =
      (typeof meta?.shortName === "string" && meta.shortName) ||
      (typeof meta?.longName === "string" && meta.longName) ||
      null;
    return name;
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const ticker = (searchParams.get("ticker") || "").toUpperCase().trim();
  let name = (searchParams.get("name") || "").trim();
  if (!ticker && !name) return NextResponse.json({ ok: false, articles: [] });

  if (!name && ticker) {
    name = (await resolveName(ticker)) || "";
  }

  const cleaned = name
    .replace(STRIP, "")
    .replace(/[.,&]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const query = cleaned ? `"${cleaned}" stock` : `${ticker} stock`;

  try {
    const articles = await getCompanyNews(query);
    return NextResponse.json({ ok: true, ticker, name: name || ticker, articles });
  } catch {
    return NextResponse.json({ ok: false, ticker, articles: [] });
  }
}
