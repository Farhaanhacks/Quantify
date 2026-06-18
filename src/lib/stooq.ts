// Stooq free end-of-day price history (keyless CSV). Used as a fallback price
// source when Yahoo is unavailable/rate-limited. Coverage is strongest for US
// names; Stooq symbols use a country suffix (US tickers => "aapl.us").

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

export interface StooqPoint {
  time: string; // YYYY-MM-DD
  value: number;
}

function stooqSymbol(sym: string): string {
  const s = sym.toLowerCase();
  if (s.includes(".")) return s; // already suffixed (e.g. .us/.uk); .ns is unsupported and will simply miss
  return `${s}.us`;
}

export async function getStooqSeries(
  symbol: string
): Promise<StooqPoint[] | null> {
  try {
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(
      stooqSymbol(symbol)
    )}&i=d`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.startsWith("<") || text.toLowerCase().includes("no data")) {
      return null;
    }
    const lines = text.trim().split("\n");
    if (lines.length < 2) return null; // header + at least one row

    const points: StooqPoint[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",");
      const date = cols[0];
      const close = Number(cols[4]);
      if (date && isFinite(close)) {
        points.push({ time: date, value: Number(close.toFixed(2)) });
      }
    }
    return points.length ? points : null;
  } catch {
    return null;
  }
}
