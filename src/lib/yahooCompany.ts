// Rich company data for the Stock Analysis page: symbol resolution, a full
// statistics/financials profile, and company-specific news — all keyless via
// Yahoo Finance's public endpoints, for personal non-commercial use. Every field
// is optional; callers render "n/a" when something is missing.

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
  currency?: string;
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
  recommendationKey?: string;
  numberOfAnalysts?: number;
  earningsDate?: string;
  // statements (most recent periods first)
  incomeStatements?: FinRow[];
  balanceSheets?: FinRow[];
  cashflowStatements?: FinRow[];
  // news
  news?: CompanyNews[];
  resolvedFrom?: string;
}

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
async function getYahooStatements(
  symbol: string
): Promise<{ income: FinRow[]; balance: FinRow[]; cashflow: FinRow[] }> {
  const empty = { income: [], balance: [], cashflow: [] };
  try {
    const types = [
      "annualTotalRevenue", "annualGrossProfit", "annualOperatingIncome", "annualNetIncome",
      "annualTotalAssets", "annualTotalLiabilitiesNetMinorityInterest", "annualStockholdersEquity",
      "annualCashAndCashEquivalents", "annualLongTermDebt",
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
    return {
      income: dates.map((d) => pick(d, {
        revenue: "annualTotalRevenue", grossProfit: "annualGrossProfit",
        operatingIncome: "annualOperatingIncome", netIncome: "annualNetIncome",
      })),
      balance: dates.map((d) => pick(d, {
        totalAssets: "annualTotalAssets", totalLiabilities: "annualTotalLiabilitiesNetMinorityInterest",
        totalEquity: "annualStockholdersEquity", cash: "annualCashAndCashEquivalents",
        longTermDebt: "annualLongTermDebt",
      })),
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
  const cc = await getCrumb();
  if (!cc) return null;

  const modules =
    "assetProfile,summaryDetail,defaultKeyStatistics,financialData,price,calendarEvents";

  async function pull(sym: string): Promise<Record<string, unknown> | undefined> {
    try {
      const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
        sym
      )}?modules=${modules}&crumb=${encodeURIComponent(cc!.crumb)}`;
      const res = await fetch(url, {
        headers: { "User-Agent": UA, Cookie: cc!.cookie },
        next: { revalidate: 3600 },
        signal: AbortSignal.timeout(9000),
      });
      if (!res.ok) return undefined;
      const json = (await res.json()) as { quoteSummary?: { result?: Record<string, unknown>[] } };
      return json?.quoteSummary?.result?.[0];
    } catch {
      return undefined;
    }
  }

  let symbol = input.toUpperCase();
  let resolvedFrom: string | undefined;
  let result = await pull(symbol);

  // If nothing came back, resolve the name/symbol and retry.
  if (!result) {
    const resolved = await resolveSymbol(input);
    if (resolved && resolved.symbol.toUpperCase() !== symbol) {
      resolvedFrom = symbol;
      symbol = resolved.symbol.toUpperCase();
      result = await pull(symbol);
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

  const stmts = await getYahooStatements(symbol);

  const data: CompanyData = {
    symbol,
    resolvedFrom,
    name: str(pr.longName) ?? str(pr.shortName) ?? symbol,
    description: str(ap.longBusinessSummary),
    sector: str(ap.sector),
    industry: str(ap.industry),
    website: str(ap.website),
    employees: num(ap.fullTimeEmployees),
    currency: str(pr.currency) ?? str(sd.currency),
    price: num(fd.currentPrice) ?? num(pr.regularMarketPrice),
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
    marketCap: num(sd.marketCap) ?? num(pr.marketCap),
    enterpriseValue: num(ks.enterpriseValue),
    sharesOutstanding: num(ks.sharesOutstanding),
    trailingPE: num(sd.trailingPE) ?? num(ks.trailingPE),
    forwardPE: num(sd.forwardPE) ?? num(ks.forwardPE),
    priceToSales: num(sd.priceToSalesTrailing12Months),
    priceToBook: num(ks.priceToBook),
    pegRatio: num(ks.pegRatio),
    evToRevenue: num(ks.enterpriseToRevenue),
    evToEbitda: num(ks.enterpriseToEbitda),
    revenue: num(fd.totalRevenue),
    grossProfit: num(fd.grossProfits),
    ebitda: num(fd.ebitda),
    netIncome: num(ks.netIncomeToCommon),
    eps: num(ks.trailingEps),
    revenueGrowth: num(fd.revenueGrowth),
    earningsGrowth: num(fd.earningsGrowth) ?? num(ks.earningsQuarterlyGrowth),
    grossMargin: num(fd.grossMargins),
    operatingMargin: num(fd.operatingMargins),
    profitMargin: num(fd.profitMargins),
    currentRatio: num(fd.currentRatio),
    quickRatio: num(fd.quickRatio),
    debtToEquity: num(fd.debtToEquity),
    totalCash: num(fd.totalCash),
    totalDebt: num(fd.totalDebt),
    roe: num(fd.returnOnEquity),
    roa: num(fd.returnOnAssets),
    operatingCashflow: num(fd.operatingCashflow),
    freeCashflow: num(fd.freeCashflow),
    dividendRate: num(sd.dividendRate),
    dividendYield: num(sd.dividendYield),
    payoutRatio: num(sd.payoutRatio),
    exDividendDate: dateOf(sd.exDividendDate),
    targetMean: num(fd.targetMeanPrice),
    recommendationKey: str(fd.recommendationKey),
    numberOfAnalysts: num(fd.numberOfAnalystOpinions),
    earningsDate: earningsArr.length ? dateOf(earningsArr[0]) : undefined,
    incomeStatements: stmts.income,
    balanceSheets: stmts.balance,
    cashflowStatements: stmts.cashflow,
    news: await fetchNews(symbol),
  };

  return data;
}
