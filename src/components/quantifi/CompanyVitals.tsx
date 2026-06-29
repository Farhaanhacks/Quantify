"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/quantifi/Cards";
import SupportResistanceChart from "@/components/quantifi/SupportResistanceChart";
import type { CompanyData } from "@/lib/yahooCompany";
import { toneOf } from "@/lib/newsImpact";

const cur = (c?: string, ticker?: string) =>
  c === "INR" || (ticker && /\.(NS|BO)$/i.test(ticker)) ? "₹" : c === "GBp" ? "p" : "$";

function compact(n?: number): string {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return `${Math.round(n)}`;
}

function fmtDate(d?: string): string {
  if (!d) return "—";
  const t = Date.parse(d);
  if (isNaN(t)) return d;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Reusable 180° gauge. value is 0..1; needle + coloured arc to that point.
function Gauge({ value, color, label, sub }: { value: number; color: string; label: string; sub?: string }) {
  const v = Math.max(0, Math.min(1, value));
  const LEN = Math.PI * 80; // arc length for r=80
  const theta = Math.PI * (1 - v);
  const dotX = 100 + 80 * Math.cos(theta);
  const dotY = 95 - 80 * Math.sin(theta);
  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-full max-w-[220px]">
        <path d="M 20 95 A 80 80 0 0 1 180 95" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" strokeLinecap="round" />
        <path
          d="M 20 95 A 80 80 0 0 1 180 95"
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${v * LEN} ${LEN}`}
        />
        <circle cx={dotX} cy={dotY} r="6" fill={color} stroke="#05070D" strokeWidth="2" />
      </svg>
      <div className="-mt-6 text-center">
        <div className="font-display text-lg font-semibold" style={{ color }}>{label}</div>
        {sub ? <div className="text-[0.7rem] text-slate-500">{sub}</div> : null}
      </div>
    </div>
  );
}

const RATING: Record<string, { score: number; label: string; color: string }> = {
  strong_buy: { score: 0.94, label: "Strong Buy", color: "#34D399" },
  buy: { score: 0.74, label: "Buy", color: "#4FD1C5" },
  hold: { score: 0.5, label: "Hold", color: "#E9B872" },
  underperform: { score: 0.28, label: "Underperform", color: "#FB7185" },
  sell: { score: 0.08, label: "Sell", color: "#F43F5E" },
};

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5">
      <div className="text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">{label}</div>
      <div className="mt-1 font-mono text-base font-semibold tnum text-white">{value}</div>
      {sub ? <div className="mt-0.5 text-[0.68rem] text-slate-500">{sub}</div> : null}
    </div>
  );
}

export default function CompanyVitals({ symbol }: { symbol: string }) {
  const [data, setData] = useState<CompanyData | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    (async () => {
      try {
        const r = await fetch(`/api/company/${encodeURIComponent(symbol)}`);
        const d = await r.json();
        if (!cancelled) setData(d?.available && d?.data ? (d.data as CompanyData) : null);
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (data === undefined) {
    return (
      <section className="mx-auto max-w-7xl px-4 pb-4 sm:px-6 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
          ))}
        </div>
      </section>
    );
  }
  if (!data) return null;

  const c = cur(data.currency, symbol);
  const price = data.price ?? 0;
  const rating = RATING[(data.recommendationKey || "").toLowerCase()];
  const upside = data.targetMean && price ? ((data.targetMean - price) / price) * 100 : null;

  const revPerEmp = data.revenue && data.employees ? data.revenue / data.employees : undefined;
  const earnPerEmp = data.netIncome && data.employees ? data.netIncome / data.employees : undefined;

  // Media coverage gauge from recent headline tone.
  const news = data.news ?? [];
  let pos = 0;
  let neg = 0;
  for (const n of news) {
    const t = toneOf(n.title);
    if (t === "positive") pos++;
    else if (t === "negative") neg++;
  }
  const coverageScore = news.length ? Math.max(0.05, Math.min(0.95, 0.5 + (pos - neg) / (news.length * 2))) : 0.5;
  const coverageLabel = !news.length ? "Low" : pos > neg ? "Positive" : neg > pos ? "Negative" : "Neutral";
  const coverageColor = coverageLabel === "Positive" ? "#34D399" : coverageLabel === "Negative" ? "#FB7185" : "#E9B872";

  return (
    <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Analyst rating gauge */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-white">Analyst Rating</h3>
            <span className="text-[0.65rem] text-slate-500">
              {data.numberOfAnalysts ? `${data.numberOfAnalysts} analysts` : "—"}
            </span>
          </div>
          <div className="mt-3">
            {rating ? (
              <Gauge value={rating.score} color={rating.color} label={rating.label} />
            ) : (
              <p className="py-6 text-center text-sm text-slate-500">No analyst rating available.</p>
            )}
          </div>
          <div className="mt-2 grid grid-cols-2 gap-3 border-t border-white/[0.06] pt-3">
            <div>
              <div className="text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">Target price</div>
              <div className="mt-0.5 font-mono text-sm tnum text-white">
                {data.targetMean ? `${c}${data.targetMean.toFixed(2)}` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">Upside</div>
              <div className={`mt-0.5 font-mono text-sm tnum ${upside == null ? "text-slate-500" : upside >= 0 ? "text-up" : "text-down"}`}>
                {upside == null ? "—" : `${upside >= 0 ? "+" : ""}${upside.toFixed(1)}%`}
              </div>
            </div>
          </div>
          {data.targetLow != null && data.targetHigh != null ? (
            <p className="mt-2 text-[0.65rem] text-slate-500">
              Range {c}{data.targetLow.toFixed(0)} – {c}{data.targetHigh.toFixed(0)}
            </p>
          ) : null}
        </GlassCard>

        {/* Company facts */}
        <GlassCard className="p-5">
          <h3 className="font-display text-base font-semibold text-white">Company facts</h3>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <Stat label="Employees" value={data.employees ? data.employees.toLocaleString() : "—"} />
            <Stat label="Next earnings" value={fmtDate(data.earningsDate)} />
            <Stat label="Revenue / employee" value={revPerEmp ? `${c}${compact(revPerEmp)}` : "—"} />
            <Stat
              label="Earnings / employee"
              value={earnPerEmp ? `${earnPerEmp < 0 ? "-" : ""}${c}${compact(Math.abs(earnPerEmp))}` : "—"}
              sub={earnPerEmp != null && earnPerEmp < 0 ? "net loss" : undefined}
            />
          </div>
          <div className="mt-3 border-t border-white/[0.06] pt-3 text-[0.7rem] text-slate-500">
            {data.sector ? <span>{data.sector}</span> : null}
            {data.industry ? <span> · {data.industry}</span> : null}
          </div>
        </GlassCard>

        {/* Media coverage gauge */}
        <GlassCard className="p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-white">Media Coverage</h3>
            <span className="text-[0.65rem] text-slate-500">{news.length} recent</span>
          </div>
          <div className="mt-3">
            <Gauge value={coverageScore} color={coverageColor} label={coverageLabel} sub="headline tone" />
          </div>
          <p className="mt-2 text-[0.65rem] leading-relaxed text-slate-500">
            Derived from the tone of recent headlines — context, not a sentiment score to trade on.
          </p>
        </GlassCard>

        {/* Support & resistance */}
        <GlassCard className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-white">Support &amp; Resistance</h3>
            <div className="flex flex-wrap gap-x-4 text-[0.62rem] text-slate-500">
              {data.fiftyDayAvg ? <span>50d <span className="font-mono text-slate-300">{c}{data.fiftyDayAvg.toFixed(2)}</span></span> : null}
              {data.twoHundredDayAvg ? <span>200d <span className="font-mono text-slate-300">{c}{data.twoHundredDayAvg.toFixed(2)}</span></span> : null}
            </div>
          </div>
          <SupportResistanceChart symbol={symbol} currency={data.currency} />
        </GlassCard>

        {/* Top fund / ETF holders */}
        <GlassCard className="p-5">
          <h3 className="font-display text-base font-semibold text-white">Top fund &amp; ETF holders</h3>
          {data.topFundHolders?.length ? (
            <ul className="mt-3 space-y-2">
              {data.topFundHolders.map((h) => (
                <li key={h.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate text-slate-300">{h.name}</span>
                  <span className="flex-none font-mono tnum text-slate-400">
                    {h.pctHeld != null ? `${(h.pctHeld * 100).toFixed(2)}%` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No fund/ETF ownership disclosed for this name.</p>
          )}
          <p className="mt-3 text-[0.65rem] text-slate-500">% of shares held, from public fund disclosures.</p>
        </GlassCard>
      </div>
    </section>
  );
}
