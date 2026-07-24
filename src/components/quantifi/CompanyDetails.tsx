"use client";

import { useEffect, useState, type ReactNode } from "react";
import { GlassCard, SectionHeading } from "@/components/quantifi/Cards";
import type { CompanyData, FinRow } from "@/lib/yahooCompany";
import { fmtCompactCur, isIndianCurrency, currencySymbol } from "@/data/demo";

// Currency-aware compact formatting: Indian stocks read in lakh / crore, the
// rest in K / M / B / T. See fmtCompactCur in demo.ts.
const compact = (n?: number, indian = false): string => fmtCompactCur(n, indian, "n/a");
const pct = (n?: number): string => (n == null || !isFinite(n) ? "n/a" : `${(n * 100).toFixed(2)}%`);
const ratio = (n?: number): string => (n == null || !isFinite(n) ? "n/a" : n.toFixed(2));
const money = (n: number | undefined, cur = "USD"): string => {
  if (n == null || !isFinite(n)) return "n/a";
  return `${currencySymbol(cur)}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
};
const de = (n?: number): string => (n == null || !isFinite(n) ? "n/a" : (n / 100).toFixed(2));

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-white/[0.05] py-1.5 text-sm">
      <span className="text-slate-400">{label}</span>
      <span className="font-mono text-slate-200">{value}</span>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="break-inside-avoid">
      <h4 className="mb-1 font-display text-sm font-semibold text-white">{title}</h4>
      <div>{children}</div>
    </div>
  );
}

function StatementTable({ rows, labels, indian }: { rows?: FinRow[]; labels: { key: string; label: string }[]; indian?: boolean }) {
  if (!rows || rows.length === 0) return <p className="text-sm text-slate-500">Not available for this symbol.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[420px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-white/10 text-left text-slate-400">
            <th className="py-2 pr-4 font-medium">Item</th>
            {rows.map((r, i) => (
              <th key={i} className="py-2 pr-4 font-mono text-xs text-slate-300">{r.date ?? "—"}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((l) => (
            <tr key={l.key} className="border-b border-white/[0.05]">
              <td className="py-1.5 pr-4 text-slate-400">{l.label}</td>
              {rows.map((r, i) => (
                <td key={i} className="py-1.5 pr-4 font-mono text-slate-200">{compact(r.values[l.key], indian)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CompanyDetails({ symbol }: { symbol: string }) {
  const [data, setData] = useState<CompanyData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setData(null);
    fetch(`/api/company/${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d: { available: boolean; data?: CompanyData }) => {
        if (!cancelled) setData(d.available && d.data ? d.data : null);
      })
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [symbol]);

  if (loading) {
    return (
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <GlassCard className="p-6"><p className="text-sm text-slate-400">Loading company data for {symbol}…</p></GlassCard>
      </section>
    );
  }
  if (!data) {
    return (
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <GlassCard className="p-6">
          <p className="text-sm text-slate-400">
            Detailed company data isn&apos;t available for {symbol} right now — it may be an ETF/index, or Yahoo may be rate-limiting. The chart and score above still work.
          </p>
        </GlassCard>
      </section>
    );
  }

  const cur = data.currency ?? "USD";
  const indian = isIndianCurrency(data.currency, symbol);
  // Shadow the module-level helper so every compact(...) in this component's
  // render is currency-aware (lakh/crore for Indian stocks) without threading
  // the flag through each call site.
  const compact = (n?: number) => fmtCompactCur(n, indian, "n/a");
  const sectorLine = data.sector ? `${data.sector}${data.industry ? ` · ${data.industry}` : ""}` : "";

  // Three first-class stacked sections — Overview, then Financials, then
  // Statistics — instead of tabs, so each reads as its own part of the page.
  return (
    <>
      {/* ── Overview ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Overview"
          title={`${data.name} at a glance`}
          subtitle={sectorLine ? `${sectorLine}. The business, and the headline numbers that frame it.` : "The business, and the headline numbers that frame it."}
        />
        <GlassCard className="mt-6 p-6 sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="font-display text-lg font-semibold text-white">
              {data.name} <span className="font-mono text-sm text-slate-500">{data.symbol}</span>
            </h3>
            {sectorLine ? <span className="text-xs text-slate-500">{sectorLine}</span> : null}
          </div>
          {data.resolvedFrom ? (
            <p className="mt-1 text-xs text-slate-500">Resolved “{data.resolvedFrom}” → {data.symbol}</p>
          ) : null}
          {data.description ? (
            <p className="mt-4 text-sm leading-relaxed text-slate-300">{data.description}</p>
          ) : <p className="mt-4 text-sm text-slate-500">No description available.</p>}
          <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-0 sm:grid-cols-2 lg:grid-cols-3">
            <Row label="Market Cap" value={compact(data.marketCap)} />
            <Row label={`Revenue (ttm)${data.revenueGrowth != null ? ` (${pct(data.revenueGrowth)})` : ""}`} value={compact(data.revenue)} />
            <Row label="Net Income" value={compact(data.netIncome)} />
            <Row label="EPS" value={ratio(data.eps)} />
            <Row label="Shares Out" value={compact(data.sharesOutstanding)} />
            <Row label="PE Ratio" value={ratio(data.trailingPE)} />
            <Row label="Forward PE" value={ratio(data.forwardPE)} />
            <Row label="Dividend" value={data.dividendRate != null ? `${money(data.dividendRate, cur)}${data.dividendYield != null ? ` (${pct(data.dividendYield)})` : ""}` : "n/a"} />
            <Row label="Ex-Dividend Date" value={data.exDividendDate ?? "n/a"} />
            <Row label="Volume" value={compact(data.volume)} />
            <Row label="Open" value={money(data.open, cur)} />
            <Row label="Previous Close" value={money(data.previousClose, cur)} />
            <Row label="Day's Range" value={data.dayLow != null && data.dayHigh != null ? `${money(data.dayLow, cur)} – ${money(data.dayHigh, cur)}` : "n/a"} />
            <Row label="52-Week Range" value={data.fiftyTwoWeekLow != null && data.fiftyTwoWeekHigh != null ? `${money(data.fiftyTwoWeekLow, cur)} – ${money(data.fiftyTwoWeekHigh, cur)}` : "n/a"} />
            <Row label="Beta" value={ratio(data.beta)} />
            <Row label="Analysts" value={data.numberOfAnalysts != null ? String(data.numberOfAnalysts) : "n/a"} />
            <Row label="Price Target" value={money(data.targetMean, cur)} />
            <Row label="Earnings Date" value={data.earningsDate ?? "n/a"} />
          </div>
        </GlassCard>
      </section>

      {/* ── Financials ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Financials"
          title="Financial statements"
          subtitle="Income statement, balance sheet and cash flow — the last few reported annual periods."
        />
        <GlassCard className="mt-6 p-6 sm:p-8">
          <div className="space-y-8">
            <div>
              <h4 className="mb-2 font-display text-sm font-semibold text-white">Income Statement</h4>
              <StatementTable indian={indian} rows={data.incomeStatements} labels={[
                { key: "revenue", label: "Revenue" },
                { key: "grossProfit", label: "Gross Profit" },
                { key: "operatingIncome", label: "Operating Income" },
                { key: "netIncome", label: "Net Income" },
              ]} />
            </div>
            <div>
              <h4 className="mb-2 font-display text-sm font-semibold text-white">Balance Sheet</h4>
              <StatementTable indian={indian} rows={data.balanceSheets} labels={[
                { key: "totalAssets", label: "Total Assets" },
                { key: "totalLiabilities", label: "Total Liabilities" },
                { key: "totalEquity", label: "Total Equity" },
                { key: "cash", label: "Cash" },
                { key: "longTermDebt", label: "Long-Term Debt" },
              ]} />
            </div>
            <div>
              <h4 className="mb-2 font-display text-sm font-semibold text-white">Cash Flow Statement</h4>
              <StatementTable indian={indian} rows={data.cashflowStatements} labels={[
                { key: "operatingCashFlow", label: "Operating Cash Flow" },
                { key: "capex", label: "Capital Expenditures" },
                { key: "freeCashFlow", label: "Free Cash Flow" },
              ]} />
            </div>
            <p className="text-xs leading-relaxed text-slate-500">
              Source: Yahoo Finance · most recent reported annual periods, in {cur === "INR" ? "Indian rupees (lakh / crore)" : "the listed currency"}.
              Figures may be reported on a standalone or consolidated basis and can differ slightly from a
              company&apos;s official filings or be revised later — always verify against the latest annual
              report or exchange (e.g. NSE/BSE, SEC) filing before relying on them.
            </p>
          </div>
        </GlassCard>
      </section>

      {/* ── Statistics ────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
        <SectionHeading
          eyebrow="Statistics"
          title="Key statistics"
          subtitle="Valuation, financial position, efficiency and returns — the full ratio picture."
        />
        <GlassCard className="mt-6 p-6 sm:p-8">
          <div className="grid grid-cols-1 gap-x-10 gap-y-6 md:grid-cols-2">
            <Group title="Total Valuation">
              <Row label="Market Cap" value={compact(data.marketCap)} />
              <Row label="Enterprise Value" value={compact(data.enterpriseValue)} />
            </Group>
            <Group title="Share Statistics">
              <Row label="Shares Outstanding" value={compact(data.sharesOutstanding)} />
              <Row label="Beta (5Y)" value={ratio(data.beta)} />
            </Group>
            <Group title="Valuation Ratios">
              <Row label="PE Ratio" value={ratio(data.trailingPE)} />
              <Row label="Forward PE" value={ratio(data.forwardPE)} />
              <Row label="PS Ratio" value={ratio(data.priceToSales)} />
              <Row label="PB Ratio" value={ratio(data.priceToBook)} />
              <Row label="PEG Ratio" value={ratio(data.pegRatio)} />
            </Group>
            <Group title="Enterprise Valuation">
              <Row label="EV / Sales" value={ratio(data.evToRevenue)} />
              <Row label="EV / EBITDA" value={ratio(data.evToEbitda)} />
            </Group>
            <Group title="Financial Position">
              <Row label="Current Ratio" value={ratio(data.currentRatio)} />
              <Row label="Quick Ratio" value={ratio(data.quickRatio)} />
              <Row label="Debt / Equity" value={de(data.debtToEquity)} />
              <Row label="Total Cash" value={compact(data.totalCash)} />
              <Row label="Total Debt" value={compact(data.totalDebt)} />
            </Group>
            <Group title="Financial Efficiency">
              <Row label="Return on Equity (ROE)" value={pct(data.roe)} />
              <Row label="Return on Assets (ROA)" value={pct(data.roa)} />
            </Group>
            <Group title="Income Statement (ttm)">
              <Row label="Revenue" value={compact(data.revenue)} />
              <Row label="Gross Profit" value={compact(data.grossProfit)} />
              <Row label="EBITDA" value={compact(data.ebitda)} />
              <Row label="Net Income" value={compact(data.netIncome)} />
              <Row label="EPS" value={ratio(data.eps)} />
            </Group>
            <Group title="Cash Flow">
              <Row label="Operating Cash Flow" value={compact(data.operatingCashflow)} />
              <Row label="Free Cash Flow" value={compact(data.freeCashflow)} />
            </Group>
            <Group title="Margins">
              <Row label="Gross Margin" value={pct(data.grossMargin)} />
              <Row label="Operating Margin" value={pct(data.operatingMargin)} />
              <Row label="Profit Margin" value={pct(data.profitMargin)} />
            </Group>
            <Group title="Dividends & Yields">
              <Row label="Dividend Per Share" value={money(data.dividendRate, cur)} />
              <Row label="Dividend Yield" value={pct(data.dividendYield)} />
              <Row label="Payout Ratio" value={pct(data.payoutRatio)} />
            </Group>
            <Group title="Analyst Forecast">
              <Row label="Price Target" value={money(data.targetMean, cur)} />
              <Row
                label="Consensus"
                value={
                  data.recommendationKey
                    ? data.recommendationKey.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
                    : "n/a"
                }
              />
              <Row label="Analyst Count" value={data.numberOfAnalysts != null ? String(data.numberOfAnalysts) : "n/a"} />
              <Row label="Revenue Growth" value={pct(data.revenueGrowth)} />
              <Row label="Earnings Growth" value={pct(data.earningsGrowth)} />
            </Group>
          </div>
        </GlassCard>
      </section>
    </>
  );
}
