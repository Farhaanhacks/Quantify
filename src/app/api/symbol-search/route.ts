import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

// Map a Yahoo symbol's exchange suffix (and, as a fallback, the exchange code)
// to a country flag so users can eyeball the right listing — e.g. TRENT.NS 🇮🇳
// vs SVT.L 🇬🇧. US symbols carry no suffix, so they default to 🇺🇸.
const SUFFIX_FLAG: Record<string, string> = {
  NS: "🇮🇳", BO: "🇮🇳", L: "🇬🇧", TO: "🇨🇦", V: "🇨🇦", AX: "🇦🇺", NZ: "🇳🇿",
  DE: "🇩🇪", F: "🇩🇪", PA: "🇫🇷", AS: "🇳🇱", BR: "🇧🇪", MI: "🇮🇹", MC: "🇪🇸",
  SW: "🇨🇭", ST: "🇸🇪", OL: "🇳🇴", CO: "🇩🇰", HE: "🇫🇮", LS: "🇵🇹", VI: "🇦🇹",
  IR: "🇮🇪", HK: "🇭🇰", T: "🇯🇵", SS: "🇨🇳", SZ: "🇨🇳", KS: "🇰🇷", KQ: "🇰🇷",
  TW: "🇹🇼", TWO: "🇹🇼", SI: "🇸🇬", KL: "🇲🇾", BK: "🇹🇭", JK: "🇮🇩", SA: "🇧🇷",
  MX: "🇲🇽", BA: "🇦🇷", SR: "🇸🇦", TA: "🇮🇱", IS: "🇹🇷", CA: "🇪🇬", JO: "🇿🇦",
};

function flagFor(symbol: string): string {
  const dot = symbol.lastIndexOf(".");
  if (dot === -1) return "🇺🇸"; // no suffix → US listing
  const suffix = symbol.slice(dot + 1).toUpperCase();
  return SUFFIX_FLAG[suffix] ?? "🌐";
}

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (q.length < 1) return NextResponse.json({ results: [] });

  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        q
      )}&quotesCount=12&newsCount=0&enableFuzzyQuery=false`,
      { headers: { "User-Agent": UA }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(7000) }
    );
    if (!r.ok) return NextResponse.json({ results: [] });
    const j = (await r.json()) as { quotes?: Record<string, unknown>[] };

    const results = (j?.quotes ?? [])
      .map((quote) => {
        const symbol = str(quote.symbol);
        if (!symbol) return null;
        const name = str(quote.shortname) ?? str(quote.longname) ?? symbol;
        const type = str(quote.typeDisp) ?? str(quote.quoteType) ?? "";
        const exchange = str(quote.exchDisp) ?? str(quote.exchange) ?? "";
        return { symbol, name, type, exchange, flag: flagFor(symbol) };
      })
      .filter(
        (x): x is { symbol: string; name: string; type: string; exchange: string; flag: string } =>
          // Keep tradable equities/ETFs/funds/indices; drop options, futures, currencies.
          !!x && /equity|etf|fund|index/i.test(x.type || "")
      )
      .slice(0, 8);

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
