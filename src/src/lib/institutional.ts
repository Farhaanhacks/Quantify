// Institutional ownership over time (quarterly 13F aggregates) from Financial
// Modeling Prep. Requires FMP_API_KEY. Yahoo only gives a current snapshot, so
// the quarterly history needs a dedicated source. Returns [] when no key or
// data — never fabricated.

const FMP_V4 = "https://financialmodelingprep.com/api/v4";

function fmpKey(): string {
  return process.env.FMP_API_KEY || process.env.NEXT_PUBLIC_FMP_API_KEY || "";
}

export interface InstQuarter {
  period: string; // "2024 Q1"
  date: string;
  institutions: number;
  sharesHeld: number;
  ownershipPct: number; // %
  sharesChange: number;
}

function quarterLabel(d: string): string {
  const t = Date.parse(d);
  if (isNaN(t)) return d;
  const dt = new Date(t);
  return `${dt.getUTCFullYear()} Q${Math.floor(dt.getUTCMonth() / 3) + 1}`;
}

export async function getInstitutionalHistory(symbol: string): Promise<InstQuarter[]> {
  const key = fmpKey();
  if (!key) return [];
  try {
    const r = await fetch(
      `${FMP_V4}/institutional-ownership/symbol-ownership?symbol=${encodeURIComponent(symbol)}&includeCurrentQuarter=true&apikey=${key}`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return [];
    const j = (await r.json()) as Record<string, unknown>[];
    if (!Array.isArray(j)) return [];
    return j
      .map((row) => {
        const date = String(row.date ?? "");
        return {
          period: quarterLabel(date),
          date,
          institutions: Number(row.investorsHolding) || 0,
          sharesHeld: Number(row.numberOf13Fshares) || 0,
          ownershipPct: Number(row.ownershipPercent) || 0,
          sharesChange: Number(row.numberOf13FsharesChange) || 0,
        };
      })
      .filter((q) => q.sharesHeld > 0 || q.institutions > 0)
      .slice(0, 10);
  } catch {
    return [];
  }
}
