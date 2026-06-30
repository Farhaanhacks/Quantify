"use client";

import { useEffect, useState } from "react";
import { GlassCard, Donut } from "@/components/quantifi/Cards";
import type { CompanyData } from "@/lib/yahooCompany";
import type { InstQuarter } from "@/lib/institutional";

const PALETTE = ["#818CF8", "#E9B872", "#4FD1C5", "#34D399", "#F472B6", "#FB7185", "#94A3B8"];

function compact(n?: number): string {
  if (n == null || !isFinite(n)) return "—";
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}${(a / 1e3).toFixed(1)}K`;
  return `${s}${Math.round(a)}`;
}

export default function ShareholdingStats({ symbol }: { symbol: string }) {
  const [data, setData] = useState<CompanyData | null | undefined>(undefined);
  const [hist, setHist] = useState<InstQuarter[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    setHist(null);
    (async () => {
      try {
        const [cr, hr] = await Promise.allSettled([
          fetch(`/api/company/${encodeURIComponent(symbol)}`).then((r) => r.json()),
          fetch(`/api/inst-ownership/${encodeURIComponent(symbol)}`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        setData(cr.status === "fulfilled" && cr.value?.available ? (cr.value.data as CompanyData) : null);
        if (hr.status === "fulfilled" && hr.value?.available) setHist(hr.value.rows as InstQuarter[]);
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
      <section className="mx-auto max-w-7xl px-4 pb-6 sm:px-6 lg:px-8">
        <div className="h-56 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]" />
      </section>
    );
  }

  const holders = data?.topInstitutionalHolders ?? [];
  const own = data?.ownership;
  const hasHolders = holders.length > 0;
  const hasOwn = own && (own.institutionsPct != null || own.insidersPct != null);
  const hasHist = hist && hist.length > 0;
  if (!hasHolders && !hasOwn && !hasHist) return null;

  // Top holders donut
  const holderSegs = holders.map((h, i) => ({
    name: h.name,
    pct: Math.round((h.pctHeld ?? 0) * 10000) / 100,
    color: PALETTE[i % PALETTE.length],
  }));
  const holderSum = holderSegs.reduce((s, x) => s + x.pct, 0);
  if (holderSum < 100) holderSegs.push({ name: "Other", pct: Math.round((100 - holderSum) * 100) / 100, color: "#475569" });

  // Ownership split donut (institutions / insiders / public float)
  const instPct = (own?.institutionsPct ?? 0) * 100;
  const insidPct = (own?.insidersPct ?? 0) * 100;
  const floatPct = Math.max(0, 100 - instPct - insidPct);
  const ownSegs = [
    { name: "Institutions", pct: Math.round(instPct * 100) / 100, color: "#818CF8" },
    { name: "Insiders", pct: Math.round(insidPct * 100) / 100, color: "#E9B872" },
    { name: "Public float", pct: Math.round(floatPct * 100) / 100, color: "#4FD1C5" },
  ].filter((s) => s.pct > 0);

  const maxShares = hasHist ? Math.max(...hist!.map((q) => q.sharesHeld)) || 1 : 1;

  return (
    <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
      <h3 className="font-display text-lg font-semibold text-white">Shareholding</h3>
      <p className="mt-1 text-xs text-slate-500">Who owns the stock — from public 13F / ownership disclosures.</p>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Top institutional holders */}
        {hasHolders ? (
          <GlassCard className="p-5">
            <h4 className="font-display text-base font-semibold text-white">Top institutional holders</h4>
            <div className="mt-3 flex flex-col items-center gap-5 sm:flex-row">
              <Donut segments={holderSegs} size={150} centerValue={`${holderSegs[0]?.pct ?? 0}%`} centerLabel="top holder" />
              <ul className="flex-1 space-y-1.5">
                {holderSegs.map((s) => (
                  <li key={s.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 truncate text-slate-300">
                      <span className="h-2 w-2 flex-none rounded-sm" style={{ backgroundColor: s.color }} />
                      <span className="truncate">{s.name}</span>
                    </span>
                    <span className="flex-none font-mono tnum text-slate-400">{s.pct.toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </GlassCard>
        ) : null}

        {/* Ownership split */}
        {hasOwn ? (
          <GlassCard className="p-5">
            <div className="flex items-center justify-between">
              <h4 className="font-display text-base font-semibold text-white">Ownership split</h4>
              {own?.institutionsCount ? (
                <span className="text-[0.65rem] text-slate-500">{own.institutionsCount.toLocaleString()} institutions</span>
              ) : null}
            </div>
            <div className="mt-3 flex flex-col items-center gap-5 sm:flex-row">
              <Donut segments={ownSegs} size={150} centerValue={`${ownSegs[0]?.pct.toFixed(0) ?? 0}%`} centerLabel="institutions" />
              <ul className="flex-1 space-y-1.5">
                {ownSegs.map((s) => (
                  <li key={s.name} className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-2 text-slate-300">
                      <span className="h-2 w-2 flex-none rounded-sm" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </span>
                    <span className="font-mono tnum text-slate-400">{s.pct.toFixed(2)}%</span>
                  </li>
                ))}
              </ul>
            </div>
          </GlassCard>
        ) : null}
      </div>

      {/* Institutional shareholding over time */}
      {hasHist ? (
        <GlassCard className="mt-4 p-5">
          <h4 className="font-display text-base font-semibold text-white">Institutional Shareholding</h4>
          <p className="mt-1 text-xs text-slate-500">Quarterly 13F aggregates — shares held and the % of shares outstanding.</p>

          {/* Bar chart */}
          <div className="mt-5 flex h-36 items-end gap-2 border-b border-white/[0.08]">
            {hist!.slice().reverse().map((q) => (
              <div key={q.date} className="flex flex-1 flex-col items-center justify-end">
                <span className="text-[0.55rem] text-slate-400">{q.ownershipPct ? `${q.ownershipPct.toFixed(0)}%` : ""}</span>
                <div
                  className="mt-1 w-full max-w-[34px] rounded-t bg-indigo-400/80"
                  style={{ height: `${Math.max(4, (q.sharesHeld / maxShares) * 100)}px` }}
                  title={`${compact(q.sharesHeld)} shares`}
                />
                <span className="mt-1 text-[0.5rem] text-slate-500">{q.period.replace(/^\d{2}/, "")}</span>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/[0.06] text-[0.6rem] uppercase tracking-[0.12em] text-slate-500">
                  <th className="py-2 text-left font-normal">Period</th>
                  <th className="py-2 text-right font-normal">Institutions</th>
                  <th className="py-2 text-right font-normal">Shares held</th>
                  <th className="py-2 text-right font-normal">Proportion</th>
                  <th className="py-2 text-right font-normal">Change</th>
                </tr>
              </thead>
              <tbody>
                {hist!.map((q) => (
                  <tr key={q.date} className="border-b border-white/[0.04]">
                    <td className="py-2 text-slate-200">{q.period}</td>
                    <td className="py-2 text-right font-mono tnum text-slate-300">{q.institutions.toLocaleString()}</td>
                    <td className="py-2 text-right font-mono tnum text-slate-300">{compact(q.sharesHeld)}</td>
                    <td className="py-2 text-right font-mono tnum text-slate-300">{q.ownershipPct ? `${q.ownershipPct.toFixed(2)}%` : "—"}</td>
                    <td className={`py-2 text-right font-mono tnum ${q.sharesChange >= 0 ? "text-up" : "text-down"}`}>
                      {q.sharesChange >= 0 ? "+" : ""}{compact(q.sharesChange)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </GlassCard>
      ) : (
        <GlassCard className="mt-4 p-5 text-center text-xs text-slate-500">
          Quarterly institutional-ownership history needs a connected data source (set
          <span className="mx-1 font-mono text-slate-400">FMP_API_KEY</span>). Top holders and the ownership
          split above are live from public disclosures.
        </GlassCard>
      )}
    </section>
  );
}
