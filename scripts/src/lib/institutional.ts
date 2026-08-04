// Institutional ownership over time (quarterly 13F aggregates) from Financial
// Modeling Prep. Requires FMP_API_KEY. Yahoo only gives a current snapshot, so
// the quarterly history needs a dedicated source. Returns [] when no key or
// data — never fabricated.
//
// NOTE: FMP retired its legacy /api/v4 endpoints on 31 Aug 2025. We use the new
// "stable" API. The stable per-symbol summary returns one quarter per call
// (symbol + year + quarter), so we query the most recent completed quarters and
// stitch them into the history the UI charts.

const FMP_STABLE = "https://financialmodelingprep.com/stable";

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

// Most recent completed 13F quarters, newest → oldest. 13F filings land ~45 days
// after quarter-end, so the just-ended quarter usually isn't filed yet — step
// back one to start.
function recentQuarters(count: number): { year: number; quarter: number }[] {
  const now = new Date();
  let y = now.getUTCFullYear();
  let q = Math.floor(now.getUTCMonth() / 3) + 1;
  const stepBack = () => {
    q -= 1;
    if (q < 1) {
      q = 4;
      y -= 1;
    }
  };
  stepBack(); // current quarter not filed yet
  const out: { year: number; quarter: number }[] = [];
  for (let i = 0; i < count; i++) {
    out.push({ year: y, quarter: q });
    stepBack();
  }
  return out;
}

// Tolerant numeric read — FMP has shipped both `numberOf13Fshares` and
// `numberOf13FShares` casings across API versions.
function pick(row: Record<string, unknown>, ...keys: string[]): number {
  for (const k of keys) {
    const v = Number(row[k]);
    if (isFinite(v) && v !== 0) return v;
  }
  return 0;
}

async function fetchQuarter(
  symbol: string,
  year: number,
  quarter: number,
  key: string
): Promise<InstQuarter | null> {
  try {
    const r = await fetch(
      `${FMP_STABLE}/institutional-ownership/symbol-positions-summary?symbol=${encodeURIComponent(
        symbol
      )}&year=${year}&quarter=${quarter}&apikey=${key}`,
      { cache: "no-store", signal: AbortSignal.timeout(8000) }
    );
    if (!r.ok) return null;
    const j = (await r.json()) as unknown;
    const row = (Array.isArray(j) ? j[0] : j) as Record<string, unknown> | undefined;
    if (!row || typeof row !== "object") return null;

    const institutions = pick(row, "investorsHolding");
    const sharesHeld = pick(row, "numberOf13Fshares", "numberOf13FShares");
    if (sharesHeld <= 0 && institutions <= 0) return null;

    return {
      period: `${year} Q${quarter}`,
      date: String(row.date ?? `${year}-${String(quarter * 3).padStart(2, "0")}-01`),
      institutions,
      sharesHeld,
      ownershipPct: pick(row, "ownershipPercent"),
      sharesChange: pick(row, "numberOf13FsharesChange", "numberOf13FSharesChange"),
    };
  } catch {
    return null;
  }
}

export async function getInstitutionalHistory(symbol: string): Promise<InstQuarter[]> {
  const key = fmpKey();
  if (!key) return [];
  const quarters = recentQuarters(8);
  const rows = await Promise.all(quarters.map((qq) => fetchQuarter(symbol, qq.year, qq.quarter, key)));
  // Keep only quarters that returned data, newest → oldest, capped at 10.
  return rows.filter((x): x is InstQuarter => x != null).slice(0, 10);
}
