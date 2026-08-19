"use client";

import { useEffect, useState } from "react";
import { GlassCard, SectionHeading } from "@/components/quantifi/Cards";
import type { CompanyData } from "@/lib/yahooCompany";
import { currencySymbol } from "@/data/demo";
import {
  financialHealthModel,
  leverageVerdict,
  showsCashFlowCoverage,
  showsCashVersusDebt,
  MODEL_HEADINGS,
  EQUITY_ONLY_HEADING,
  type HealthModel,
} from "@/lib/financialHealth";

// "neutral" exists so a figure can be reported without being scored, which is
// the only honest thing to do with a lender's gearing.
type Tone = "good" | "warn" | "bad" | "neutral";

function compactCur(n: number | undefined, sym: string): string {
  if (n == null || !isFinite(n)) return "n/a";
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e12) return `${s}${sym}${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${s}${sym}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}${sym}${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${s}${sym}${(a / 1e3).toFixed(1)}K`;
  return `${s}${sym}${Math.round(a)}`;
}

// A balance beam that physically tilts toward whichever side is heavier — the
// fastest way to read "is this company carrying more debt than equity?". Far more
// legible at a glance than a bare 0.53 ratio.
function Seesaw({
  debt,
  equity,
  sym,
  fmt,
  model,
  asOf,
}: {
  debt: number;
  equity: number;
  sym: string;
  fmt: (n: number | undefined, s: string) => string;
  model: HealthModel;
  asOf?: string;
}) {
  const total = debt + equity || 1;
  // Positive angle tilts the RIGHT (equity) side down, so the heavier side sinks.
  const angle = Math.max(-16, Math.min(16, ((equity - debt) / total) * 22));
  const ratio = equity > 0 ? debt / equity : null;
  // The verdict is not this component's to decide. A lender gets its gearing
  // stated and no adjective, because "Stretched" at 7.56x is a judgement about
  // an industrial company being applied to a business whose leverage IS the
  // business.
  const v = leverageVerdict(ratio, model);
  const tone =
    v.tone === "good" ? "text-up" : v.tone === "warn" ? "text-gold" : v.tone === "bad" ? "text-down" : "text-slate-300";

  return (
    <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-5">
      <div className="text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
        Debt vs equity balance
      </div>
      <svg viewBox="0 0 320 140" className="mx-auto mt-2 w-full" style={{ maxWidth: 340 }} role="img" aria-label="Debt versus equity balance">
        <g transform={`rotate(${angle} 160 86)`}>
          {/* beam */}
          <rect x="30" y="82" width="260" height="7" rx="3.5" fill="rgba(255,255,255,0.28)" />
          {/* debt block (left) */}
          <rect x="46" y="46" width="86" height="36" rx="6" fill="#FB7185" fillOpacity="0.22" stroke="#FB7185" strokeWidth="1.5" />
          <text x="89" y="62" textAnchor="middle" className="fill-down" style={{ fontSize: 10, fontWeight: 600 }}>Debt</text>
          <text x="89" y="75" textAnchor="middle" className="fill-white font-mono" style={{ fontSize: 11 }}>{fmt(debt, sym)}</text>
          {/* equity block (right) */}
          <rect x="188" y="46" width="86" height="36" rx="6" fill="#34D399" fillOpacity="0.22" stroke="#34D399" strokeWidth="1.5" />
          <text x="231" y="62" textAnchor="middle" className="fill-up" style={{ fontSize: 10, fontWeight: 600 }}>Equity</text>
          <text x="231" y="75" textAnchor="middle" className="fill-white font-mono" style={{ fontSize: 11 }}>{fmt(equity, sym)}</text>
        </g>
        {/* pivot */}
        <polygon points="160,88 142,124 178,124" fill="#D4AF37" />
        <rect x="126" y="124" width="68" height="5" rx="2.5" fill="rgba(212,175,55,0.45)" />
      </svg>
      <p className={`mt-1 text-center text-sm font-medium ${tone}`}>
        {v.verdict ?? "Not comparable"}
        {ratio != null && model === "industrial" ? (
          <span className="text-slate-500"> · {ratio.toFixed(2)} debt-to-equity</span>
        ) : null}
      </p>
      {asOf ? (
        <p className="mt-1 text-center text-[0.6rem] text-slate-500">
          Both figures from the balance sheet to {asOf}.
        </p>
      ) : null}
      <p className="mt-2 text-center text-[0.62rem] leading-relaxed text-slate-500">{v.note}</p>
    </div>
  );
}

// Two reported years is not a trend, and drawing it as one is a lie the eye
// believes. A polyline through two points is always a straight diagonal, so a
// recently-listed company (Lenskart has exactly two annual balance sheets) got a
// chart that looked like steady linear growth measured continuously, when all
// that exists is a pair of numbers. Bars say "two observations" and nothing
// more, which is the truth.
function YearBars({
  series,
  maxV,
  sym,
  fmt,
}: {
  series: { date?: string; debt?: number; equity?: number }[];
  maxV: number;
  sym: string;
  fmt: (n: number | undefined, s: string) => string;
}) {
  const TRACK = 176; // px; the bar heights are a share of this
  const bar = (v: number | undefined, color: string) => {
    if (v == null) return null;
    // A negative value hangs BELOW the baseline rather than being clamped to a
    // 2px stub at the bottom, which is what a Math.max(0, …) height gives you —
    // indistinguishable from "almost zero" when the truth is "less than
    // nothing".
    const negative = v < 0;
    return (
      // Fixed width, not flex-1. Letting each bar claim an equal share of the
      // year's column pushed the equity and debt bars to opposite ends of it,
      // so a pair that should read as one year's comparison looked like two
      // unrelated readings.
      <div className="flex w-[68px] flex-none flex-col items-center gap-1.5">
        <span className="whitespace-nowrap font-mono text-[0.6rem] text-slate-400">
          {fmt(v, sym)}
        </span>
        <div
          className={`flex w-full justify-center ${negative ? "items-start" : "items-end"}`}
          style={{ height: TRACK }}
        >
          <div
            className={`w-full max-w-[46px] ${negative ? "rounded-b-[3px]" : "rounded-t-[3px]"}`}
            style={{
              height: `${Math.min(100, Math.max(2, (Math.abs(v) / maxV) * 100))}%`,
              backgroundColor: color,
              opacity: negative ? 0.55 : 1,
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <div className="flex items-end justify-around gap-4 px-2 pt-2">
      {series.map((s, i) => (
        <div key={s.date ?? i} className="flex min-w-0 flex-col items-center">
          <div className="flex items-end justify-center gap-1 sm:gap-2">
            {bar(s.equity, "#4F93F7")}
            {bar(s.debt, "#FB7185")}
          </div>
          <span className="mt-2 w-full border-t border-white/[0.08] pt-1.5 text-center font-mono text-[0.62rem] text-slate-500">
            {s.date?.slice(0, 4) ?? ""}
          </span>
        </div>
      ))}
    </div>
  );
}

function Insight({ title, detail, tone }: { title: string; detail: string; tone: Tone }) {
  const dot =
    tone === "good" ? "bg-up" : tone === "warn" ? "bg-gold" : tone === "bad" ? "bg-down" : "bg-slate-500";
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

// One definition of "debt" for this whole section: the reported total when
// Yahoo gives it, otherwise long-term plus current borrowings.
//
// Total liabilities is deliberately NOT a fallback. For a bank it is mostly
// customer deposits, which are not borrowings: on Kotak Mahindra it read about
// ₹8T against ₹1.12T of real debt, so the chart drew the debt line above
// equity and the ratio card claimed 453.6% where the true figure is 62%. A
// missing line is honest — a line plotting deposits as debt is not.
function totalDebtOf(v: Record<string, number | undefined>): number | undefined {
  if (v.totalDebt != null) return v.totalDebt;
  const lt = v.longTermDebt;
  const cur = v.currentDebt;
  if (lt != null || cur != null) return (lt ?? 0) + (cur ?? 0);
  return undefined;
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
      // TOTAL debt, to match the seesaw and the insight cards below. This line
      // used to read longTermDebt, so a company funding itself with short-term
      // borrowings showed a chart legend of "Debt 19.4M" directly above a
      // balance reading "Debt 4.45B" — same section, two different metrics.
      debt: totalDebtOf(r.values),
      equity: r.values.totalEquity,
      cash: r.values.cash,
    }))
    .filter((s) => s.equity != null && s.equity !== 0);

  if (series.length < 2) return null; // not enough history to say anything

  const label = name ?? symbol;
  const stmtCur = data.financialCurrency ?? data.currency ?? "USD";
  const sym = currencySymbol(stmtCur);
  const model = financialHealthModel(data.industry, data.sector);

  // ── Annual and current, kept apart ────────────────────────────────────────
  //
  // These used to be one value: the live total-debt figure was written into the
  // newest annual point so the legend and the beam could not disagree. They
  // cannot disagree now either, but not by pretending a quarterly snapshot is
  // an annual close. A ratio built from debt at one date and equity at another
  // is not a ratio of anything, and on a fast-growing balance sheet the error
  // is not small.
  const cash = data.totalCash;
  const ocf = data.operatingCashflow;
  const currentDebtSnapshot = data.totalDebt;

  const historicalDebtPoints = series.filter((row) => row.debt != null);
  const hasDebtHistory = historicalDebtPoints.length >= 2;

  const first = series[0];
  const last = series[series.length - 1];
  const latestAnnualDebt = last.debt;
  const latestAnnualEquity = last.equity;
  // Everything dated uses the annual pair; the live snapshot is shown on its own
  // and never mixed into a ratio.
  const debt = latestAnnualDebt ?? currentDebtSnapshot;

  const insights: { title: string; detail: string; tone: Tone }[] = [];

  if (cash != null && debt != null && showsCashVersusDebt(model)) {
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

  // A debt-to-equity ratio needs POSITIVE equity to mean anything. Dividing by
  // a negative book value yields a negative percentage, which this section would
  // then narrate as "reduced from -60% to -12%" — a sentence that sounds like
  // good news about a company whose liabilities exceed its assets.
  const r0 = first.debt != null && first.equity != null && first.equity > 0 ? (first.debt / first.equity) * 100 : null;
  const r1 = last.debt != null && last.equity != null && last.equity > 0 ? (last.debt / last.equity) * 100 : null;
  const yrFirst = first.date ? Number(first.date.slice(0, 4)) : null;
  const yrLast = last.date ? Number(last.date.slice(0, 4)) : null;
  const span = yrFirst && yrLast && yrLast > yrFirst ? yrLast - yrFirst : series.length - 1;
  if (r0 != null && r1 != null) {
    const up = r1 >= r0;
    insights.push({
      title: model === "industrial" ? (up ? "Debt to equity" : "Reducing debt") : "Gearing over time",
      detail:
        model === "industrial"
          ? `${label}'s debt-to-equity ratio has ${up ? "increased" : "reduced"} from ${r0.toFixed(0)}% to ${r1.toFixed(1)}% over the past ${span} year${span === 1 ? "" : "s"}.`
          : `${label}'s borrowings have moved from ${(r0 / 100).toFixed(2)}x equity to ${(r1 / 100).toFixed(2)}x over the past ${span} year${span === 1 ? "" : "s"}. For a lender this tracks the size of the book rather than the safety of it.`,
      // A lender's gearing is not scored. The direction is worth showing; a red
      // dot next to it would be the industrial threshold coming back in.
      tone: model === "industrial" ? (r1 <= 40 ? "good" : r1 <= 100 ? "warn" : "bad") : "neutral",
    });
  }

  // Negative equity is the single most important thing on this chart when it
  // happens, and no ratio card will say it — they all divide by the number that
  // has gone negative. So it gets stated outright.
  if (last.equity != null && last.equity < 0) {
    insights.push({
      title: "Negative shareholder equity",
      detail: `${label}'s reported equity is ${compactCur(last.equity, sym)}. Its liabilities exceed its assets, so a debt-to-equity ratio isn't meaningful here.`,
      tone: "bad",
    });
  }

  // Operating cash flow against debt, for companies where that means something.
  // For a lender it does not: money lent out is an operating outflow, so the
  // ratio reads worst exactly when the book is growing fastest, and PFC's "1.5%
  // of its debt" was a description of a lender doing its job.
  if (ocf != null && debt != null && debt > 0 && showsCashFlowCoverage(model)) {
    const cover = (ocf / debt) * 100;
    insights.push({
      title: "Debt coverage",
      detail:
        // A company burning cash has NEGATIVE operating cash flow, and the
        // percentage form of that is gibberish: "covers only -36.0% of its
        // debt" invites the reader to compare it with 20% and conclude it is
        // merely low. It is not low, it is the wrong side of zero.
        ocf <= 0
          ? `${label}'s operating cash flow is negative (${compactCur(ocf, sym)}), so it isn't covering any of its ${compactCur(debt, sym)} debt.`
          : cover >= 100
          ? `${label}'s debt is more than covered by operating cash flow (${cover.toFixed(1)}%).`
          : cover >= 20
          ? `${label}'s debt is well covered by operating cash flow (${cover.toFixed(1)}%).`
          : `${label}'s operating cash flow covers only ${cover.toFixed(1)}% of its debt.`,
      tone: ocf <= 0 ? "bad" : cover >= 100 ? "good" : cover >= 20 ? "warn" : "bad",
    });
  }

  // ── Chart geometry ─────────────────────────────────────────────────────────
  const W = 820;
  const H = 300;
  const pad = 14;
  // The vertical domain must include NEGATIVE values.
  //
  // Equity can be negative — accumulated losses exceeding paid-in capital — and
  // this used to clamp every plotted point with Math.max(0, …) while computing
  // the scale the same way. A company with equity of -₹741K therefore produced
  // maxV = 1 and a line pinned flat along the baseline: a chart asserting
  // "equity is zero and unchanging" directly beneath a legend reading -₹741.0K.
  // The chart contradicted its own caption, and the flat line was the more
  // believable of the two.
  //
  // So the scale spans the real minimum to the real maximum, zero always
  // included, and points are plotted where they actually fall.
  const plotted = series.flatMap((s) => [s.equity, s.debt]).filter((v): v is number => v != null);
  const hiV = Math.max(1, ...plotted);
  const loV = Math.min(0, ...plotted);
  const spanV = hiV - loV || 1;
  /** True when something dips below zero, so the chart owes the reader a zero line. */
  const hasNegative = loV < 0;
  const X = (i: number) => pad + (i / (series.length - 1)) * (W - 2 * pad);
  const Y = (v: number) => H - pad - ((v - loV) / spanV) * (H - 2 * pad);
  const line = (key: "debt" | "equity") =>
    series
      .map((s, i) => `${X(i)},${Y(s[key] ?? 0)}`)
      .join(" ");
  const equityArea = `${X(0)},${Y(0)} ${line("equity")} ${X(series.length - 1)},${Y(0)}`;

  // Debt can be missing for a year now that total liabilities is no longer
  // substituted for it. Plot only the years we actually have, rather than
  // letting a `?? 0` drop the line to the baseline and invent a year of zero
  // borrowings.
  const debtPoints = series
    .map((s, i) => ({ i, v: s.debt }))
    .filter((p): p is { i: number; v: number } => p.v != null);
  const debtLine = debtPoints.map((p) => `${X(p.i)},${Y(p.v)}`).join(" ");

  // The heading has to match what is actually drawn. An equity line on its own
  // under the title "Debt to equity history" is the section claiming to show
  // something it does not have, which is how a missing field became an apparent
  // finding about the company.
  const heading = hasDebtHistory ? MODEL_HEADINGS[model] : EQUITY_ONLY_HEADING;

  // Fewer than three reported years can't carry a trend line — see YearBars.
  const sparse = series.length < 3;
  // A line needs two points to exist; a bar needs one. So a company with debt
  // reported in only its latest year shows that bar (matching the balance beam
  // directly below it) where the line chart could show nothing.
  const showDebt = sparse ? debtPoints.length >= 1 : debtPoints.length >= 2;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Financial health"
        title={heading.title}
        subtitle={heading.subtitle}
      />

      <GlassCard className="mt-6 p-5 sm:p-6">
        {/* Legend */}
        <div className="flex flex-wrap items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[#4F93F7]" />
            <span className="text-slate-300">Equity</span>
            <span className="font-mono text-slate-400">{compactCur(last.equity, sym)}</span>
          </span>
          {/* Only label a line the chart actually draws. A bank that reports no
              borrowings line has equity history and nothing to pair it with;
              the current debt figure still appears on the balance beam below. */}
          {showDebt ? (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[#FB7185]" />
              <span className="text-slate-300">Debt</span>
              <span className="font-mono text-slate-400">{compactCur(debt, sym)}</span>
            </span>
          ) : null}
          <span className="ml-auto font-mono text-slate-500">figures in {stmtCur}</span>
        </div>

        {/* Chart */}
        <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
          {sparse ? (
            <YearBars
              series={series.map((s) => ({ ...s, debt: showDebt ? s.debt : undefined }))}
              maxV={Math.max(1, ...plotted.map((v) => Math.abs(v)))}
              sym={sym}
              fmt={compactCur}
            />
          ) : (
            <>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 260 }} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="deEquity" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4F93F7" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#4F93F7" stopOpacity="0.02" />
                  </linearGradient>
                </defs>
                {/* Zero line, drawn only when something crosses it. Without it a
                    line below the axis floor is just a low line, and the reader
                    has no way to see that equity has gone negative. */}
                {hasNegative ? (
                  <>
                    <line
                      x1={pad}
                      x2={W - pad}
                      y1={Y(0)}
                      y2={Y(0)}
                      stroke="rgba(255,255,255,0.28)"
                      strokeWidth="1"
                      strokeDasharray="4 4"
                    />
                    <text x={pad + 2} y={Y(0) - 4} className="fill-slate-500" style={{ fontSize: 11 }}>
                      0
                    </text>
                  </>
                ) : null}
                <polygon points={equityArea} fill="url(#deEquity)" stroke="none" />
                <polyline points={line("equity")} fill="none" stroke="#4F93F7" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                {showDebt ? (
                  <polyline points={debtLine} fill="none" stroke="#FB7185" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                ) : null}
              </svg>
              <div className="mt-1 flex justify-between text-[0.6rem] text-slate-500">
                {series.map((s) => (
                  <span key={s.date} className="font-mono">{s.date?.slice(0, 4) ?? ""}</span>
                ))}
              </div>
            </>
          )}
        </div>

        {sparse ? (
          <p className="mt-2 text-[0.68rem] leading-relaxed text-slate-500">
            {label} has only {series.length} reported annual balance sheets, so these are shown as
            separate years rather than a trend line.
          </p>
        ) : null}

        {/* Balance beam, from ONE reporting date. The beam is a ratio drawn to
            scale, so a debt figure from one date against equity from another
            would be a picture of nothing. */}
        {latestAnnualDebt != null && latestAnnualDebt > 0 && latestAnnualEquity != null && latestAnnualEquity > 0 ? (
          <div className="mt-4">
            <Seesaw
              debt={latestAnnualDebt}
              equity={latestAnnualEquity}
              sym={sym}
              fmt={compactCur}
              model={model}
              asOf={last.date}
            />
          </div>
        ) : null}

        {/* The live borrowings figure, on its own card because it is a different
            statement from a different date. Shown when there is no annual debt
            to pair with equity, or when the two are far enough apart that a
            reader comparing them deserves to see both. */}
        {currentDebtSnapshot != null &&
        (latestAnnualDebt == null ||
          Math.abs(currentDebtSnapshot - latestAnnualDebt) > Math.abs(latestAnnualDebt) * 0.02) ? (
          <div className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
            <div className="text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
              Latest reported borrowings
            </div>
            <p className="mt-1 font-display text-xl font-semibold text-white">
              {compactCur(currentDebtSnapshot, sym)}
            </p>
            <p className="mt-1 text-[0.65rem] leading-relaxed text-slate-500">
              The most recent figure the data source carries, which is usually a quarterly balance
              sheet. It is kept separate from the annual figures above rather than being written
              into them, because a ratio needs both halves from the same date.
            </p>
          </div>
        ) : null}

        {/* Said plainly when the borrowings history simply is not published. */}
        {!hasDebtHistory ? (
          <p className="mt-4 rounded-lg border border-gold/25 bg-gold/[0.05] p-3 text-[0.68rem] leading-relaxed text-slate-300">
            Historical borrowings are not available for {label} from the current data source, so the
            chart above shows equity alone. That is a gap in the data rather than a company with no
            borrowings.
          </p>
        ) : null}

        {/* Insights */}
        {insights.length ? (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {insights.map((c) => (
              <Insight key={c.title} title={c.title} detail={c.detail} tone={c.tone} />
            ))}
          </div>
        ) : null}

        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Debt is interest-bearing borrowings; equity is total shareholder equity, both from the last few reported
          annual balance sheets. Research context, not advice.
        </p>
      </GlassCard>
    </section>
  );
}
