"use client";

import { useEffect, useState } from "react";
import {
  GlassCard,
  SectionHeading,
  BarMeter,
  Tag,
  Skeleton,
  SamplePreview,
} from "@/components/quantifi/Cards";
import { usePortfolios } from "@/lib/usePortfolios";
import { sectorForTicker, regionForTicker } from "@/data/sectors";
import { SAMPLE_HOLDINGS, SAMPLE_USDINR } from "@/data/samplePortfolio";

type Level = "Moderate" | "Elevated" | "High";
const levelTone: Record<Level, "up" | "gold" | "down"> = {
  Moderate: "up",
  Elevated: "gold",
  High: "down",
};
const PALETTE = ["#4F93F7", "#4FD1C5", "#818CF8", "#F472B6", "#34D399", "#94A3B8", "#FB7185"];
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

// Donut + legend with synced hover: hovering a slice (or its legend row) dims the
// other arcs and shows that slice's % + name in the centre; idle shows a headline
// (e.g. the top sector). Kept in a vertical stack (ring above legend) to match the
// concentration cards' existing layout.
function InteractiveDonut({
  segments,
  idleValue,
  idleLabel,
  size = 168,
  thickness = 18,
}: {
  segments: Seg[];
  idleValue: string;
  idleLabel: string;
  size?: number;
  thickness?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  const total = segments.reduce((s, x) => s + (x.pct > 0 ? x.pct : 0), 0);
  const denom = Math.max(100, total); // never over-fill the ring
  const active = hover != null ? segments[hover] : null;
  const bigText = active ? `${active.pct}%` : idleValue;
  const smallText = active
    ? active.name.length > 16
      ? `${active.name.slice(0, 15)}…`
      : active.name
    : idleLabel;
  let offset = 0;

  return (
    <div>
      <div className="flex items-center justify-center">
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Concentration donut">
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
            {segments.map((seg, i) => {
              const len = (Math.max(0, seg.pct) / denom) * circ;
              const dash = `${len} ${circ - len}`;
              const el = (
                <circle
                  key={seg.name}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  opacity={hover == null || hover === i ? 1 : 0.3}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "pointer", transition: "opacity 0.15s" }}
                />
              );
              offset += len;
              return el;
            })}
          </g>
          <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-white font-display font-semibold" style={{ fontSize: 26 }}>
            {bigText}
          </text>
          <text x="50%" y="61%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-400" style={{ fontSize: 11 }}>
            {smallText}
          </text>
        </svg>
      </div>
      <ul className="mt-4 space-y-1">
        {segments.map((s, i) => (
          <li
            key={s.name}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={`flex cursor-default items-center justify-between gap-2 rounded-md px-2 py-1 text-xs transition ${
              hover === i ? "bg-white/[0.05]" : ""
            }`}
          >
            <span className="flex min-w-0 items-center gap-2 text-slate-300">
              <span className="h-2 w-2 flex-none rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="truncate">{s.name}</span>
            </span>
            <span className="flex-none font-mono tnum text-slate-400">{s.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Book = ReturnType<typeof computeBook>;

// The full risk read-out. Extracted so the sample preview renders exactly what a
// real portfolio renders, rather than a hand-built marketing mock.
function RiskBody({ book }: { book: Book }) {
  const { sectorSegs, regionSegs, notes, weights } = book;
  return (
    <>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
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
          <div className="mt-3">
            <InteractiveDonut segments={sectorSegs} idleValue={`${sectorSegs[0]?.pct ?? 0}%`} idleLabel="top sector" />
          </div>
        </GlassCard>

        <GlassCard className="p-5">
          <h3 className="font-display text-base font-semibold text-white">Holdings by region</h3>
          <div className="mt-3">
            <InteractiveDonut segments={regionSegs} idleValue={`${regionSegs[0]?.pct ?? 0}%`} idleLabel="top region" />
          </div>
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
  );
}

// Three cards with a ring-shaped placeholder each — the same silhouette the real
// donuts occupy, so nothing jumps when the numbers land.
function RiskSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <GlassCard className="p-5">
        <Skeleton className="h-4 w-40" />
        <ul className="mt-5 space-y-5">
          {[0, 1, 2].map((i) => (
            <li key={i}>
              <div className="flex items-center justify-between gap-3">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="mt-2 h-2.5 w-full" />
            </li>
          ))}
        </ul>
      </GlassCard>
      {[0, 1].map((i) => (
        <GlassCard key={i} className="p-5">
          <Skeleton className="h-4 w-28" />
          <div className="mt-5 flex justify-center">
            <Skeleton className="h-[168px] w-[168px] rounded-full" />
          </div>
          <div className="mt-5 space-y-2">
            {[0, 1, 2].map((j) => (
              <div key={j} className="flex items-center justify-between gap-3 px-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-8" />
              </div>
            ))}
          </div>
        </GlassCard>
      ))}
    </div>
  );
}

const SAMPLE_BOOK = computeBook(
  SAMPLE_HOLDINGS.map((h) => ({
    ticker: h.ticker,
    // Sample INR positions are converted at the sample FX rate so one currency
    // doesn't dominate the weights purely through its unit size.
    value: h.shares * h.price * (h.currency === "INR" ? 1 / SAMPLE_USDINR : 1),
    sector: h.sector,
    region: h.region,
  }))
);

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

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Diversification & Risk"
          title="How concentrated is your Portfolio?"
          subtitle="A risk lens across sectors, individual holdings and where they're listed — computed from your real holdings."
        />
      ) : null}

      {!ready ? (
        <div className="mt-6">
          <RiskSkeleton />
        </div>
      ) : !book ? (
        // Nothing saved yet: run the same analysis over an example book so the
        // section shows what it does instead of an empty card.
        <SamplePreview
          className="mt-6"
          note="Example book. Add your holdings and this risk lens is computed from your real sector, region and position weights."
          cta="Build your portfolio →"
          href="/portfolio"
        >
          <RiskBody book={SAMPLE_BOOK} />
        </SamplePreview>
      ) : (
        <div className="mt-6">
          <RiskBody book={book} />
        </div>
      )}
    </section>
  );
}
