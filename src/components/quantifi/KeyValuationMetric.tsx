"use client";

import { useEffect, useState } from "react";
import { GlassCard, SectionHeading } from "@/components/quantifi/Cards";
import type { CompanyData } from "@/lib/yahooCompany";
import { fmtCompactCur, isIndianCurrency } from "@/data/demo";

// "Which multiple should you actually judge this company on?" — the tabs let you
// switch lens (P/E, P/S, P/B), and the donut shows WHY the ratio is what it is:
// the ring is market cap, the gold slice is the thing you're dividing by
// (earnings / revenue / book value). A tiny slice = an expensive stock.

type Tab = "pe" | "ps" | "pb" | "other";

const TABS: { key: Tab; label: string }[] = [
  { key: "pe", label: "PE" },
  { key: "ps", label: "PS" },
  { key: "pb", label: "PB" },
  { key: "other", label: "Others" },
];

function Donut({
  fraction,
  centerTop,
  centerBottom,
  sliceLabel,
  sliceValue,
}: {
  fraction: number; // 0..1 — denominator ÷ market cap
  centerTop: string;
  centerBottom: string;
  sliceLabel: string;
  sliceValue: string;
}) {
  const size = 230;
  const thickness = 40;
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const len = Math.max(0, Math.min(1, fraction)) * circ;

  return (
    <div className="flex flex-col items-center">
      <div className="text-center">
        <div className="text-xs text-slate-400">{sliceLabel}</div>
        <div className="font-mono text-sm text-gold">{sliceValue}</div>
      </div>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={`${sliceLabel} against market cap`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(148,163,184,0.22)" strokeWidth={thickness} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke="#D4AF37"
            strokeWidth={thickness}
            strokeDasharray={`${len} ${circ - len}`}
            strokeLinecap="butt"
          />
        </g>
        <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-300" style={{ fontSize: 13 }}>
          {centerTop}
        </text>
        <text x="50%" y="57%" textAnchor="middle" dominantBaseline="middle" className="fill-white font-display font-semibold" style={{ fontSize: 18 }}>
          {centerBottom}
        </text>
      </svg>
    </div>
  );
}

export default function KeyValuationMetric({ symbol, name }: { symbol: string; name?: string }) {
  const [data, setData] = useState<CompanyData | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("pe");
  const [forward, setForward] = useState(false);

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
        <div className="h-56 animate-pulse rounded-lg border border-white/[0.06] bg-white/[0.02]" />
      </section>
    );
  }
  if (!data) return null;

  const label = name ?? data.name ?? symbol;
  const cur = data.financialCurrency ?? data.currency;
  const indian = isIndianCurrency(cur, symbol);
  const money = (n?: number) => fmtCompactCur(n, indian, "—");
  const mc = data.marketCap;

  // Book equity from the latest balance sheet, else derived from P/B.
  const equity =
    data.balanceSheets?.[0]?.values.totalEquity ??
    (data.priceToBook && mc ? mc / data.priceToBook : undefined);

  const profitable = (data.netIncome ?? 0) > 0;

  // Per-tab: the ratio, the denominator it divides by, and why it's the right lens.
  const views: Record<Exclude<Tab, "other">, {
    ratio?: number;
    unit: string;
    denom?: number;
    denomLabel: string;
    why: string;
    full: string;
  }> = {
    pe: {
      ratio: forward ? data.forwardPE : data.trailingPE,
      unit: "x",
      denom: data.netIncome,
      denomLabel: "Earnings",
      full: forward ? "Forward Price-To-Earnings Ratio" : "Price-To-Earnings Ratio",
      why: profitable
        ? `As ${label} is profitable we use its Price-To-Earnings Ratio for relative valuation analysis.`
        : `${label} isn't currently profitable, so an earnings multiple is less meaningful — check the PS tab instead.`,
    },
    ps: {
      ratio: data.priceToSales,
      unit: "x",
      denom: data.revenue,
      denomLabel: "Revenue",
      full: "Price-To-Sales Ratio",
      why: profitable
        ? `A sales multiple is useful as a cross-check, and is the primary lens when earnings are thin or negative.`
        : `As ${label} isn't yet profitable we use its Price-To-Sales Ratio for relative valuation analysis.`,
    },
    pb: {
      ratio: data.priceToBook,
      unit: "x",
      denom: equity,
      denomLabel: "Book value",
      full: "Price-To-Book Ratio",
      why: `Price-To-Book compares the market value against the company's net assets — the standard lens for banks, insurers and asset-heavy businesses.`,
    },
  };

  const others = [
    { label: "EV / EBITDA", value: data.evToEbitda, unit: "x" },
    { label: "EV / Revenue", value: data.evToRevenue, unit: "x" },
    { label: "PEG ratio", value: data.pegRatio, unit: "" },
    { label: "Price / Free cash flow", value: mc && data.freeCashflow && data.freeCashflow > 0 ? mc / data.freeCashflow : undefined, unit: "x" },
  ];

  const v = tab === "other" ? null : views[tab];
  const fraction = v?.denom != null && mc != null && mc > 0 && v.denom > 0 ? v.denom / mc : 0;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Valuation"
        title="Key valuation metric"
        subtitle={`Which multiple is the right lens for ${label} — and what sits underneath it.`}
      />

      <GlassCard className="mt-6 p-5 sm:p-6">
        {/* Tabs */}
        <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-md px-4 py-1.5 text-sm transition ${
                tab === t.key ? "bg-gold/15 font-medium text-gold" : "text-slate-400 hover:text-white"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "other" ? (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {others.map((o) => (
              <div key={o.label} className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-4">
                <div className="text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">{o.label}</div>
                <div className="mt-2 font-display text-2xl font-semibold text-white">
                  {o.value != null && isFinite(o.value) ? `${o.value.toFixed(1)}${o.unit}` : "—"}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
            {/* Why this metric */}
            <div className="rounded-lg border border-gold/20 bg-gold/[0.06] p-4">
              <div className="flex items-start gap-2.5">
                <span className="mt-px flex h-5 w-5 flex-none items-center justify-center rounded-full bg-gold/20 text-gold">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                    <path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 20.5l1.4-6.8L2.2 9l6.9-.7Z" />
                  </svg>
                </span>
                <p className="text-sm leading-relaxed text-slate-200">
                  <span className="font-medium text-gold">Key metric: </span>
                  {v!.why}
                </p>
              </div>
            </div>

            {/* Donut */}
            <Donut
              fraction={fraction}
              centerTop="Market cap"
              centerBottom={money(mc)}
              sliceLabel={v!.denomLabel}
              sliceValue={money(v!.denom)}
            />

            {/* The ratio */}
            <div className="text-center lg:text-left">
              <div className="font-display text-5xl font-semibold text-white">
                {v!.ratio != null && isFinite(v!.ratio) ? `${v!.ratio.toFixed(1)}${v!.unit}` : "—"}
              </div>
              <div className="mt-1 text-sm text-slate-400">{v!.full}</div>
              {tab === "pe" && data.forwardPE != null ? (
                <button
                  type="button"
                  onClick={() => setForward((f) => !f)}
                  className="mt-4 inline-flex items-center gap-2 text-xs text-slate-400 transition hover:text-white"
                >
                  <span
                    className={`relative h-5 w-9 flex-none rounded-full transition ${
                      forward ? "bg-gold/70" : "bg-white/15"
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${
                        forward ? "left-[1.15rem]" : "left-0.5"
                      }`}
                    />
                  </span>
                  Forward PE
                </button>
              ) : null}
            </div>
          </div>
        )}

        <p className="mt-5 text-xs leading-relaxed text-slate-500">
          The ring is market capitalisation; the gold slice is what the multiple divides by — a thin slice means you
          are paying a lot per unit of earnings, sales or book value. Figures in {cur ?? "the listed currency"}.
          Research context, not advice.
        </p>
      </GlassCard>
    </section>
  );
}
