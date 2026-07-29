"use client";

import { useEffect, useState } from "react";
import { GlassCard, SectionHeading } from "@/components/quantifi/Cards";
import type { CompanyData } from "@/lib/yahooCompany";
import { currencySymbol } from "@/data/demo";

type Tone = "good" | "warn" | "bad";

function compactCur(n: number | undefined, sym: string): string {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e12) return `${s}${sym}${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${s}${sym}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}${sym}${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}${sym}${(a / 1e3).toFixed(1)}K`;
  return `${s}${sym}${Math.round(a)}`;
}

function Insight({ title, detail, tone }: { title: string; detail: string; tone: Tone }) {
  const dot =
    tone === "good" ? "bg-up" : tone === "warn" ? "bg-gold" : "bg-down";
  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 flex-none rounded-full ${dot}`} />
        <span className="text-sm font-medium text-white">{title}</span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{detail}</p>
    </div>
  );
}

export default function DebtEquityHistory({ symbol, name }: { symbol: string; name?: string }) {
  const [data, setData] = useState<CompanyData | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    fetch(`/api/company/${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d: { available?: boolean; data?: CompanyData }) => {
        if (!cancelled) setData(d?.available && d.data ? d.data : null);
      })
      .catch(() => !cancelled && setData(null));
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (data === undefined) {
    return (
      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
        <div className="h-48 animate-pulse rounded-lg border border-white/[0.06] bg-white/[0.02]" />
      </section>
    );
  }
  if (!data) return null;

  // Balance sheets come newest-first; reverse for an oldest→newest timeline.
  const series = (data.balanceSheets ?? [])
    .slice()
    .reverse()
    .map((r) => ({
      date: r.date,
      debt: r.values.longTermDebt ?? r.values.totalLiabilities,
      equity: r.values.totalEquity,
      cash: r.values.cash,
    }))
    .filter((s) => s.equity != null && s.equity !== 0);

  if (series.length < 2) return null; // not enough history to say anything

  const label = name ?? symbol;
  const stmtCur = data.financialCurrency ?? data.currency ?? "USD";
  const sym = currencySymbol(stmtCur);

  // ── Insight lines (from the most reliable current figures) ─────────────────
  const cash = data.totalCash;
  const debt = data.totalDebt;
  const ocf = data.operatingCashflow;

  const insights: { title: string; detail: string; tone: Tone }[] = [];

  if (cash != null && debt != null) {
    insights.push(
      cash >= debt
        ? {
            title: "Debt level",
            detail: `${label} has more cash (${compactCur(cash, sym)}) than its total debt (${compactCur(debt, sym)}).`,
            tone: "good",
          }
        : {
            title: "Debt level",
            detail: `${label}'s total debt (${compactCur(debt, sym)}) is higher than its cash (${compactCur(cash, sym)}).`,
            tone: "warn",
          }
    );
  }

  const first = series[0];
  const last = series[series.length - 1];
  const r0 = first.debt != null && first.equity ? (first.debt / first.equity) * 100 : null;
  const r1 = last.debt != null && last.equity ? (last.debt / last.equity) * 100 : null;
  const yrFirst = first.date ? Number(first.date.slice(0, 4)) : null;
  const yrLast = last.date ? Number(last.date.slice(0, 4)) : null;
  const span = yrFirst && yrLast && yrLast > yrFirst ? yrLast - yrFirst : series.length - 1;
  if (r0 != null && r1 != null) {
    const up = r1 >= r0;
    insights.push({
      title: up ? "Debt to equity" : "Reducing debt",
      detail: `${label}'s debt-to-equity ratio has ${up ? "increased" : "reduced"} from ${r0.toFixed(0)}% to ${r1.toFixed(1)}% over the past ${span} year${span === 1 ? "" : "s"}.`,
      tone: r1 <= 40 ? "good" : r1 <= 100 ? "warn" : "bad",
    });
  }

  if (ocf != null && debt != null && debt > 0) {
    const cover = (ocf / debt) * 100;
    insights.push({
      title: "Debt coverage",
      detail:
        cover >= 100
          ? `${label}'s debt is more than covered by operating cash flow (${cover.toFixed(1)}%).`
          : cover >= 20
          ? `${label}'s debt is well covered by operating cash flow (${cover.toFixed(1)}%).`
          : `${label}'s operating cash flow covers only ${cover.toFixed(1)}% of its debt.`,
      tone: cover >= 100 ? "good" : cover >= 20 ? "warn" : "bad",
    });
  }

  // ── Chart geometry ─────────────────────────────────────────────────────────
  const W = 820;
  const H = 300;
  const pad = 14;
  const maxV = Math.max(
    1,
    ...series.map((s) => Math.max(s.equity ?? 0, s.debt ?? 0))
  );
  const X = (i: number) => pad + (i / (series.length - 1)) * (W - 2 * pad);
  const Y = (v: number) => H - pad - (v / maxV) * (H - 2 * pad);
  const line = (key: "debt" | "equity") =>
    series
      .map((s, i) => `${X(i)},${Y(Math.max(0, s[key] ?? 0))}`)
      .join(" ");
  const equityArea = `${X(0)},${Y(0)} ${line("equity")} ${X(series.length - 1)},${Y(0)}`;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Financial health"
        title="Debt to equity history and analysis"
        subtitle="How the company's borrowings compare with shareholder equity over time — and whether that debt is comfortably covered."
      />

      <GlassCard className="mt-6 p-5 sm:p-6">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#4F93F7]" />
            <span className="text-slate-300">Equity</span>
            <span className="font-mono text-slate-400">{compactCur(last.equity, sym)}</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#FB7185]" />
            <span className="text-slate-300">Debt</span>
            <span className="font-mono text-slate-400">{compactCur(last.debt, sym)}</span>
          </span>
          <span className="ml-auto font-mono text-slate-500">figures in {stmtCur}</span>
        </div>

        {/* Chart */}
        <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 260 }} preserveAspectRatio="none">
            <defs>
              <linearGradient id="deEquity" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4F93F7" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#4F93F7" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <polygon points={equityArea} fill="url(#deEquity)" stroke="none" />
            <polyline points={line("equity")} fill="none" stroke="#4F93F7" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            <polyline points={line("debt")} fill="none" stroke="#FB7185" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="mt-1 flex justify-between text-[0.6rem] text-slate-500">
            {series.map((s) => (
              <span key={s.date} className="font-mono">{s.date?.slice(0, 4) ?? ""}</span>
            ))}
          </div>
        </div>

        {/* Insights */}
        {insights.length ? (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {insights.map((c) => (
              <Insight key={c.title} title={c.title} detail={c.detail} tone={c.tone} />
            ))}
          </div>
        ) : null}

        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Debt is interest-bearing borrowings; equity is total shareholder equity — both from the last few reported
          annual balance sheets. Research context, not advice.
        </p>
      </GlassCard>
    </section>
  );
}
