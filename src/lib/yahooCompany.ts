// Rich company data for the Stock Analysis page: symbol resolution, a full
// statistics/financials profile, and company-specific news — all keyless via
// Yahoo Finance's public endpoints, for personal non-commercial use. Every field
// is optional; callers render "n/a" when something is missing.
import { yahooQuoteSummary } from "@/lib/yahooCrumb";
import { parseOfficers, type Officer } from "@/lib/officers";

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
const dateOf = (x: unknown): string | undefined => {
  if (x && typeof x === "object" && "fmt" in x) {
    const f = (x as { fmt: unknown }).fmt;
    if (typeof f === "string") return f;
  }
  const n = num(x);
  return n ? new Date(n * 1000).toISOString().slice(0, 10) : undefined;
};

export interface FinRow {
  date?: string;
  values: Record<string, number | undefined>;
}

export interface CompanyNews {
  title: string;
  link: string;
  publisher?: string;
  time?: number;
}

export interface CompanyData {
  symbol: string;
  name?: string;
  description?: string;
  sector?: string;
  industry?: string;
  website?: string;
  employees?: number;
  country?: string;
  currency?: string; // price / quote currency (e.g. USD for an ADR)
  financialCurrency?: string; // currency the financial statements are reported in
  // price / overview
  price?: number;
  open?: number;
  previousClose?: number;
  dayLow?: number;
  dayHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyTwoWeekHigh?: number;
  fiftyDayAvg?: number;
  twoHundredDayAvg?: number;
  volume?: number;
  avgVolume?: number;
  beta?: number;
  marketCap?: number;
  enterpriseValue?: number;
  sharesOutstanding?: number;
  // valuation
  trailingPE?: number;
  forwardPE?: number;
  priceToSales?: number;
  priceToBook?: number;
  pegRatio?: number;
  evToRevenue?: number;
  evToEbitda?: number;
  // income (ttm)
  revenue?: number;
  grossProfit?: number;
  ebitda?: number;
  netIncome?: number;
  eps?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  // margins
  grossMargin?: number;
  operatingMargin?: number;
  profitMargin?: number;
  // position / efficiency
  currentRatio?: number;
  quickRatio?: number;
  debtToEquity?: number;
  totalCash?: number;
  totalDebt?: number;
  roe?: number;
  roa?: number;
  // cash flow
  operatingCashflow?: number;
  freeCashflow?: number;
  // dividends
  dividendRate?: number;
  dividendYield?: number;
  payoutRatio?: number;
  exDividendDate?: string;
  // analyst
  targetMean?: number;
  targetHigh?: number;
  targetLow?: number;
  recommendationKey?: string;
  numberOfAnalysts?: number;
  earningsDate?: string;
  // top fund / ETF holders of this stock
  topFundHolders?: { name: string; pctHeld?: number }[];
  // top institutional holders (BlackRock, Vanguard, …)
  topInstitutionalHolders?: { name: string; pctHeld?: number; value?: number }[];
  // ownership split
  ownership?: {
    institutionsPct?: number;
    insidersPct?: number;
    institutionsFloatPct?: number;
    institutionsCount?: number;
  };
  // statements (most recent periods first)
  incomeStatements?: FinRow[];
  balanceSheets?: FinRow[];
  cashflowStatements?: FinRow[];
  // news
  news?: CompanyNews[];
  // Named executives, from Yahoo's assetProfile.
  officers?: Officer[];
  resolvedFrom?: string;
}

// Resolve a free-text symbol or company name to a real Yahoo symbol.
// "ADANIENT" -> "ADANIENT.NS", "Accenture" -> "ACN".
export async function resolveSymbol(
  input: string
): Promise<{ symbol: string; name?: string } | null> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        input
      )}&quotesCount=8&newsCount=0`,
      { headers: { "User-Agent": UA }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(7000) }
    );
    if (!r.ok) return null;
    const j = (await r.json()) as { quotes?: Record<string, unknown>[] };
    const quotes = (j?.quotes ?? []).filter((q) => str(q.symbol));
    if (!quotes.length) return null;
    const up = input.trim().toUpperCase();
    const exact = quotes.find((q) => str(q.symbol)?.toUpperCase() === up);
    const equity = quotes.find((q) => q.quoteType === "EQUITY");
    const pick = exact ?? equity ?? quotes[0];
    return { symbol: str(pick.symbol)!, name: str(pick.shortname) ?? str(pick.longname) };
  } catch {
    return null;
  }
}

async function fetchNews(symbol: string): Promise<CompanyNews[]> {
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(
        symbol
      )}&quotesCount=0&newsCount=10`,
      { headers: { "User-Agent": UA }, next: { revalidate: 1800 }, signal: AbortSignal.timeout(7000) }
    );
    if (!r.ok) return [];
    const j = (await r.json()) as { news?: Record<string, unknown>[] };
    return (j?.news ?? [])
      .map((n) => ({
        title: str(n.title) ?? "",
        link: str(n.link) ?? "",
        publisher: str(n.publisher),
        time: num(n.providerPublishTime),
      }))
      .filter((n) => n.title && n.link)
      .slice(0, 10);
  } catch {
    return [];
  }
}

// Yahoo deprecated the quoteSummary statement modules (they return dates but
// null values). The fundamentals-timeseries service is what actually serves
// financial statements now.
export async function getYahooStatements(
  symbol: string
): Promise<{ income: FinRow[]; balance: FinRow[]; cashflow: FinRow[] }> {
  const empty = { income: [], balance: [], cashflow: [] };
  try {
    const types = [
      "annualTotalRevenue", "annualGrossProfit", "annualOperatingIncome", "annualNetIncome",
      "annualTotalAssets", "annualTotalLiabilitiesNetMinorityInterest", "annualStockholdersEquity",
      "annualCashAndCashEquivalents", "annualLongTermDebt",
      "annualCurrentAssets", "annualCurrentLiabilities", "annualInventory",
      "annualOperatingCashFlow", "annualCapitalExpenditure", "annualFreeCashFlow",
    ];
    const now = Math.floor(Date.now() / 1000);
    const p1 = now - 6 * 365 * 24 * 3600;
    const url = `https://query2.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${encodeURIComponent(
      symbol
    )}?symbol=${encodeURIComponent(symbol)}&type=${types.join(",")}&period1=${p1}&period2=${now}&merge=false`;
    const res = await fetch(url, {
      headers: { "User-Agent": UA },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return empty;
    const json = (await res.json()) as { timeseries?: { result?: Record<string, unknown>[] } };
    const results = json?.timeseries?.result ?? [];

    const byDate = new Map<string, Record<string, number>>();
    for (const r of results) {
      const meta = r.meta as { type?: string[] } | undefined;
      const type = meta?.type?.[0];
      if (!type) continue;
      const arr = r[type] as Array<Record<string, unknown>> | undefined;
      if (!Array.isArray(arr)) continue;
      for (const pt of arr) {
        if (!pt) continue;
        const date = str(pt.asOfDate);
        const val = num(pt.reportedValue);
        if (!date || val == null) continue;
        if (!byDate.has(date)) byDate.set(date, {});
        byDate.get(date)![type] = val;
      }
    }
    const dates = Array.from(byDate.keys()).sort().reverse().slice(0, 4);
    const pick = (date: string, keys: Record<string, string>): FinRow => {
      const src = byDate.get(date) ?? {};
      const values: Record<string, number | undefined> = {};
      for (const k in keys) values[k] = src[keys[k]];
      return { date, values };
    };
    const balance = dates.map((d) => pick(d, {
      totalAssets: "annualTotalAssets", totalLiabilities: "annualTotalLiabilitiesNetMinorityInterest",
      totalEquity: "annualStockholdersEquity", cash: "annualCashAndCashEquivalents",
      // Total debt is the figure every debt-vs-equity read-out should use —
      // long-term borrowings alone understate a company that funds itself with
      // short-term paper. Yahoo publishes it directly; the two components are
      // kept so it can be reconstructed when the total line is missing.
      totalDebt: "annualTotalDebt",
      longTermDebt: "annualLongTermDebt",
      currentDebt: "annualCurrentDebt",
      currentAssets: "annualCurrentAssets", currentLiabilities: "annualCurrentLiabilities",
      inventory: "annualInventory",
    }));
    // Yahoo often omits the direct "total liabilities" line (it did for Alphabet),
    // so derive it from the accounting identity Assets = Liabilities + Equity when
    // the field is missing but assets and equity are present. A huge company can
    // never legitimately show "n/a" here.
    for (const row of balance) {
      if (row.values.totalLiabilities == null) {
        const a = row.values.totalAssets;
        const e = row.values.totalEquity;
        if (a != null && e != null) row.values.totalLiabilities = a - e;
      }
    }
    return {
      income: dates.map((d) => pick(d, {
        revenue: "annualTotalRevenue", grossProfit: "annualGrossProfit",
        operatingIncome: "annualOperatingIncome", netIncome: "annualNetIncome",
      })),
      balance,
      cashflow: dates.map((d) => pick(d, {
        operatingCashFlow: "annualOperatingCashFlow", capex: "annualCapitalExpenditure",
        freeCashFlow: "annualFreeCashFlow",
      })),
    };
  } catch {
    return empty;
  }
}

export async function getYahooCompany(input: string): Promise<CompanyData | null> {
  // recommendationTrend carries the analyst vote DISTRIBUTION (strongBuy/buy/
  // hold/sell/strongSell counts). Yahoo populates it for many non-US listings
  // where financialData has no recommendationKey at all — which is why the
  // Analyst Rating card read "No analyst rating available" for names that do
  // have coverage. earningsTrend gives us a next-earnings date fallback.
  const modules =
    "assetProfile,summaryDetail,defaultKeyStatistics,financialData,price,calendarEvents,recommendationTrend,earningsTrend,fundOwnership,institutionOwnership,majorHoldersBreakdown";

  let symbol = input.toUpperCase();
  let resolvedFrom: string | undefined;
  let result = await yahooQuoteSummary(symbol, modules);

  // If nothing came back, resolve the name/symbol and retry.
  if (!result) {
    const resolved = await resolveSymbol(input);
    if (resolved && resolved.symbol.toUpperCase() !== symbol) {
      resolvedFrom = symbol;
      symbol = resolved.symbol.toUpperCase();
      result = await yahooQuoteSummary(symbol, modules);
    }
  }
  if (!result) return null;

  const ap = (result.assetProfile ?? {}) as Record<string, unknown>;
  const sd = (result.summaryDetail ?? {}) as Record<string, unknown>;
  const ks = (result.defaultKeyStatistics ?? {}) as Record<string, unknown>;
  const fd = (result.financialData ?? {}) as Record<string, unknown>;
  const pr = (result.price ?? {}) as Record<string, unknown>;
  const ce = (result.calendarEvents ?? {}) as Record<string, unknown>;

  const earningsObj = (ce.earnings ?? {}) as Record<string, unknown>;
  const earningsArr = (earningsObj.earningsDate ?? []) as unknown[];

  // ── Analyst coverage, derived rather than assumed ────────────────────────
  // financialData.recommendationKey is US-centric and frequently absent abroad.
  // When it's missing, rebuild the same verdict from the recommendationTrend
  // vote counts: weight each bucket 1..5 and map the mean back onto a key. This
  // is exactly how the key is defined, so the two paths agree where both exist.
  const rt = (result.recommendationTrend ?? {}) as Record<string, unknown>;
  const rtRows = (rt.trend ?? []) as Record<string, unknown>[];
  // "0m" is the current month; fall back to the first row Yahoo returns.
  const rtRow = rtRows.find((r) => str(r.period) === "0m") ?? rtRows[0];
  const votes = {
    strongBuy: num(rtRow?.strongBuy) ?? 0,
    buy: num(rtRow?.buy) ?? 0,
    hold: num(rtRow?.hold) ?? 0,
    sell: num(rtRow?.sell) ?? 0,
    strongSell: num(rtRow?.strongSell) ?? 0,
  };
  const voteCount =
    votes.strongBuy + votes.buy + votes.hold + votes.sell + votes.strongSell;
  const meanVote =
    voteCount > 0
      ? (votes.strongBuy * 1 + votes.buy * 2 + votes.hold * 3 + votes.sell * 4 + votes.strongSell * 5) /
        voteCount
      : undefined;
  const keyFromVotes =
    meanVote == null
      ? undefined
      : meanVote <= 1.5
      ? "strong_buy"
      : meanVote <= 2.5
      ? "buy"
      : meanVote <= 3.5
      ? "hold"
      : meanVote <= 4.5
      ? "underperform"
      : "sell";

  // Next earnings: calendarEvents first, then earningsTrend's period end date.
  const etRows = ((result.earningsTrend ?? {}) as Record<string, unknown>).trend as
    | Record<string, unknown>[]
    | undefined;
  const etDate = etRows?.find((r) => str(r.period) === "0q")?.endDate;

  // Top fund / ETF holders of this stock (Yahoo's fundOwnership module).
  const fo = (result.fundOwnership ?? {}) as Record<string, unknown>;
  const foList = (fo.ownershipList ?? []) as Record<string, unknown>[];
  const topFundHolders = foList
    .map((o) => ({ name: str(o.organization), pctHeld: num(o.pctHeld) }))
    .filter((o) => Boolean(o.name))
    .map((o) => ({ name: o.name as string, pctHeld: o.pctHeld }))
    .slice(0, 6);

  // Top institutional holders (institutionOwnership) + ownership split (majorHoldersBreakdown).
  const io = (result.institutionOwnership ?? {}) as Record<string, unknown>;
  const ioList = (io.ownershipList ?? []) as Record<string, unknown>[];
  const topInstitutionalHolders = ioList
    .map((o) => ({ name: str(o.organization), pctHeld: num(o.pctHeld), value: num(o.value) }))
    .filter((o) => Boolean(o.name))
    .map((o) => ({ name: o.name as string, pctHeld: o.pctHeld, value: o.value }))
    .slice(0, 6);

  const mhb = (result.majorHoldersBreakdown ?? {}) as Record<string, unknown>;
  const ownership = {
    institutionsPct: num(mhb.institutionsPercentHeld),
    insidersPct: num(mhb.insidersPercentHeld),
    institutionsFloatPct: num(mhb.institutionsFloatPercentHeld),
    institutionsCount: num(mhb.institutionsCount),
  };

  const stmts = await getYahooStatements(symbol);

  // Yahoo omits marketCap / sharesOutstanding for some listings (notably several
  // Indian names), which showed "n/a" even though the pieces to derive them are
  // present. Shares ≈ net income ÷ EPS (or market cap ÷ price); market cap ≈
  // price × shares. Derived only when the source values are missing.
  const livePrice = num(pr.regularMarketPrice) ?? num(fd.currentPrice);
  const netIncomeVal = num(ks.netIncomeToCommon);
  const epsVal = num(ks.trailingEps);
  let sharesOutstandingResolved = num(ks.sharesOutstanding);
  if (sharesOutstandingResolved == null && netIncomeVal != null && epsVal != null && epsVal > 0)
    sharesOutstandingResolved = netIncomeVal / epsVal;
  let marketCapResolved = num(sd.marketCap) ?? num(pr.marketCap);
  if (marketCapResolved == null && livePrice != null && sharesOutstandingResolved != null)
    marketCapResolved = livePrice * sharesOutstandingResolved;
  // Backfill shares from a known market cap when EPS wasn't available either.
  if (sharesOutstandingResolved == null && marketCapResolved != null && livePrice != null && livePrice > 0)
    sharesOutstandingResolved = marketCapResolved / livePrice;

  // Yahoo's financialData module is frequently PARTIAL for Indian listings — it
  // returned margins/EBITDA for Reliance but dropped current/quick ratio, ROE,
  // ROA, operating & free cash flow, and the P/S & P/B ratios. Derive each from
  // the financial statements (fetched above) or from figures we already have, so
  // the Statistics tab isn't a wall of "n/a" for a company this size.
  const bal0 = stmts.balance[0]?.values ?? {};
  const cf0 = stmts.cashflow[0]?.values ?? {};
  const inc0 = stmts.income[0]?.values ?? {};
  const nonZero = (v: number | undefined): v is number => v != null && v !== 0;

  const netIncomeVal2 = num(ks.netIncomeToCommon) ?? inc0.netIncome;
  const revenueVal = num(fd.totalRevenue) ?? inc0.revenue;

  const operatingCashflowResolved = num(fd.operatingCashflow) ?? cf0.operatingCashFlow;
  const freeCashflowResolved =
    num(fd.freeCashflow) ??
    cf0.freeCashFlow ??
    (cf0.operatingCashFlow != null && cf0.capex != null
      ? cf0.operatingCashFlow + cf0.capex // capex is reported negative
      : undefined);

  const roeResolved =
    num(fd.returnOnEquity) ??
    (netIncomeVal2 != null && nonZero(bal0.totalEquity) ? netIncomeVal2 / bal0.totalEquity : undefined);
  const roaResolved =
    num(fd.returnOnAssets) ??
    (netIncomeVal2 != null && nonZero(bal0.totalAssets) ? netIncomeVal2 / bal0.totalAssets : undefined);

  const currentRatioResolved =
    num(fd.currentRatio) ??
    (bal0.currentAssets != null && nonZero(bal0.currentLiabilities)
      ? bal0.currentAssets / bal0.currentLiabilities
      : undefined);
  const quickRatioResolved =
    num(fd.quickRatio) ??
    (bal0.currentAssets != null && nonZero(bal0.currentLiabilities)
      ? (bal0.currentAssets - (bal0.inventory ?? 0)) / bal0.currentLiabilities
      : undefined);

  const priceToSalesResolved =
    num(sd.priceToSalesTrailing12Months) ??
    (marketCapResolved != null && nonZero(revenueVal) ? marketCapResolved / revenueVal : undefined);
  const priceToBookResolved =
    num(ks.priceToBook) ??
    (marketCapResolved != null && nonZero(bal0.totalEquity) ? marketCapResolved / bal0.totalEquity : undefined);

  // P/E got no fallback while P/S and P/B did, so any listing where Yahoo omits
  // trailingPE rendered a bare "—" even with market cap AND earnings both sitting
  // right there on the card (Korean listings like 004310.KS are a common case).
  // Derive it the same way: price ÷ EPS first (the literal definition), then
  // market cap ÷ net income. Both need a POSITIVE denominator — a negative P/E is
  // meaningless, and a loss-making company should fall through to the P/S lens.
  const trailingPeResolved =
    num(sd.trailingPE) ??
    num(ks.trailingPE) ??
    (livePrice != null && epsVal != null && epsVal > 0 ? livePrice / epsVal : undefined) ??
    (marketCapResolved != null && netIncomeVal2 != null && netIncomeVal2 > 0
      ? marketCapResolved / netIncomeVal2
      : undefined);
  const forwardEpsVal = num(ks.forwardEps);
  const forwardPeResolved =
    num(sd.forwardPE) ??
    num(ks.forwardPE) ??
    (livePrice != null && forwardEpsVal != null && forwardEpsVal > 0
      ? livePrice / forwardEpsVal
      : undefined);

  const data: CompanyData = {
    symbol,
    resolvedFrom,
    name: str(pr.longName) ?? str(pr.shortName) ?? symbol,
    description: str(ap.longBusinessSummary),
    sector: str(ap.sector),
    industry: str(ap.industry),
    website: str(ap.website),
    officers: parseOfficers(ap.companyOfficers),
    employees: num(ap.fullTimeEmployees),
    country: str(ap.country),
    currency: str(pr.currency) ?? str(sd.currency),
    financialCurrency: str(fd.financialCurrency),
    // Prefer the live quote (regularMarketPrice) over financialData.currentPrice,
    // which is a fundamentals-module snapshot that lags during market hours and
    // made this header disagree with the live chart/quote by a rupee or two.
    price: num(pr.regularMarketPrice) ?? num(fd.currentPrice),
    open: num(pr.regularMarketOpen) ?? num(sd.open),
    previousClose: num(sd.previousClose) ?? num(pr.regularMarketPreviousClose),
    dayLow: num(sd.dayLow) ?? num(pr.regularMarketDayLow),
    dayHigh: num(sd.dayHigh) ?? num(pr.regularMarketDayHigh),
    fiftyTwoWeekLow: num(sd.fiftyTwoWeekLow),
    fiftyTwoWeekHigh: num(sd.fiftyTwoWeekHigh),
    fiftyDayAvg: num(sd.fiftyDayAverage),
    twoHundredDayAvg: num(sd.twoHundredDayAverage),
    volume: num(sd.volume) ?? num(pr.regularMarketVolume),
    avgVolume: num(sd.averageVolume),
    beta: num(sd.beta) ?? num(ks.beta),
    marketCap: marketCapResolved,
    enterpriseValue: num(ks.enterpriseValue),
    sharesOutstanding: sharesOutstandingResolved,
    trailingPE: trailingPeResolved,
    forwardPE: forwardPeResolved,
    priceToSales: priceToSalesResolved,
    priceToBook: priceToBookResolved,
    pegRatio: num(ks.pegRatio),
    evToRevenue: num(ks.enterpriseToRevenue),
    evToEbitda: num(ks.enterpriseToEbitda),
    // Fall back to the reported income statement — these two feed the valuation
    // donut, and Yahoo's summary modules drop them for plenty of non-US listings.
    revenue: revenueVal,
    grossProfit: num(fd.grossProfits) ?? inc0.grossProfit,
    ebitda: num(fd.ebitda),
    netIncome: netIncomeVal2,
    eps: num(ks.trailingEps),
    revenueGrowth: num(fd.revenueGrowth),
    earningsGrowth: num(fd.earningsGrowth) ?? num(ks.earningsQuarterlyGrowth),
    grossMargin: num(fd.grossMargins),
    operatingMargin: num(fd.operatingMargins),
    profitMargin: num(fd.profitMargins),
    currentRatio: currentRatioResolved,
    quickRatio: quickRatioResolved,
    debtToEquity: num(fd.debtToEquity),
    totalCash: num(fd.totalCash),
    totalDebt: num(fd.totalDebt),
    roe: roeResolved,
    roa: roaResolved,
    operatingCashflow: operatingCashflowResolved,
    freeCashflow: freeCashflowResolved,
    dividendRate: num(sd.dividendRate),
    dividendYield: num(sd.dividendYield),
    payoutRatio: num(sd.payoutRatio),
    exDividendDate: dateOf(sd.exDividendDate),
    targetMean: num(fd.targetMeanPrice),
    targetHigh: num(fd.targetHighPrice),
    targetLow: num(fd.targetLowPrice),
    recommendationKey: str(fd.recommendationKey) ?? keyFromVotes,
    numberOfAnalysts: num(fd.numberOfAnalystOpinions) ?? (voteCount > 0 ? voteCount : undefined),
    earningsDate:
      (earningsArr.length ? dateOf(earningsArr[0]) : undefined) ?? dateOf(etDate),
    topFundHolders: topFundHolders.length ? topFundHolders : undefined,
    topInstitutionalHolders: topInstitutionalHolders.length ? topInstitutionalHolders : undefined,
    ownership:
      ownership.institutionsPct != null || ownership.insidersPct != null || ownership.institutionsCount != null
        ? ownership
        : undefined,
    incomeStatements: stmts.income,
    balanceSheets: stmts.balance,
    cashflowStatements: stmts.cashflow,
    news: await fetchNews(symbol),
  };

  return data;
}
