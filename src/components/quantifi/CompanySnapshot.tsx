import {
  GlassCard,
  ScoreRadar,
  Tag,
} from "@/components/quantifi/Cards";
import {
  SCORE_AXES,
  axisLabel,
  overallScore,
  fmtPrice,
  currencySymbol,
  type ScoreAxisKey,
  type CompanyAnalytics,
} from "@/data/demo";
import { isAiBubbleStock } from "@/data/aiBubble";
import { FairValueBars, FairValueHistoryChart } from "@/components/quantifi/FairValueBars";

function axisColor(score: number): string {
  if (score >= 5) return "#34D399";
  if (score >= 3) return "#4F93F7";
  return "#FB7185";
}

// Tone for an axis label chip.
function labelTone(score: number): string {
  if (score >= 5) return "border-up/30 bg-up/10 text-up";
  if (score >= 3) return "border-gold/30 bg-gold/10 text-gold";
  return "border-down/30 bg-down/10 text-down";
}

// Score on a 0–10 feel (stored 0–6).
const toTen = (score: number) => Math.round((score / 6) * 10);

export default function CompanySnapshot({
  ticker,
  data,
  price,
  name,
  currency,
  live = false,
}: {
  ticker: string;
  data?: CompanyAnalytics;
  price?: number;
  name?: string;
  currency?: string;
  live?: boolean;
}) {
  // Live data only — passed in from the score API. No demo fallback.
  const a = data;
  const resolvedPrice = price;
  const resolvedName = name ?? ticker;
  if (!a || resolvedPrice == null) return null;

  // Prefer the real currency from the live data (so a name Yahoo resolved
  // without an exchange suffix, e.g. "VEEFIN" → INR, still shows ₹), falling
  // back to the ticker suffix.
  const cur = currencySymbol(currency, ticker);

  const total = overallScore(a); // 0–30
  const radarValues = SCORE_AXES.map((axis) => a.scores[axis.key].score);
  const radarLabels = SCORE_AXES.map((axis) => axis.short);

  const gap = ((a.fairValue.estimate - resolvedPrice) / resolvedPrice) * 100;

  // --- Synthesis: strongest / weakest axis, a risk lens and a one-line read ---
  const ranked = [...SCORE_AXES]
    .map((axis) => ({ axis, score: a.scores[axis.key].score }))
    .sort((x, y) => y.score - x.score);
  const strongest = ranked[0];
  const weakest = ranked[ranked.length - 1];
  const valuationScore = a.scores.value.score; // higher = cheaper
  const profitScore = a.scores.past.score;

  // Risk lens: weak axes + valuation stretch + unprofitability.
  const weakCount = ranked.filter((r) => r.score <= 2).length;
  const riskPoints = weakCount + (gap < 0 ? 1 : 0) + (profitScore <= 1 ? 1 : 0);
  const riskLens =
    riskPoints >= 4 ? "Severe" : riskPoints >= 3 ? "High" : riskPoints >= 1 ? "Medium" : "Low";
  const riskTone =
    riskLens === "Low"
      ? "border-up/30 bg-up/10 text-up"
      : riskLens === "Medium"
      ? "border-gold/30 bg-gold/10 text-gold"
      : "border-down/30 bg-down/10 text-down";

  // One-line read that names the soft spot rather than declaring perfection.
  const valuationHint =
    valuationScore <= 2
      ? "the quality already looks priced in"
      : valuationScore >= 5
      ? "and it still screens reasonably valued"
      : "with a fair, not cheap, valuation";
  const quantifiRead =
    weakest.score >= 5
      ? `Screens strongly across the board — ${valuationHint}. The thesis test now is whether it can keep beating already-high expectations.`
      : `Strongest on ${strongest.axis.label.toLowerCase()}; the soft spot is ${weakest.axis.label.toLowerCase()} (${axisLabel(weakest.axis.key, weakest.score)}). Key thesis test: ${weakest.axis.question.toLowerCase()}`;

  // Independent DCF (cash-flow) valuation, when available.
  const cf = a.cashflowValue;

  // Sector-appropriate valuation (SaaS→EV/Sales, banks→P/B, telecom/infra→
  // EV/EBITDA, real-estate/commodities→NAV, else→P/E), when available.
  const sv = a.sectorValuation;

  // For AI-bubble names, price reflects future expectations more than near-term
  // analyst targets, so we LEAD with the share-price-vs-future-cash-flow lens —
  // but the analyst view always stays visible right below it (both lenses, every
  // time). Only reorder when we actually have a trustworthy DCF.
  const featureCashflow = isAiBubbleStock(ticker) && !!cf;

  // When the analyst target and the cash-flow value disagree by a wide margin
  // (>30% of the current price), the two methods are telling different stories —
  // usually the market pricing in growth that today's cash flows don't yet
  // support. Flag it so the user weighs both rather than trusting one number.
  // Not raised when the cash-flow value is flagged out-of-range: for a company
  // priced beyond a 10-year DCF's horizon the two methods ALWAYS diverge, so the
  // banner would fire on every hyper-growth name and read as a red flag when it's
  // really a limitation of the method. That card's own note explains it properly.
  const diverge =
    cf != null &&
    !cf.outOfRange &&
    a.fairValue?.estimate != null &&
    resolvedPrice > 0 &&
    Math.abs(a.fairValue.estimate - cf.estimate) / resolvedPrice >= 0.3;
  const cfRicher = cf != null && a.fairValue.estimate > cf.estimate;

  const analystCard = (
    <GlassCard className="mt-4 p-5 sm:p-6">
      {/* No summary pill here. It said the same thing as the figure directly
          beneath it, and said it differently: the pill measured the gap against
          the PRICE and the bars measure it against the FAIR VALUE, so ₹271.10
          against ₹314.89 produced "16%" in one line and "13.9%" in the next. One number, in the place that
          explains itself. */}
      <div>
        <div className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
          Fair value estimate · {a.fairValue.method}
        </div>
        <p className="mt-1 max-w-md text-xs text-slate-500">{a.fairValue.note}</p>
      </div>
      <div className="mt-5">
        <FairValueBars
          price={resolvedPrice}
          fair={a.fairValue.estimate}
          cur={cur}
          fairLabel="Fair Value"
          note="Analysts' average price target vs the current price — a research input, not advice."
        />
      </div>
    </GlassCard>
  );

  const cashflowCard = cf ? (
    <GlassCard className="mt-4 p-5 sm:p-6">
      <div className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
        Share price vs fair value
      </div>
      <p className="mt-1 max-w-md text-xs text-slate-500">{cf.note}</p>

      <div className="mt-5">
        <FairValueBars
          price={resolvedPrice}
          fair={cf.estimate}
          cur={cur}
          outOfRange={cf.outOfRange}
        />
      </div>

      <FairValueHistoryChart symbol={a.ticker} cur={cur} />
    </GlassCard>
  ) : null;

  // When we can't publish a trustworthy DCF (loss-making, cash-burning, or a
  // capital-heavy business whose real free cash flow — operating cash flow minus
  // ALL capex — is lumpy or negative), we deliberately DON'T invent one: a wrong
  // intrinsic value is worse than none. But render an honest explanation in that
  // slot rather than a blank, and point to the two lenses we DO show.
  const cashflowUnavailableCard = cf ? null : (
    <GlassCard className="mt-4 p-5 sm:p-6">
      <div className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
        Share price vs future cash flow value
      </div>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
        A cash-flow value isn&apos;t available for {a.ticker} yet. This company
        doesn&apos;t currently generate positive{" "}
        <span className="text-slate-300">operating cash flow</span>, so a
        cash-flow valuation would be negative or meaningless rather than useful —
        common for early-stage or heavy-investment names still scaling toward
        cash generation.
      </p>
      <p className="mt-2 max-w-2xl text-[0.7rem] leading-relaxed text-slate-500">
        For this company the{" "}
        {sv ? (
          <>
            <span className="text-slate-400">sector valuation ({sv.metricLabel})</span>{" "}
            and the analyst target
          </>
        ) : (
          <>analyst mean target</>
        )}{" "}
        {sv ? "carry" : "carries"} the valuation view instead — shown{" "}
        {featureCashflow ? "below" : "above"}. We show nothing here rather than
        publish a number we don&apos;t trust.
      </p>
    </GlassCard>
  );

  const sectorCard = sv ? (
    <GlassCard className="mt-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
            Sector valuation · {sv.method}
          </div>
          <p className="mt-1 max-w-md text-xs text-slate-500">{sv.note}</p>
        </div>
        <Tag tone={sv.tagUnder ? "up" : "down"}>{sv.tag}</Tag>
      </div>
      <div className="mt-3 text-[0.7rem] uppercase tracking-[0.14em] text-slate-500">
        {sv.sector} · <span className="font-mono normal-case tracking-normal text-slate-300">{sv.metricLabel}</span>
      </div>
      {sv.showBar ? (
        <div className="mt-4">
          <FairValueBars
            price={resolvedPrice}
            fair={sv.estimate}
            cur={cur}
            fairLabel={sv.valueLabel}
            note={`A ${sv.method} benchmark applied to this company's own figures — a sector heuristic, not a precise target.`}
          />
        </div>
      ) : null}
    </GlassCard>
  ) : null;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
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
                {live ? "Overall · live" : "Overall"}
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
              const supports = d.checks.filter((c) => c.pass);
              const worries = d.checks.filter((c) => !c.pass);
              return (
                <details key={axis.key} className="group rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-slate-200">{axis.label}</span>
                      <span className={`rounded-full border px-1.5 py-px text-[0.6rem] font-medium ${labelTone(d.score)}`}>
                        {axisLabel(axis.key, d.score)}
                      </span>
                    </span>
                    <span className="flex items-center gap-3">
                      <span className="hidden h-2 w-24 overflow-hidden rounded-full bg-white/[0.06] sm:block">
                        <span className="block h-full rounded-full" style={{ width: `${p}%`, backgroundColor: axisColor(d.score) }} />
                      </span>
                      <span className="font-mono text-sm tnum text-white">{toTen(d.score)}/10</span>
                      <span className="text-slate-500 transition group-open:rotate-90" aria-hidden>›</span>
                    </span>
                  </summary>
                  <div className="mt-3 space-y-2.5 border-t border-white/[0.05] pt-3">
                    {supports.length ? (
                      <div>
                        <div className="text-[0.58rem] uppercase tracking-[0.14em] text-up/80">What supports it</div>
                        <ul className="mt-1 space-y-1">
                          {supports.map((chk, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-300">
                              <span className="mt-0.5 text-up">✓</span>
                              <span>{chk.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {worries.length ? (
                      <div>
                        <div className="text-[0.58rem] uppercase tracking-[0.14em] text-down/80">What worries us</div>
                        <ul className="mt-1 space-y-1">
                          {worries.map((chk, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                              <span className="mt-0.5 text-down">✕</span>
                              <span>{chk.label}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <p className="text-[0.7rem] leading-relaxed text-slate-500">
                      <span className="text-slate-400">Main question: </span>
                      {axis.question}
                    </p>
                  </div>
                </details>
              );
            })}
          </div>
        </GlassCard>
      </div>

      {/* Quantifi Read — synthesis: the soft spot and the key thesis test */}
      <GlassCard className="mt-4 border-gold/20 bg-gold/[0.06] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[0.7rem] uppercase tracking-[0.16em] text-gold/80">Quantifi read</div>
          <div className="flex items-center gap-2 text-[0.7rem]">
            <span className="uppercase tracking-[0.12em] text-slate-500">Risk lens</span>
            <span className={`rounded-full border px-2 py-0.5 font-semibold ${riskTone}`}>{riskLens}</span>
          </div>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-slate-200">{quantifiRead}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {SCORE_AXES.map((axis) => (
            <span
              key={axis.key}
              className={`rounded-full border px-2 py-0.5 text-[0.6rem] ${labelTone(a.scores[axis.key].score)}`}
              title={`${axis.label}: ${toTen(a.scores[axis.key].score)}/10`}
            >
              {axis.short} · {axisLabel(axis.key, a.scores[axis.key].score)}
            </span>
          ))}
        </div>
      </GlassCard>

      {/* Divergence flag — shown when the two valuation lenses disagree widely. */}
      {diverge ? (
        <GlassCard className="mt-4 border-gold/30 bg-gold/[0.06] p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 text-base text-gold" aria-hidden>⚠</span>
            <p className="text-sm leading-relaxed text-slate-200">
              <span className="font-semibold text-white">The two valuation methods disagree.</span>{" "}
              Analysts&apos; mean target is{" "}
              <span className="font-mono text-white">{cur}{fmtPrice(a.fairValue.estimate)}</span>,
              while the future-cash-flow value is{" "}
              <span className="font-mono text-white">{cur}{fmtPrice(cf!.estimate)}</span> — a gap
              of {Math.abs(((a.fairValue.estimate - cf!.estimate) / resolvedPrice) * 100).toFixed(0)}%
              of the share price.{" "}
              {cfRicher
                ? "The market is pricing in growth beyond what today's cash flows justify — typical of a company reinvesting heavily, or one the market expects to earn well above its current run-rate."
                : "Analysts are more cautious than today's cash generation implies."}{" "}
              Weigh both — neither is advice.
            </p>
          </div>
        </GlassCard>
      ) : null}

      {/* Valuation. For AI-bubble names the future-cash-flow lens leads; the
          analyst target always stays visible directly below it (and vice-versa
          for everyone else), so both lenses are shown every time. */}
      {featureCashflow ? (
        <>
          {cashflowCard}
          {sectorCard}
          {analystCard}
        </>
      ) : (
        <>
          {analystCard}
          {sectorCard}
          {cashflowCard ?? cashflowUnavailableCard}
        </>
      )}

      {/* Pros / cons */}
      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <GlassCard className="p-5 sm:p-6">
          <h4 className="font-display text-base font-semibold text-up">Pros</h4>
          <p className="mt-1 text-[0.7rem] text-slate-500">The case for — from the fundamentals.</p>
          <ul className="mt-3 space-y-2">
            {a.rewards.map((r, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-up/15 bg-up/[0.06] px-3 py-2.5 text-sm text-slate-200"
              >
                <span className="mt-px flex h-5 w-5 flex-none items-center justify-center rounded-full bg-up/20 text-up">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
                    <path d="M12 2l2.9 6.3 6.9.7-5.1 4.7 1.4 6.8L12 17.8 5.9 20.5l1.4-6.8L2.2 9l6.9-.7Z" />
                  </svg>
                </span>
                <span className="leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
        <GlassCard className="p-5 sm:p-6">
          <h4 className="font-display text-base font-semibold text-down">Cons</h4>
          <p className="mt-1 text-[0.7rem] text-slate-500">The case against — what to weigh first.</p>
          <ul className="mt-3 space-y-2">
            {a.riskFlags.map((r, i) => (
              <li
                key={i}
                className="flex items-start gap-3 rounded-lg border border-down/15 bg-down/[0.06] px-3 py-2.5 text-sm text-slate-200"
              >
                <span className="mt-px flex h-5 w-5 flex-none items-center justify-center rounded-full bg-down/20 text-down">
                  <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3">
                    <path d="M12 8v5" strokeLinecap="round" />
                    <circle cx="12" cy="17" r="0.5" fill="currentColor" />
                  </svg>
                </span>
                <span className="leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </section>
  );
}
