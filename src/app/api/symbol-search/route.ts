import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.trim() ? v.trim() : undefined;

export interface SearchHit {
  symbol: string;
  name: string;
  type: string;
  exchange: string;
  flag: string;
}

// Map a Yahoo symbol's exchange suffix to a country flag so users can eyeball the
// right listing — e.g. TRENT.NS 🇮🇳 vs SVT.L 🇬🇧. US symbols carry no suffix.
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
  return SUFFIX_FLAG[symbol.slice(dot + 1).toUpperCase()] ?? "🌐";
}

const isEquityType = (type: string) =>
  /equity|etf|fund|index|common|preferred|share|stock|dr\b/i.test(type || "");

// ─── EODHD search (primary when EODHD_API_KEY is set) ────────────────────────
// EODHD indexes company NAMES and exchange CODES (incl. BSE numeric scrip codes),
// so "mini" → Mini Diamonds India and "523373" → Mini Diamonds India both resolve
// — the coverage Yahoo's search lacks for Indian names. We convert EODHD's
// `Code`+`Exchange` into the Yahoo-style symbol (`.BO`/`.NS`/…) the rest of the
// app already speaks, so the chosen result stays navigable by /api/quote etc.
const EODHD_SUFFIX: Record<string, string> = {
  US: "", NYSE: "", NASDAQ: "", AMEX: "", BATS: "", NMFQS: "", OTC: "", OTCQB: "", OTCQX: "", PINK: "",
  BSE: ".BO", NSE: ".NS", LSE: ".L", TO: ".TO", V: ".V", AU: ".AX", NZ: ".NZ",
  TW: ".TW", TWO: ".TWO", KO: ".KS", KQ: ".KQ", SHG: ".SS", SHE: ".SZ", HK: ".HK",
  XETRA: ".DE", F: ".F", PA: ".PA", AS: ".AS", MI: ".MI", MC: ".MC", SW: ".SW", LU: ".LU",
  ST: ".ST", OL: ".OL", CO: ".CO", HE: ".HE", VI: ".VI", IR: ".IR", BR: ".BR", SA: ".SA",
};

const COUNTRY_FLAG: Record<string, string> = {
  USA: "🇺🇸", "United States": "🇺🇸", India: "🇮🇳", Taiwan: "🇹🇼",
  "South Korea": "🇰🇷", Korea: "🇰🇷", China: "🇨🇳", "Hong Kong": "🇭🇰",
  UK: "🇬🇧", "United Kingdom": "🇬🇧", Canada: "🇨🇦", Australia: "🇦🇺",
  Japan: "🇯🇵", Germany: "🇩🇪", France: "🇫🇷", Singapore: "🇸🇬", Brazil: "🇧🇷",
};

async function eodhdSearch(q: string, key: string): Promise<SearchHit[] | null> {
  try {
    const url = `https://eodhd.com/api/search/${encodeURIComponent(
      q
    )}?api_token=${encodeURIComponent(key)}&fmt=json&limit=15`;
    const r = await fetch(url, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(7000) });
    if (!r.ok) return null;
    const arr = (await r.json()) as Record<string, unknown>[];
    if (!Array.isArray(arr)) return null;

    const out: SearchHit[] = [];
    for (const it of arr) {
      const code = str(it.Code);
      const name = str(it.Name);
      if (!code || !name) continue;
      const type = str(it.Type) ?? "";
      if (!isEquityType(type)) continue;
      const exCode = (str(it.Exchange) ?? "").toUpperCase();
      const suffix = exCode in EODHD_SUFFIX ? EODHD_SUFFIX[exCode] : "";
      const symbol = `${code}${suffix}`;
      const country = str(it.Country) ?? "";
      out.push({
        symbol,
        name,
        type,
        exchange: str(it.Exchange) ?? "",
        flag: COUNTRY_FLAG[country] ?? flagFor(symbol),
      });
    }
    return out.slice(0, 8);
  } catch {
    return null;
  }
}

// ─── Yahoo fallback ──────────────────────────────────────────────────────────
async function yahooSearch(q: string): Promise<SearchHit[]> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        q
      )}&quotesCount=12&newsCount=0&enableFuzzyQuery=false`,
      { headers: { "User-Agent": UA }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(7000) }
    );
    if (!r.ok) return [];
    const j = (await r.json()) as { quotes?: Record<string, unknown>[] };
    return (j?.quotes ?? [])
      .map((quote): SearchHit | null => {
        const symbol = str(quote.symbol);
        if (!symbol) return null;
        const name = str(quote.shortname) ?? str(quote.longname) ?? symbol;
        const type = str(quote.typeDisp) ?? str(quote.quoteType) ?? "";
        const exchange = str(quote.exchDisp) ?? str(quote.exchange) ?? "";
        return { symbol, name, type, exchange, flag: flagFor(symbol) };
      })
      .filter((x): x is SearchHit => !!x && isEquityType(x.type))
      .slice(0, 8);
  } catch {
    return [];
  }
}

// Yahoo's SEARCH doesn't index bare BSE scrip codes, but its QUOTE endpoint does
// resolve `<code>.BO` to a name — so a user typing "523373" (or "BSE:523373")
// still finds the company even without EODHD.
async function resolveBseCode(code: string): Promise<SearchHit | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${code}.BO?range=1d&interval=1d`,
      { headers: { "User-Agent": UA }, next: { revalidate: 3600 }, signal: AbortSignal.timeout(6000) }
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { chart?: { result?: { meta?: Record<string, unknown> }[] } };
    const meta = j?.chart?.result?.[0]?.meta;
    const name = str(meta?.longName) ?? str(meta?.shortName);
    if (!name) return null;
    return { symbol: `${code}.BO`, name, type: "Equity", exchange: "BSE", flag: "🇮🇳" };
  } catch {
    return null;
  }
}

export async function GET(req: Request) {
  const raw = (new URL(req.url).searchParams.get("q") ?? "").trim();
  // Accept "BSE:523373" / "NSE:RELIANCE" / "NASDAQ:AAPL" — strip the exchange
  // prefix so both the code and the bare symbol resolve.
  const q = raw.replace(/^[A-Za-z]{2,6}:\s*/, "").trim();
  if (q.length < 1) return NextResponse.json({ results: [] });

  // 1) EODHD when configured — best name + code coverage (incl. Indian micro-caps).
  const key = process.env.EODHD_API_KEY;
  if (key) {
    const eod = await eodhdSearch(q, key);
    if (eod && eod.length) return NextResponse.json({ results: eod });
  }

  // 2) Yahoo search, plus a direct BSE-scrip-code resolution for all-numeric input.
  const numeric = /^\d{4,6}$/.test(q);
  const [yahoo, bse] = await Promise.all([
    yahooSearch(q),
    numeric ? resolveBseCode(q) : Promise.resolve(null),
  ]);

  const merged: SearchHit[] = [];
  const seen = new Set<string>();
  for (const hit of [...(bse ? [bse] : []), ...yahoo]) {
    if (seen.has(hit.symbol)) continue;
    seen.add(hit.symbol);
    merged.push(hit);
  }
  return NextResponse.json({ results: merged.slice(0, 8) });
}
