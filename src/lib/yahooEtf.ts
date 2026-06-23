// ETF / fund analysis — keyless via Yahoo Finance's quoteSummary endpoint, for
// personal non-commercial use. Stocks are scored on company fundamentals
// (yahooFundamentals.ts); ETFs have none, so we analyse them on what actually
// matters for a fund: what it holds, how concentrated it is, what it costs, how
// big/liquid it is, its income and its track record. Returns null for anything
// that isn't a fund so callers fall back to the company path.

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const num = (x: unknown): number | undefined => {
  if (typeof x === "number" && isFinite(x)) return x;
  if (x && typeof x === "object" && "raw" in x) {
    const raw = (x as { raw: unknown }).raw;
    if (typeof raw === "number" && isFinite(raw)) return raw;
  }
  return undefined;
};
const str = (x: unknown): string | undefined =>
  typeof x === "string" && x.length ? x : undefined;

export interface EtfHolding {
  symbol: string;
  name: string;
  weight: number; // fraction, e.g. 0.071
}

export interface EtfSectorWeight {
  sector: string; // display label
  weight: number; // fraction
}

export interface EtfRatingAxis {
  key: "cost" | "diversification" | "size" | "momentum" | "income";
  label: string;
  score: number; // 0..6
  detail: string;
}

export interface EtfData {
  symbol: string;
  name: string;
  kind: "ETF" | "Mutual fund";
  category?: string;
  family?: string;
  currency?: string;
  price?: number;
  navPrice?: number;
  // economics
  expenseRatio?: number; // fraction, e.g. 0.0003
  yield?: number; // fraction
  totalAssets?: number; // AUM
  beta?: number;
  // performance (fractions)
  ytdReturn?: number;
  oneYearReturn?: number;
  threeYearReturn?: number;
  fiveYearReturn?: number;
  // composition
  topHoldings: EtfHolding[];
  topHoldingsWeight?: number; // sum of the listed holdings' weights
  sectorWeights: EtfSectorWeight[];
  stockPosition?: number; // fraction
  bondPosition?: number;
  cashPosition?: number;
  holdingsPE?: number;
  holdingsPB?: number;
  // verdict
  rating: EtfRatingAxis[];
  overall: number; // 0..30
  rewards: string[];
  riskFlags: string[];
}

// Yahoo's sector keys → human labels.
const SECTOR_LABELS: Record<string, string> = {
  realestate: "Real Estate",
  consumer_cyclical: "Consumer Cyclical",
  basic_materials: "Basic Materials",
  consumer_defensive: "Consumer Defensive",
  technology: "Technology",
  communication_services: "Communication Services",
  financial_services: "Financial Services",
  utilities: "Utilities",
  industrials: "Industrials",
  energy: "Energy",
  healthcare: "Healthcare",
};

async function getCrumb(): Promise<{ crumb: string; cookie: string } | null> {
  try {
    const r1 = await fetch("https://fc.yahoo.com/", { headers: { "User-Agent": UA } });
    const cookie = (r1.headers.get("set-cookie") ?? "").split(";")[0];
    if (!cookie) return null;
    const r2 = await fetch("https://query2.finance.yahoo.com/v1/test/getcrumb", {
      headers: { "User-Agent": UA, Cookie: cookie, Accept: "text/plain" },
    });
    const crumb = (await r2.text()).trim();
    if (!crumb || crumb.length > 40 || crumb.includes("<")) return null;
    return { crumb, cookie };
  } catch {
    return null;
  }
}

// ── scoring helpers ───────────────────────────────────────────────────────────
// Each axis returns 0..6 so it slots straight into the existing 5-axis snowflake
// (ScoreRadar) used for stocks, giving ETFs a parallel, familiar read-out.

function bucket(v: number | undefined, steps: [number, number][], fallback = 0): number {
  if (v == null || !isFinite(v)) return fallback;
  for (const [threshold, score] of steps) if (v >= threshold) return score;
  return 0;
}

const pct = (x: number | undefined): string => (x == null ? "n/a" : `${(x * 100).toFixed(2)}%`);
const pct1 = (x: number | undefined): string => (x == null ? "n/a" : `${(x * 100).toFixed(1)}%`);

function aum(n: number | undefined): string {
  if (n == null || n <= 0) return "n/a";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(1)}T`;
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toFixed(0)}`;
}

function buildRating(d: {
  expenseRatio?: number;
  topHoldingsWeight?: number;
  holdingsCount: number;
  totalAssets?: number;
  ytdReturn?: number;
  oneYearReturn?: number;
  threeYearReturn?: number;
  yield?: number;
}): { rating: EtfRatingAxis[]; overall: number } {
  // Cost — cheaper is better (lower expense ratio).
  const costScore =
    d.expenseRatio == null
      ? 3
      : d.expenseRatio <= 0.0005
      ? 6
      : d.expenseRatio <= 0.001
      ? 5
      : d.expenseRatio <= 0.002
      ? 4
      : d.expenseRatio <= 0.004
      ? 3
      : d.expenseRatio <= 0.0075
      ? 2
      : 1;

  // Diversification — lower concentration in the top holdings is better.
  const conc = d.topHoldingsWeight;
  const divScore =
    conc == null
      ? d.holdingsCount >= 8
        ? 4
        : 3
      : conc <= 0.2
      ? 6
      : conc <= 0.3
      ? 5
      : conc <= 0.45
      ? 4
      : conc <= 0.6
      ? 3
      : conc <= 0.75
      ? 2
      : 1;

  // Size & liquidity — larger AUM is harder to gap and cheaper to trade.
  const sizeScore = bucket(
    d.totalAssets,
    [
      [50e9, 6],
      [10e9, 5],
      [2e9, 4],
      [500e6, 3],
      [100e6, 2],
      [1, 1],
    ],
    3
  );

  // Momentum — blended track record across the windows we have.
  const rets = [d.ytdReturn, d.oneYearReturn, d.threeYearReturn].filter(
    (x): x is number => typeof x === "number" && isFinite(x)
  );
  const avgRet = rets.length ? rets.reduce((a, b) => a + b, 0) / rets.length : undefined;
  const momScore =
    avgRet == null
      ? 3
      : avgRet >= 0.2
      ? 6
      : avgRet >= 0.12
      ? 5
      : avgRet >= 0.06
      ? 4
      : avgRet >= 0
      ? 3
      : avgRet >= -0.1
      ? 2
      : 1;

  // Income — higher distribution yield scores higher.
  const y = d.yield;
  const incScore =
    y == null
      ? 1
      : y >= 0.04
      ? 6
      : y >= 0.03
      ? 5
      : y >= 0.02
      ? 4
      : y >= 0.01
      ? 3
      : y > 0
      ? 2
      : 1;

  const rating: EtfRatingAxis[] = [
    {
      key: "cost",
      label: "Cost",
      score: costScore,
      detail: d.expenseRatio == null ? "Expense ratio n/a" : `${pct(d.expenseRatio)} expense ratio`,
    },
    {
      key: "diversification",
      label: "Diversification",
      score: divScore,
      detail:
        conc == null
          ? `${d.holdingsCount} top holdings listed`
          : `Top holdings = ${pct1(conc)} of the fund`,
    },
    {
      key: "size",
      label: "Size & liquidity",
      score: sizeScore,
      detail: `${aum(d.totalAssets)} in assets`,
    },
    {
      key: "momentum",
      label: "Momentum",
      score: momScore,
      detail: avgRet == null ? "Track record n/a" : `${pct1(avgRet)} avg return`,
    },
    {
      key: "income",
      label: "Income",
      score: incScore,
      detail: y == null ? "No yield reported" : `${pct1(y)} yield`,
    },
  ];

  const overall = rating.reduce((s, a) => s + a.score, 0);
  return { rating, overall };
}

export async function getYahooEtf(input: string): Promise<EtfData | null> {
  const cc = await getCrumb();
  if (!cc) return null;

  const symbol = input.toUpperCase();
  const modules =
    "quoteType,price,summaryDetail,defaultKeyStatistics,topHoldings,fundProfile,fundPerformance";

  let result: Record<string, unknown> | undefined;
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
      symbol
    )}?modules=${modules}&crumb=${encodeURIComponent(cc.crumb)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Cookie: cc.cookie },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      quoteSummary?: { result?: Record<string, unknown>[] };
    };
    result = json?.quoteSummary?.result?.[0];
  } catch {
    return null;
  }
  if (!result) return null;

  const qt = (result.quoteType ?? {}) as Record<string, unknown>;
  const type = str(qt.quoteType);
  // Only funds get this treatment.
  if (type !== "ETF" && type !== "MUTUALFUND") return null;

  const pr = (result.price ?? {}) as Record<string, unknown>;
  const sd = (result.summaryDetail ?? {}) as Record<string, unknown>;
  const ks = (result.defaultKeyStatistics ?? {}) as Record<string, unknown>;
  const th = (result.topHoldings ?? {}) as Record<string, unknown>;
  const fp = (result.fundProfile ?? {}) as Record<string, unknown>;
  const perf = (result.fundPerformance ?? {}) as Record<string, unknown>;

  const name = str(pr.longName) ?? str(pr.shortName) ?? str(qt.longName) ?? symbol;

  // Holdings
  const holdRaw = Array.isArray(th.holdings) ? (th.holdings as Record<string, unknown>[]) : [];
  const topHoldings: EtfHolding[] = holdRaw
    .map((h) => ({
      symbol: str(h.symbol) ?? "",
      name: str(h.holdingName) ?? str(h.symbol) ?? "",
      weight: num(h.holdingPercent) ?? 0,
    }))
    .filter((h) => h.name)
    .slice(0, 12);
  const topHoldingsWeight = topHoldings.length
    ? topHoldings.reduce((s, h) => s + h.weight, 0)
    : undefined;

  // Sector weights
  const sectorRaw = Array.isArray(th.sectorWeightings)
    ? (th.sectorWeightings as Record<string, unknown>[])
    : [];
  const sectorWeights: EtfSectorWeight[] = sectorRaw
    .map((entry) => {
      const key = Object.keys(entry)[0];
      return {
        sector: SECTOR_LABELS[key] ?? key?.replace(/_/g, " ") ?? "",
        weight: num(entry[key]) ?? 0,
      };
    })
    .filter((s) => s.sector && s.weight > 0)
    .sort((a, b) => b.weight - a.weight);

  // Economics
  const feesObj = (fp.feesExpensesInvestment ?? {}) as Record<string, unknown>;
  const expenseRatio =
    num(feesObj.annualReportExpenseRatio) ?? num(ks.annualReportExpenseRatio);
  const fundYield = num(sd.yield) ?? num(ks.yield);
  const totalAssets = num(sd.totalAssets) ?? num(ks.totalAssets);
  const beta = num(sd.beta) ?? num(sd.beta3Year) ?? num(ks.beta3Year);

  // Performance — prefer fundPerformance.trailingReturns, fall back to keystats.
  const trailing = (perf.trailingReturns ?? {}) as Record<string, unknown>;
  const ytdReturn = num(trailing.ytd) ?? num(ks.ytdReturn) ?? num(sd.ytdReturn);
  const oneYearReturn = num(trailing.oneYear);
  const threeYearReturn = num(trailing.threeYear) ?? num(ks.threeYearAverageReturn);
  const fiveYearReturn = num(trailing.fiveYear) ?? num(ks.fiveYearAverageReturn);

  // Equity profile of the basket
  const eq = (th.equityHoldings ?? {}) as Record<string, unknown>;
  const holdingsPE = num(eq.priceToEarnings);
  const holdingsPB = num(eq.priceToBook);

  const stockPosition = num(th.stockPosition);
  const bondPosition = num(th.bondPosition);
  const cashPosition = num(th.cashPosition);

  const { rating, overall } = buildRating({
    expenseRatio,
    topHoldingsWeight,
    holdingsCount: topHoldings.length,
    totalAssets,
    ytdReturn,
    oneYearReturn,
    threeYearReturn,
    yield: fundYield,
  });

  // Plain-language rewards / flags
  const rewards: string[] = [];
  const riskFlags: string[] = [];
  if (expenseRatio != null && expenseRatio <= 0.001)
    rewards.push(`Very low cost — ${pct(expenseRatio)} expense ratio.`);
  if (totalAssets != null && totalAssets >= 10e9)
    rewards.push(`Large, liquid fund (${aum(totalAssets)} in assets).`);
  if (topHoldingsWeight != null && topHoldingsWeight <= 0.3)
    rewards.push("Broadly spread — no single holding dominates.");
  if (sectorWeights.length >= 6)
    rewards.push(`Diversified across ${sectorWeights.length} sectors.`);
  if (fundYield != null && fundYield >= 0.02)
    rewards.push(`Pays income (${pct1(fundYield)} yield).`);
  if ((oneYearReturn ?? ytdReturn ?? 0) > 0.1)
    rewards.push("Strong recent performance.");

  if (expenseRatio != null && expenseRatio >= 0.005)
    riskFlags.push(`Higher cost — ${pct(expenseRatio)} expense ratio eats returns over time.`);
  if (topHoldingsWeight != null && topHoldingsWeight >= 0.5)
    riskFlags.push(`Concentrated — the top holdings are ${pct1(topHoldingsWeight)} of the fund.`);
  if (sectorWeights.length && sectorWeights[0].weight >= 0.4)
    riskFlags.push(`Heavy tilt to ${sectorWeights[0].sector} (${pct1(sectorWeights[0].weight)}).`);
  if (totalAssets != null && totalAssets < 100e6)
    riskFlags.push("Small fund — thinner liquidity and higher closure risk.");
  if ((fundYield ?? 0) === 0)
    riskFlags.push("No income — returns rely entirely on price appreciation.");

  if (rewards.length === 0) rewards.push("No standout strengths in the available fund data.");
  if (riskFlags.length === 0) riskFlags.push("No major red flags in the available fund data.");

  return {
    symbol,
    name,
    kind: type === "ETF" ? "ETF" : "Mutual fund",
    category: str(fp.categoryName),
    family: str(fp.family),
    currency: str(pr.currency) ?? str(sd.currency),
    price: num(pr.regularMarketPrice) ?? num(sd.navPrice),
    navPrice: num(sd.navPrice),
    expenseRatio,
    yield: fundYield,
    totalAssets,
    beta,
    ytdReturn,
    oneYearReturn,
    threeYearReturn,
    fiveYearReturn,
    topHoldings,
    topHoldingsWeight,
    sectorWeights,
    stockPosition,
    bondPosition,
    cashPosition,
    holdingsPE,
    holdingsPB,
    rating,
    overall,
    rewards: rewards.slice(0, 5),
    riskFlags: riskFlags.slice(0, 5),
  };
}
