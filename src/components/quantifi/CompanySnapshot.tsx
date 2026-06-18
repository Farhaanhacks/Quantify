import {
  GlassCard,
  SectionHeading,
  ScoreRadar,
  Tag,
} from "@/components/quantifi/Cards";
import {
  companyAnalytics,
  stockByTicker,
  SCORE_AXES,
  overallScore,
  fmtPrice,
  type ScoreAxisKey,
  type CompanyAnalytics,
} from "@/data/demo";

function axisColor(score: number): string {
  if (score >= 5) return "#34D399";
  if (score >= 3) return "#E9B872";
  return "#FB7185";
}

export default function CompanySnapshot({
  ticker,
  heading = true,
  data,
  price,
  name,
  live = false,
}: {
  ticker: string;
  heading?: boolean;
  data?: CompanyAnalytics;
  price?: number;
  name?: string;
  live?: boolean;
}) {
  const a = data ?? companyAnalytics[ticker];
  const resolvedPrice = price ?? stockByTicker[ticker]?.price;
  const resolvedName = name ?? stockByTicker[ticker]?.name ?? ticker;
  if (!a || resolvedPrice == null) return null;

  const cur = /\.(NS|BO)$/i.test(ticker) ? "₹" : "$";

  const total = overallScore(a); // 0–30
  const radarValues = SCORE_AXES.map((axis) => a.scores[axis.key].score);
  const radarLabels = SCORE_AXES.map((axis) => axis.label.split(" ")[0]);

  const gap = ((a.fairValue.estimate - resolvedPrice) / resolvedPrice) * 100;
  const under = gap > 0;
  const tag = live ? "" : " (demo)";

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Quantifi Score"
          title="Fundamentals at a glance"
          subtitle="A five-axis read on value, growth, performance, health and dividends — each scored from a checklist. A research summary, never a rating to act on."
        />
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        {/* Radar + overall */}
        <GlassCard className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-display text-lg font-semibold text-white">{a.ticker}</div>
              <div className="text-xs text-slate-500">{resolvedName}</div>
            </div>
            <div className="text-right">
              <div className="font-display text-2xl font-semibold tnum text-gradient-gold">
                {total}
                <span className="text-base text-slate-500">/30</span>
              </div>
              <div className="text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
                {live ? "Overall · live" : "Overall (demo)"}
              </div>
            </div>
          </div>
          <div className="mx-auto mt-2 max-w-[260px]">
            <ScoreRadar values={radarValues} labels={radarLabels} />
          </div>
        </GlassCard>

        {/* Per-axis with expandable checklist */}
        <GlassCard className="p-5 sm:p-6">
          <div className="space-y-2.5">
            {SCORE_AXES.map((axis) => {
              const d = a.scores[axis.key as ScoreAxisKey];
              const p = (d.score / 6) * 100;
              return (
                <details key={axis.key} className="group rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span className="text-sm text-slate-200">{axis.label}</span>
                    <span className="flex items-center gap-3">
                      <span className="hidden h-2 w-28 overflow-hidden rounded-full bg-white/[0.06] sm:block">
                        <span className="block h-full rounded-full" style={{ width: `${p}%`, backgroundColor: axisColor(d.score) }} />
                      </span>
                      <span className="font-mono text-sm tnum text-white">{d.score}/6</span>
                      <span className="text-slate-500 transition group-open:rotate-90" aria-hidden>›</span>
                    </span>
                  </summary>
                  <ul className="mt-3 space-y-1.5 border-t border-white/[0.05] pt-3">
                    {d.checks.map((chk, i) => (
                      <li key={i} className="flex items-center gap-2 text-xs">
                        <span className={chk.pass ? "text-up" : "text-slate-600"}>{chk.pass ? "✓" : "✕"}</span>
                        <span className={chk.pass ? "text-slate-300" : "text-slate-500 line-through"}>{chk.label}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* Fair value */}
      <GlassCard className="mt-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
              Fair value estimate · {a.fairValue.method}
            </div>
            <p className="mt-1 max-w-md text-xs text-slate-500">{a.fairValue.note}</p>
          </div>
          <div className="flex items-center gap-6">
            <div>
              <div className="text-xs text-slate-500">Current</div>
              <div className="font-mono text-xl font-semibold tnum text-white">{cur}{fmtPrice(resolvedPrice)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-500">Fair value</div>
              <div className="font-mono text-xl font-semibold tnum text-white">{cur}{fmtPrice(a.fairValue.estimate)}</div>
            </div>
            <Tag tone={under ? "up" : "down"}>
              {under ? "Below" : "Above"} fair value · {Math.abs(gap).toFixed(0)}%
            </Tag>
          </div>
        </div>
        <div className="mt-5">
          <div className="relative h-2 rounded-full bg-white/[0.06]">
            <div className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-teal" style={{ left: `${Math.min(95, Math.max(5, (a.fairValue.estimate / Math.max(a.fairValue.estimate, resolvedPrice)) * 90))}%` }} aria-hidden />
            <div className="absolute top-1/2 h-3.5 w-0.5 -translate-y-1/2 bg-gold" style={{ left: `${Math.min(95, Math.max(5, (resolvedPrice / Math.max(a.fairValue.estimate, resolvedPrice)) * 90))}%` }} aria-hidden />
          </div>
          <div className="mt-2 flex gap-4 text-[0.7rem] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-gold" /> Current price</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal" /> Fair value{tag}</span>
          </div>
        </div>
      </GlassCard>

      {/* Risk & reward */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <GlassCard className="p-5 sm:p-6">
          <h4 className="font-display text-base font-semibold text-up">Rewards</h4>
          <ul className="mt-3 space-y-2.5">
            {a.rewards.map((r, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-300">
                <span className="mt-0.5 text-up">+</span>
                <span className="leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
        <GlassCard className="p-5 sm:p-6">
          <h4 className="font-display text-base font-semibold text-down">Risk flags</h4>
          <ul className="mt-3 space-y-2.5">
            {a.riskFlags.map((r, i) => (
              <li key={i} className="flex gap-2.5 text-sm text-slate-300">
                <span className="mt-0.5 text-down">!</span>
                <span className="leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </section>
  );
}
