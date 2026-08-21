"use client";

import { useState } from "react";
import {
  GlassCard,
  ScoreRadar,
} from "@/components/quantifi/Cards";
import {
  SCORE_AXES,
  axisLabel,
  overallScore,
  fmtPrice,
  currencySymbol,
  type ScoreAxisKey,
  type ScoreCheck,
  type CompanyAnalytics,
} from "@/data/demo";
import { isAiBubbleStock } from "@/data/aiBubble";
import { FairValueBars, FairValueHistoryChart } from "@/components/quantifi/FairValueBars";

// Tone for an axis label chip.
function labelTone(score: number): string {
  if (score >= 5) return "border-up/30 bg-up/10 text-up";
  if (score >= 3) return "border-gold/30 bg-gold/10 text-gold";
  return "border-down/30 bg-down/10 text-down";
}

// Score on a 0–10 feel (stored 0–6).
const toTen = (score: number) => Math.round((score / 6) * 10);

// One dot per check: green for a pass, red for a fail, and a hollow dash for a
// measure we could not source.
//
// The count above it ("Analysis checks 5/6") and the dots say the same thing
// twice on purpose: the number is what you read, the dots are what you see, and
// the pattern of a single red among five greens registers before any of the
// words do. The labels stay one click away rather than being dropped — knowing
// WHICH check failed is the reason anyone opens this at all.
//
// The third state is the whole of the HDFC Bank fix in one component. The old
// dot had two states, so an unsourced metric rendered in exactly the same red as
// a failed one, and a bank whose capital adequacy we simply do not have looked
// like a bank that had FAILED its capital adequacy. The neutral state has to be
// visibly neither.
const STATUS_TITLE: Record<ScoreCheck["status"], string> = {
  pass: "Pass",
  fail: "Fail",
  unavailable: "Not available",
};

function CheckDots({ checks }: { checks: ScoreCheck[] }) {
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      {checks.map((c, i) => (
        <span
          key={i}
          title={
            c.status === "unavailable"
              ? `Not available, ${c.label}${c.unavailableReason ? `: ${c.unavailableReason}` : ""}`
              : `${STATUS_TITLE[c.status]}, ${c.label}`
          }
          className={`flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border ${
            c.status === "pass"
              ? "border-up/50 bg-up/15 text-up"
              : c.status === "fail"
                ? "border-down/50 bg-down/15 text-down"
                : "border-white/15 bg-white/[0.04] text-slate-500"
          }`}
        >
          <svg viewBox="0 0 24 24" className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth="3.5">
            {c.status === "pass" ? (
              <path d="m5 13 4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
            ) : c.status === "fail" ? (
              <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
            ) : (
              <path d="M6 12h12" strokeLinecap="round" />
            )}
          </svg>
        </span>
      ))}
    </span>
  );
}

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
  // Which axis the reader is pointing at, wherever they point at it: the chart
  // and the five cards beside it drive the same value, so hovering either one
  // lights up both. Without that link the chart is a shape with no legend and
  // the cards are a list with no picture — the whole point is that they are the
  // same five things.
  const [activeAxis, setActiveAxis] = useState<number | null>(null);

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
  // An axis nobody could measure is plotted at the midpoint, not at zero.
  //
  // A zero spoke is a claim — it draws the shape of a company that failed that
  // dimension — and for a bank whose capital adequacy simply is not in our data
  // that claim is false. The midpoint asserts neither strength nor weakness,
  // and the footnote under the chart names which axes are unscored so the shape
  // is never read as more informed than it is.
  const unscoredAxes = SCORE_AXES.filter((axis) => a.scores[axis.key].sufficient === false);
  const radarValues = SCORE_AXES.map((axis) =>
    a.scores[axis.key].sufficient === false ? 3 : a.scores[axis.key].score
  );
  const radarLabels = SCORE_AXES.map((axis) =>
    a.scores[axis.key].sufficient === false ? `${axis.short}*` : axis.short
  );

  const gap = ((a.fairValue.estimate - resolvedPrice) / resolvedPrice) * 100;

  // --- Synthesis: strongest / weakest axis, a risk lens and a one-line read ---
  // Only scored axes can be a company's strength or its soft spot. Ranking an
  // unmeasured one would let "we could not source this" become "this is the
  // weakest thing about the company", which is precisely the sentence the old
  // 0/10 was writing about HDFC Bank.
  const ranked = [...SCORE_AXES]
    .filter((axis) => a.scores[axis.key].sufficient !== false)
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

  // The caption under the snowflake: what the SHAPE says, in one line.
  //
  // Deliberately different from the Quantifi read below, which names the soft
  // spot and the thesis test. This one describes the picture directly above it —
  // which axes reach the edge and which pull in — because a caption that
  // discussed something else would make the reader hunt for the connection.
  const strengths = ranked.filter((r) => r.score >= 5).map((r) => r.axis.short.toLowerCase());
  const softs = ranked.filter((r) => r.score <= 2).map((r) => r.axis.short.toLowerCase());
  const list = (xs: string[]) =>
    xs.length <= 1 ? xs[0] ?? "" : `${xs.slice(0, -1).join(", ")} and ${xs[xs.length - 1]}`;
  const snowflakeRead =
    strengths.length >= 4
      ? `Reaches the edge on almost every axis; a broadly strong profile with no obvious weak side.`
      : strengths.length && softs.length
      ? `Strong on ${list(strengths)}; pinched on ${list(softs)}.`
      : strengths.length
      ? `Strong on ${list(strengths)}, and steady elsewhere.`
      : softs.length
      ? `Pinched on ${list(softs)}; the shape is small on the axes that matter most there.`
      : `A middling shape: nothing at the edge, nothing at the centre.`;

  // One-line read that names the soft spot rather than declaring perfection.
  const valuationHint =
    valuationScore <= 2
      ? "the quality already looks priced in"
      : valuationScore >= 5
      ? "and it still screens reasonably valued"
      : "with a fair, not cheap, valuation";
  const quantifiRead = !weakest
    ? `Not enough sourced fundamentals to score this company on any axis. The measures involved are published in the company's own filings rather than in the data source behind this page.`
    : weakest.score >= 5
      ? `Screens strongly across the board; ${valuationHint}. The thesis test now is whether it can keep beating already-high expectations.`
      : `Strongest on ${strongest.axis.label.toLowerCase()}; the soft spot is ${weakest.axis.label.toLowerCase()} (${axisLabel(weakest.axis.key, weakest.score)}). Key thesis test: ${weakest.axis.question.toLowerCase()}`;

  // The independent valuation, whichever model the company qualifies for: a
  // discounted cash flow for an operating business, an excess-return (or P/B)
  // read for a lender. `cashflowValue` is the older DCF-only field, kept as the
  // fallback so a response from before the split still renders.
  const cf =
    a.intrinsicValue ??
    (a.cashflowValue
      ? {
          ...a.cashflowValue,
          method: "dcf" as const,
          methodLabel: "Discounted cash flow",
          modelVersion: "",
        }
      : undefined);

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
          note="Analysts' average price target vs the current price, a research input, not advice."
        />
      </div>
    </GlassCard>
  );

  const cashflowCard = cf ? (
    <GlassCard className="mt-4 p-5 sm:p-6">
      {/* Name the model. The same card used to say "share price vs fair value"
          over a number that could have come from any of three methods, which is
          how a bank's book-value read was mistaken for a cash-flow one. */}
      <div className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
        Share price vs fair value · {cf.methodLabel}
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
        {sv?.sector === "Banks & Financial Institutions"
          ? "Share price vs intrinsic value"
          : "Share price vs future cash flow value"}
      </div>
      {sv?.sector === "Banks & Financial Institutions" ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          An intrinsic value isn&apos;t available for {a.ticker} yet. A lender is
          valued on <span className="text-slate-300">book value and return on
          equity</span>, not on cash flow. Its cash flow swings with lending and
          deposits and measures nothing an owner could take out, and those
          figures aren&apos;t complete enough here to model. We show nothing
          rather than run a cash-flow model that doesn&apos;t apply.
        </p>
      ) : (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          A cash-flow value isn&apos;t available for {a.ticker} yet. This company
          doesn&apos;t currently generate positive{" "}
          <span className="text-slate-300">operating cash flow</span>, so a
          cash-flow valuation would be negative or meaningless rather than useful. This is common for early-stage or heavy-investment names still scaling toward
          cash generation.
        </p>
      )}
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
        {sv ? "carry" : "carries"} the valuation view instead; shown{" "}
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
        {/* The "Below sector value · 38%" capsule used to sit here. It was
            removed deliberately: the same gap is already stated underneath as a
            percentage and a fair value, and a green badge gave a sector
            heuristic the authority of a verdict. */}
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
            note={`A ${sv.method} benchmark applied to this company's own figures; a sector heuristic, not a precise target.`}
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
          <div className="relative mx-auto mt-2 max-w-[320px]">
            <ScoreRadar
              values={radarValues}
              labels={radarLabels}
              activeIndex={activeAxis}
              onHoverAxis={setActiveAxis}
            />
            {/* The axis under the pointer, answered in place. Anchored at the top
                of the chart rather than following the cursor: a card that moves
                with the pointer is a card you cannot read while your hand is
                still on the thing you are reading about. */}
            {activeAxis != null && SCORE_AXES[activeAxis] ? (
              (() => {
                const axis = SCORE_AXES[activeAxis];
                const d = a.scores[axis.key as ScoreAxisKey];
                const evaluated = d.checks.filter((c) => c.status !== "unavailable");
                const passed = evaluated.filter((c) => c.status === "pass").length;
                // Sit on the opposite side of the chart from the axis being
                // pointed at. Five axes: 0, 1 and 4 are in the upper half, 2 and
                // 3 in the lower — so the card drops to the bottom for the top
                // ones and rises to the top for the bottom ones, and never
                // covers the petal the reader is asking about.
                const upperHalf = activeAxis === 0 || activeAxis === 1 || activeAxis === 4;
                return (
                  <div
                    className={`pointer-events-none absolute inset-x-0 z-10 rounded-lg border border-white/10 bg-ink-900/95 p-3 shadow-xl ${
                      upperHalf ? "bottom-0" : "top-0"
                    }`}
                  >
                    <div className="font-display text-sm font-semibold text-white">
                      <span className="text-slate-500">{activeAxis + 1}</span>
                      <span className="px-1.5 text-slate-700">|</span>
                      {axis.label}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-400">{axis.question}</p>
                    {d.checks.length ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="text-[0.68rem] text-slate-500">
                          <span className="font-mono tnum text-slate-300">
                            {evaluated.length} of {d.checks.length}
                          </span>{" "}
                          measured
                          <span className="text-slate-600"> · {passed} passed</span>
                        </span>
                        <CheckDots checks={d.checks} />
                      </div>
                    ) : null}
                  </div>
                );
              })()
            ) : null}
          </div>
          {/* The chart is not self-explanatory: five petals with no caption is a
              shape, not a finding. This is the sentence it exists to support. */}
          <div className="mt-3 border-t border-white/[0.06] pt-3">
            <div className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">Snowflake analysis</div>
            <p className="mt-1 text-sm leading-relaxed text-slate-300">{snowflakeRead}</p>
            {/* The asterisk on the chart, explained. Without this the midpoint
                spoke reads as a middling result rather than as an absence. */}
            {unscoredAxes.length ? (
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                *{" "}
                {unscoredAxes.map((axis) => axis.label).join(" and ")}{" "}
                {unscoredAxes.length === 1 ? "is" : "are"} not scored for this company and{" "}
                {unscoredAxes.length === 1 ? "is" : "are"} drawn at the midpoint rather than at zero.{" "}
                {a.scores[unscoredAxes[0].key].unavailableNote}
              </p>
            ) : null}
          </div>
        </GlassCard>

        {/* One numbered block per axis: the question it answers, how many of its
            checks passed, and — one click in — which ones. */}
        <GlassCard className="p-5 sm:p-6">
          <div className="space-y-2.5">
            {SCORE_AXES.map((axis, idx) => {
              const d = a.scores[axis.key as ScoreAxisKey];
              const supports = d.checks.filter((c) => c.status === "pass");
              const worries = d.checks.filter((c) => c.status === "fail");
              const unsourced = d.checks.filter((c) => c.status === "unavailable");
              const active = activeAxis === idx;
              return (
                <details
                  key={axis.key}
                  // Both directions, from one piece of state: point at the chart
                  // and the card lifts, point at the card and the wedge lights
                  // up. A link you can only travel one way is a link most people
                  // never find.
                  onMouseEnter={() => setActiveAxis(idx)}
                  onMouseLeave={() => setActiveAxis(null)}
                  className={`group rounded-lg border px-4 py-3 transition ${
                    active
                      ? "border-white/20 bg-white/[0.06]"
                      : "border-white/[0.06] bg-white/[0.02]"
                  }`}
                >
                  <summary className="cursor-pointer list-none">
                    <span className="flex items-start justify-between gap-3">
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="font-display text-sm font-semibold text-white">
                            <span className="text-slate-500">{idx + 1}</span>
                            <span className="px-1.5 text-slate-700">|</span>
                            {axis.label}
                          </span>
                          {/* No verdict word, and no score out of ten, when too
                              few measures could be sourced to support one. A
                              bank whose capital adequacy we do not have is not
                              "Fragile"; it is unmeasured, and saying so is the
                              only honest thing on offer. */}
                          {d.sufficient === false ? (
                            <span className="rounded-full border border-white/15 bg-white/[0.04] px-1.5 py-px text-[0.6rem] font-medium text-slate-400">
                              {unsourced.length < d.checks.length ? "Partial data" : "Not enough data"}
                            </span>
                          ) : (
                            <span className={`rounded-full border px-1.5 py-px text-[0.6rem] font-medium ${labelTone(d.score)}`}>
                              {axisLabel(axis.key, d.score)}
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-xs leading-relaxed text-slate-400">{axis.question}</span>
                      </span>
                      <span className="flex flex-none items-center gap-2.5">
                        <span className="font-mono text-sm tnum text-white">
                          {d.sufficient === false ? "n/a" : `${toTen(d.score)}/10`}
                        </span>
                        <span className="text-slate-500 transition group-open:rotate-90" aria-hidden>›</span>
                      </span>
                    </span>
                    {d.checks.length ? (
                      <span className="mt-2.5 flex flex-wrap items-center gap-2.5">
                        {/* Measured out of the WHOLE checklist, then how many
                            of those passed.
                            "Analysis checks 4/4 · 4 not available" said a bank
                            passed everything asked of it while hiding that only
                            half the questions were asked, and that the missing
                            half was the half that decides. The denominator has
                            to be the complete list. */}
                        <span className="text-[0.68rem] text-slate-500">
                          <span className="font-mono tnum text-slate-300">
                            {d.checks.length - unsourced.length} of {d.checks.length}
                          </span>{" "}
                          measured
                          <span className="text-slate-600">
                            {" "}· {supports.length} passed
                            {unsourced.length ? ` · ${unsourced.length} not available` : ""}
                          </span>
                        </span>
                        <CheckDots checks={d.checks} />
                      </span>
                    ) : null}
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
                    {/* Named, not hidden. A reader who wants to know why a bank
                        has no balance-sheet score deserves the list of what is
                        missing and where it actually lives. */}
                    {unsourced.length ? (
                      <div>
                        <div className="text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">
                          What we could not measure
                        </div>
                        <ul className="mt-1 space-y-1">
                          {unsourced.map((chk, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-slate-500">
                              <span className="mt-0.5" aria-hidden>–</span>
                              <span>
                                {chk.label}
                                {chk.unavailableReason ? (
                                  <span className="text-slate-600">: {chk.unavailableReason}</span>
                                ) : null}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    {d.sufficient === false && d.unavailableNote ? (
                      <p className="text-xs leading-relaxed text-slate-400">{d.unavailableNote}</p>
                    ) : null}
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
              className={`rounded-full border px-2 py-0.5 text-[0.6rem] ${
                a.scores[axis.key].sufficient === false
                  ? "border-white/15 bg-white/[0.04] text-slate-500"
                  : labelTone(a.scores[axis.key].score)
              }`}
              title={
                a.scores[axis.key].sufficient === false
                  ? `${axis.label}: not scored. ${a.scores[axis.key].unavailableNote ?? "Not enough data."}`
                  : `${axis.label}: ${toTen(a.scores[axis.key].score)}/10`
              }
            >
              {axis.short} ·{" "}
              {a.scores[axis.key].sufficient === false
                ? a.scores[axis.key].checks.some((c) => c.status !== "unavailable")
                  ? "partial"
                  : "not scored"
                : axisLabel(axis.key, a.scores[axis.key].score)}
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
              <span className="font-mono text-white">{cur}{fmtPrice(cf!.estimate)}</span>, a gap
              of {Math.abs(((a.fairValue.estimate - cf!.estimate) / resolvedPrice) * 100).toFixed(0)}%
              of the share price.{" "}
              {cfRicher
                ? "The market is pricing in growth beyond what today's cash flows justify; typical of a company reinvesting heavily, or one the market expects to earn well above its current run-rate."
                : "Analysts are more cautious than today's cash generation implies."}{" "}
              Weigh both; neither is advice.
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
          <p className="mt-1 text-[0.7rem] text-slate-500">The case for, from the fundamentals.</p>
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
          <p className="mt-1 text-[0.7rem] text-slate-500">The case against; what to weigh first.</p>
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
