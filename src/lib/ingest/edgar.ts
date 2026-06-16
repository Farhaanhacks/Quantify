// SEC EDGAR ingestion adapter.
//
// EDGAR is public-domain US government data with an official, free JSON feed —
// the gold-standard "scrape" source: no licence needed, just a declared
// User-Agent (SEC policy). Covers US filers only; non-US tickers (e.g. ".NS"
// Indian symbols) won't be found here — see the README for India sources.
//
// Set EDGAR_USER_AGENT to something like "Quantifi you@example.com".

import { politeFetch } from "@/lib/ingest/politeFetch";

const UA = process.env.EDGAR_USER_AGENT ?? "";

export interface Fundamentals {
  ticker: string;
  cik: string;
  source: "SEC EDGAR";
  fiscalYear?: number;
  revenue?: number;
  netIncome?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  cash?: number;
}

interface TickerRow {
  cik_str: number;
  ticker: string;
  title: string;
}

let tickerMap: Record<string, string> | null = null; // TICKER -> 10-digit CIK

async function loadTickerMap(): Promise<Record<string, string>> {
  if (tickerMap) return tickerMap;
  const res = await politeFetch("https://www.sec.gov/files/company_tickers.json", {
    userAgent: UA,
    revalidateSeconds: 86400,
  });
  if (!res.ok) throw new Error(`EDGAR ticker map responded ${res.status}`);
  const data = (await res.json()) as Record<string, TickerRow>;
  const map: Record<string, string> = {};
  for (const key of Object.keys(data)) {
    const row = data[key];
    if (row?.ticker) map[row.ticker.toUpperCase()] = String(row.cik_str).padStart(10, "0");
  }
  tickerMap = map;
  return map;
}

interface Fact {
  val: number;
  fy?: number;
  form?: string;
}

function latestAnnual(facts: unknown, concept: string): { val: number; fy?: number } | null {
  try {
    const units = (facts as { facts?: { "us-gaap"?: Record<string, { units?: { USD?: Fact[] } }> } })
      ?.facts?.["us-gaap"]?.[concept]?.units?.USD;
    if (!Array.isArray(units)) return null;
    const annual = units.filter(
      (u) => u.form === "10-K" && typeof u.val === "number"
    );
    if (!annual.length) return null;
    annual.sort((a, b) => (b.fy ?? 0) - (a.fy ?? 0));
    return { val: annual[0].val, fy: annual[0].fy };
  } catch {
    return null;
  }
}

export async function getEdgarFundamentals(ticker: string): Promise<Fundamentals | null> {
  if (!UA) {
    console.warn("[edgar] EDGAR_USER_AGENT is not set — SEC requires a User-Agent with contact info.");
    return null;
  }
  try {
    const t = ticker.toUpperCase();
    const map = await loadTickerMap();
    const cik = map[t];
    if (!cik) return null; // not a US filer

    const res = await politeFetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
      userAgent: UA,
      revalidateSeconds: 86400,
    });
    if (!res.ok) throw new Error(`EDGAR companyfacts responded ${res.status}`);
    const facts = await res.json();

    const revenue =
      latestAnnual(facts, "Revenues") ??
      latestAnnual(facts, "RevenueFromContractWithCustomerExcludingAssessedTax");
    const netIncome = latestAnnual(facts, "NetIncomeLoss");
    const assets = latestAnnual(facts, "Assets");
    const liabilities = latestAnnual(facts, "Liabilities");
    const cash = latestAnnual(facts, "CashAndCashEquivalentsAtCarryingValue");

    return {
      ticker: t,
      cik,
      source: "SEC EDGAR",
      fiscalYear: revenue?.fy ?? netIncome?.fy,
      revenue: revenue?.val,
      netIncome: netIncome?.val,
      totalAssets: assets?.val,
      totalLiabilities: liabilities?.val,
      cash: cash?.val,
    };
  } catch (err) {
    console.error("[edgar] fundamentals failed:", err);
    return null;
  }
}
