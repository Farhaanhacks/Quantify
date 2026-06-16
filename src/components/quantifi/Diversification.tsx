import {
  GlassCard,
  SectionHeading,
  Donut,
  BarMeter,
  Tag,
} from "@/components/quantifi/Cards";
import {
  sectorDiversification,
  geoRevenueSplit,
  concentrationNotes,
  holdings,
  holdingValue,
  portfolioTotal,
} from "@/data/demo";

const levelTone: Record<string, "up" | "gold" | "down"> = {
  Moderate: "up",
  Elevated: "gold",
  High: "down",
};

export default function Diversification({ heading = true }: { heading?: boolean }) {
  const holdingWeights = holdings
    .map((h) => ({
      ticker: h.ticker,
      pct: Math.round((holdingValue(h) / portfolioTotal) * 100),
    }))
    .sort((a, b) => b.pct - a.pct);

  const barColors = ["#E9B872", "#4FD1C5", "#818CF8", "#F472B6", "#34D399", "#94A3B8", "#FB7185"];

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Diversification & Risk"
          title="How concentrated is the book?"
          subtitle="A risk lens across sectors, individual holdings and where revenue is generated geographically."
        />
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {/* Concentration risk */}
        <GlassCard className="p-5">
          <h3 className="font-display text-base font-semibold text-white">Concentration risk</h3>
          <ul className="mt-4 space-y-4">
            {concentrationNotes.map((c) => (
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

        {/* Sector diversification */}
        <GlassCard className="p-5">
          <h3 className="font-display text-base font-semibold text-white">By sector</h3>
          <div className="mt-3 flex items-center justify-center">
            <Donut segments={sectorDiversification} centerValue={`${sectorDiversification[0].pct}%`} centerLabel="top sector" />
          </div>
          <ul className="mt-4 space-y-1.5">
            {sectorDiversification.map((s) => (
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

        {/* Geography revenue split */}
        <GlassCard className="p-5">
          <h3 className="font-display text-base font-semibold text-white">Revenue by geography</h3>
          <div className="mt-3 flex items-center justify-center">
            <Donut segments={geoRevenueSplit} centerValue={`${geoRevenueSplit[0].pct}%`} centerLabel="US revenue" />
          </div>
          <ul className="mt-4 space-y-1.5">
            {geoRevenueSplit.map((s) => (
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

      {/* Holding diversification */}
      <GlassCard className="mt-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-white">Diversification across holdings</h3>
          <span className="text-xs text-slate-500">{holdings.length} positions</span>
        </div>
        <div className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
          {holdingWeights.map((h, i) => (
            <BarMeter key={h.ticker} label={h.ticker} value={h.pct} color={barColors[i % barColors.length]} />
          ))}
        </div>
      </GlassCard>
    </section>
  );
}
