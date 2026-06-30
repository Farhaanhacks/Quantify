"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  GlassCard,
  SectionHeading,
  Donut,
  BarMeter,
  Tag,
} from "@/components/quantifi/Cards";
import { usePortfolios } from "@/lib/usePortfolios";
import { sectorForTicker, regionForTicker } from "@/data/sectors";

type Level = "Moderate" | "Elevated" | "High";
const levelTone: Record<Level, "up" | "gold" | "down"> = {
  Moderate: "up",
  Elevated: "gold",
  High: "down",
};
const PALETTE = ["#E9B872", "#4FD1C5", "#818CF8", "#F472B6", "#34D399", "#94A3B8", "#FB7185"];
const toneFor = (pct: number): Level => (pct >= 40 ? "High" : pct >= 25 ? "Elevated" : "Moderate");

interface Seg {
  name: string;
  pct: number;
  color: string;
}
interface Note {
  label: string;
  detail: string;
  level: Level;
}

interface ResolvedItem {
  ticker: string;
  value: number;
  sector: string;
  region: string;
}

function computeBook(items: ResolvedItem[]) {
  const total = items.reduce((s, i) => s + i.value, 0) || 1;
  const weights = items
    .map((i) => ({ ticker: i.ticker, pct: Math.round((i.value / total) * 100) }))
    .sort((a, b) => b.pct - a.pct);

  const agg = (key: "sector" | "region"): Seg[] => {
    const m: Record<string, number> = {};
    for (const i of items) {
      const k = (i[key] || "Other").toString();
      m[k] = (m[k] ?? 0) + i.value;
    }
    return Object.entries(m)
      .map(([name, v]) => ({ name, pct: Math.round((v / total) * 100) }))
      .sort((a, b) => b.pct - a.pct)
      .map((s, idx): Seg => ({ ...s, color: PALETTE[idx % PALETTE.length] }));
  };

  const sectorSegs = agg("sector");
  const regionSegs = agg("region");
  const notes: Note[] = [
    {
      label: "Single-name concentration",
      detail: weights[0]
        ? `${weights[0].ticker} is your largest position at ${weights[0].pct}% of your portfolio.`
        : "No positions yet.",
      level: toneFor(weights[0]?.pct ?? 0),
    },
    {
      label: "Sector concentration",
      detail: sectorSegs[0] ? `${sectorSegs[0].name} leads your portfolio at ${sectorSegs[0].pct}%.` : "—",
      level: toneFor(sectorSegs[0]?.pct ?? 0),
    },
    {
      label: "Regional mix",
      detail: regionSegs[0] ? `${regionSegs[0].name} is your largest region at ${regionSegs[0].pct}%.` : "—",
      level: toneFor(regionSegs[0]?.pct ?? 0),
    },
  ];
  return { weights, sectorSegs, regionSegs, notes };
}

export default function Diversification({ heading = true }: { heading?: boolean }) {
  const { portfolios, ready } = usePortfolios();
  const saved = ready ? portfolios[0]?.holdings ?? [] : [];
  const isReal = saved.length > 0;

  // For any held ticker not in the static sector map, fetch its real sector live.
  const [liveSectors, setLiveSectors] = useState<Record<string, string>>({});
  const tickersKey = saved.map((h) => h.ticker.toUpperCase()).sort().join(",");
  useEffect(() => {
    if (!tickersKey) return;
    const unknown = tickersKey.split(",").filter(Boolean).filter((t) => !sectorForTicker(t));
    if (!unknown.length) return;
    let cancelled = false;
    (async () => {
      const found: Record<string, string> = {};
      await Promise.all(
        unknown.map(async (t) => {
          try {
            const r = await fetch(`/api/company/${encodeURIComponent(t)}`);
            const d = await r.json();
            const sec = d?.data?.sector;
            if (typeof sec === "string" && sec.trim()) found[t] = sec.trim();
          } catch {
            /* leave as Other */
          }
        })
      );
      if (!cancelled && Object.keys(found).length) {
        setLiveSectors((prev) => ({ ...prev, ...found }));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tickersKey]);

  const resolved: ResolvedItem[] = saved.map((h) => {
    const t = h.ticker.toUpperCase();
    return {
      ticker: h.ticker,
      value: h.shares * h.price,
      sector: sectorForTicker(t) ?? liveSectors[t] ?? "Other",
      region: regionForTicker(t),
    };
  });

  const book = isReal ? computeBook(resolved) : null;

  const sectorSegs: Seg[] = book ? book.sectorSegs : [];
  const regionSegs: Seg[] = book ? book.regionSegs : [];
  const notes: Note[] = book ? book.notes : [];
  const weights = book ? book.weights : [];

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Diversification & Risk"
          title="How concentrated is your Portfolio?"
          subtitle="A risk lens across sectors, individual holdings and where they're listed — computed from your real holdings."
        />
      ) : null}

      {!isReal ? (
        <GlassCard className="mt-6 p-10 text-center">
          <p className="text-sm text-slate-300">Add your first holding to start portfolio analysis.</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
            Your sector mix, regional split and concentration risk are computed from the holdings you
            add — nothing is shown until you build a portfolio.
          </p>
          <Link
            href="/portfolio"
            className="mt-5 inline-flex rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-5 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Build your portfolio →
          </Link>
        </GlassCard>
      ) : (
      <>
      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <GlassCard className="p-5">
          <h3 className="font-display text-base font-semibold text-white">Concentration risk</h3>
          <ul className="mt-4 space-y-4">
            {notes.map((c) => (
              <li key={c.label}>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-slate-200">{c.label}</span>
                  <Tag tone={levelTone[c.level]}>{c.level}</Tag>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{c.detail}</p>
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="font-display text-base font-semibold text-white">By sector</h3>
          <div className="mt-3 flex items-center justify-center">
            <Donut segments={sectorSegs} centerValue={`${sectorSegs[0]?.pct ?? 0}%`} centerLabel="top sector" />
          </div>
          <ul className="mt-4 space-y-1.5">
            {sectorSegs.map((s) => (
              <li key={s.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
                  {s.name}
                </span>
                <span className="font-mono tnum text-slate-400">{s.pct}%</span>
              </li>
            ))}
          </ul>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="font-display text-base font-semibold text-white">Holdings by region</h3>
          <div className="mt-3 flex items-center justify-center">
            <Donut segments={regionSegs} centerValue={`${regionSegs[0]?.pct ?? 0}%`} centerLabel="top region" />
          </div>
          <ul className="mt-4 space-y-1.5">
            {regionSegs.map((s) => (
              <li key={s.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-slate-300">
                  <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
                  {s.name}
                </span>
                <span className="font-mono tnum text-slate-400">{s.pct}%</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>

      <GlassCard className="mt-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-white">Diversification across holdings</h3>
          <span className="text-xs text-slate-500">{weights.length} positions</span>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
          {weights.map((h, i) => (
            <BarMeter key={h.ticker} label={h.ticker} value={h.pct} color={PALETTE[i % PALETTE.length]} />
          ))}
        </div>
      </GlassCard>
      </>
      )}
    </section>
  );
}
