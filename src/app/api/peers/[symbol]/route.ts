import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Related symbols (competitors for a stock, similar funds for an ETF) via
// Yahoo's keyless recommendations endpoint — no cookie/crumb required.
export async function GET(
  _req: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol.toUpperCase();
  try {
    const url = `https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/${encodeURIComponent(
      symbol
    )}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return NextResponse.json({ peers: [] });
    const json = (await res.json()) as {
      finance?: { result?: { recommendedSymbols?: { symbol?: string }[] }[] };
    };
    const rec = json?.finance?.result?.[0]?.recommendedSymbols ?? [];
    const peers = rec
      .map((r) => String(r.symbol ?? "").toUpperCase())
      .filter((s) => s && s !== symbol)
      .slice(0, 6);
    return NextResponse.json({ peers });
  } catch {
    return NextResponse.json({ peers: [] });
  }
}
