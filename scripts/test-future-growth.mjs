#!/usr/bin/env node
// Tests for the Future Growth arithmetic.
//
// Run: node scripts/test-future-growth.mjs
//
// Every number this module produces is a forecast, and a wrong forecast renders
// exactly like a right one: a confident percentage beside a green tick. So the
// properties worth pinning are mostly refusals.
//
//   • Growth off a non-positive base is not a percentage. A company going from a
//     loss to a profit has not "grown 340%", and neither has one going from
//     +0.01 to 1.00. Both must come back undefined.
//   • The horizon must never be inflated. One estimated year is a one-year rate;
//     only a published long-term rate earns the three-year label.
//   • A missing comparison is unknown, not a failure. `passed === undefined` and
//     `passed === false` say different things to a reader, and conflating them
//     turns "we have no peer data" into "this company grows slower than peers".
//   • Negative book value must not produce a return on equity. The arithmetic
//     yields a large positive number there, which is the most misleading output
//     this file could emit.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "futuregrowth-"));
execFileSync(
  "npx",
  ["tsc", join(root, "src/lib/futureGrowth.ts"), "--outDir", out, "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler"],
  { stdio: "pipe" }
);
const {
  parseEarningsTrend,
  findPeriod,
  growthRate,
  blendedGrowth,
  median,
  buildForecast,
  futureChecks,
  checkTally,
  HIGH_GROWTH,
  HIGH_ROE,
} = await import(join(out, "futureGrowth.js"));
rmSync(out, { recursive: true, force: true });

let passed = 0;
let failed = 0;
const ok = (name, cond) => {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${name}`);
  }
};
const near = (name, a, b, eps = 1e-9) =>
  ok(`${name} (${a} ≈ ${b})`, a != null && Math.abs(a - b) < eps);

// A Yahoo-shaped payload: values wrapped as { raw, fmt }, some modules empty.
const yahooRows = [
  {
    period: "0q",
    endDate: { raw: 1751068800 },
    growth: { raw: 0.12 },
    earningsEstimate: { avg: { raw: 0.95 }, low: { raw: 0.9 }, high: { raw: 1.0 }, numberOfAnalysts: { raw: 30 } },
    revenueEstimate: { avg: { raw: 8.1e9 }, numberOfAnalysts: { raw: 28 } },
  },
  {
    period: "0y",
    endDate: { raw: 1766880000 },
    growth: { raw: 0.28 },
    earningsEstimate: { avg: { raw: 4.0 }, low: { raw: 3.6 }, high: { raw: 4.4 }, numberOfAnalysts: { raw: 42 } },
    revenueEstimate: { avg: { raw: 3.4e10 }, low: { raw: 3.2e10 }, high: { raw: 3.6e10 }, numberOfAnalysts: { raw: 40 } },
  },
  {
    period: "+1y",
    endDate: { raw: 1798416000 },
    growth: { raw: 0.5 },
    earningsEstimate: { avg: { raw: 6.0 }, low: { raw: 4.8 }, high: { raw: 7.5 }, numberOfAnalysts: { raw: 39 } },
    revenueEstimate: { avg: { raw: 4.42e10 }, low: { raw: 4.0e10 }, high: { raw: 4.9e10 }, numberOfAnalysts: { raw: 37 } },
  },
  { period: "+5y", growth: { raw: 0.3 } },
  { period: "-5y", growth: { raw: 0.18 } },
];

// ── parseEarningsTrend ──────────────────────────────────────────────────────
{
  const pts = parseEarningsTrend(yahooRows);
  ok("parses every row", pts.length === 5);
  const y1 = findPeriod(pts, "+1y");
  near("unwraps { raw } for eps avg", y1.epsAvg, 6.0);
  near("unwraps eps low", y1.epsLow, 4.8);
  near("unwraps eps high", y1.epsHigh, 7.5);
  near("unwraps revenue avg", y1.revAvg, 4.42e10);
  ok("keeps analyst count", y1.epsAnalysts === 39);
  near("keeps yahoo's own growth", y1.growth, 0.5);
  ok("+5y has a rate and no estimates", findPeriod(pts, "+5y").growth === 0.3 && findPeriod(pts, "+5y").epsAvg == null);

  ok("non-array input is empty, not a throw", parseEarningsTrend(undefined).length === 0);
  ok("null input is empty", parseEarningsTrend(null).length === 0);
  ok("rows without a period are dropped", parseEarningsTrend([{ growth: { raw: 1 } }]).length === 0);
  ok("junk entries are skipped", parseEarningsTrend([null, 3, "x", { period: "0y" }]).length === 1);
  ok("empty {} value reads as absent", parseEarningsTrend([{ period: "0y", earningsEstimate: { avg: {} } }])[0].epsAvg == null);
  ok("plain numbers work too", parseEarningsTrend([{ period: "0y", earningsEstimate: { avg: 2 } }])[0].epsAvg === 2);
  ok("NaN is rejected", parseEarningsTrend([{ period: "0y", earningsEstimate: { avg: { raw: NaN } } }])[0].epsAvg == null);
  ok("Infinity is rejected", parseEarningsTrend([{ period: "0y", earningsEstimate: { avg: { raw: Infinity } } }])[0].epsAvg == null);
}

// ── growthRate: the refusals matter more than the arithmetic ────────────────
{
  near("doubling is +100%", growthRate(1, 2), 1);
  near("halving is -50%", growthRate(2, 1), -0.5);
  near("flat is 0", growthRate(5, 5), 0);
  ok("loss to profit is not a percentage", growthRate(-1, 2) === undefined);
  ok("profit to loss is not a percentage", growthRate(-2, -1) === undefined);
  ok("zero base is refused", growthRate(0, 5) === undefined);
  ok("missing base is refused", growthRate(undefined, 5) === undefined);
  ok("missing target is refused", growthRate(5, undefined) === undefined);
  ok("NaN is refused", growthRate(NaN, 5) === undefined);
  ok("Infinity is refused", growthRate(1, Infinity) === undefined);
  // The headline case: a tiny positive base is arithmetically fine and
  // editorially useless, but it IS a real percentage, so it is allowed through
  // and the section's own copy carries the caveat.
  near("tiny base still computes", growthRate(0.01, 1), 99);
}

// ── blendedGrowth ───────────────────────────────────────────────────────────
{
  near("equal rates blend to themselves", blendedGrowth(0.2, 0.2, 3), 0.2, 1e-12);
  const b = blendedGrowth(0.5, 0.3, 3);
  ok("blend sits between the two rates", b > 0.3 && b < 0.5);
  near("one year is just the first rate", blendedGrowth(0.4, 0.9, 1), 0.4, 1e-12);
  ok("zero years is refused", blendedGrowth(0.2, 0.2, 0) === undefined);
  ok("NaN is refused", blendedGrowth(NaN, 0.2, 3) === undefined);
  // A collapse steeper than -100% would take the product negative; no real
  // number is the annual rate of that.
  ok("total wipeout is refused", blendedGrowth(-1, -1, 3) === undefined);
}

// ── median ──────────────────────────────────────────────────────────────────
{
  near("odd count", median([3, 1, 2]), 2);
  near("even count averages the middle", median([1, 2, 3, 4]), 2.5);
  near("single value", median([7]), 7);
  ok("empty is undefined", median([]) === undefined);
  ok("all-junk is undefined", median([NaN, Infinity]) === undefined);
  near("junk is filtered, not fatal", median([1, NaN, 3]), 2);
  near("does not mutate order-dependence", median([10, -5, 0]), 0);
}

// ── buildForecast ───────────────────────────────────────────────────────────
{
  const pts = parseEarningsTrend(yahooRows);
  const f = buildForecast({ points: pts, bookValuePerShare: 20, payoutRatio: 0 });

  // eps 4.0 → 6.0 is +50% for year one, then the +5y rate of 30% twice.
  const expected = Math.pow(1.5 * 1.3 * 1.3, 1 / 3) - 1;
  near("eps growth blends the long-term rate", f.epsGrowth, expected, 1e-12);
  ok("and reports a three-year horizon", f.epsHorizonYears === 3);
  near("revenue growth is the one estimated year", f.revenueGrowth, 4.42e10 / 3.4e10 - 1, 1e-12);
  ok("revenue horizon is one year", f.revenueHorizonYears === 1);
  ok("analyst count comes from next year", f.analysts === 39);
  near("long-term rate is kept for provenance", f.longTermRate, 0.3);

  // ROE: eps compounds three years, all retained on top of book value.
  let eps = 4.0;
  let eq = 20;
  for (let i = 0; i < 3; i++) {
    eps *= 1 + expected;
    eq += eps;
  }
  near("projected roe matches the stated model", f.futureRoe, eps / eq, 1e-9);

  // A payout reduces retained earnings, so equity grows more slowly and the
  // projected return on equity comes out HIGHER, not lower.
  const paying = buildForecast({ points: pts, bookValuePerShare: 20, payoutRatio: 0.5 });
  ok("payout raises projected roe", paying.futureRoe > f.futureRoe);
  const allOut = buildForecast({ points: pts, bookValuePerShare: 20, payoutRatio: 1 });
  ok("a full payout leaves equity flat", Math.abs(allOut.futureRoe - eps / 20) < 1e-9);
  // Out-of-range payout ratios are clamped rather than trusted; Yahoo publishes
  // negative and >1 ratios for companies paying out of reserves.
  const weird = buildForecast({ points: pts, bookValuePerShare: 20, payoutRatio: -3 });
  near("negative payout clamps to zero", weird.futureRoe, f.futureRoe, 1e-12);
  const over = buildForecast({ points: pts, bookValuePerShare: 20, payoutRatio: 4 });
  near("payout above one clamps to one", over.futureRoe, allOut.futureRoe, 1e-12);
}

// ── buildForecast: the degenerate inputs ────────────────────────────────────
{
  const noLong = parseEarningsTrend(yahooRows.filter((r) => r.period !== "+5y"));
  const f = buildForecast({ points: noLong, bookValuePerShare: 20 });
  near("without a long-term rate the eps rate is the single year", f.epsGrowth, 0.5, 1e-12);
  ok("and the horizon is honestly one year", f.epsHorizonYears === 1);

  const onlyLong = buildForecast({ points: parseEarningsTrend([{ period: "+5y", growth: { raw: 0.22 } }]) });
  near("a lone long-term rate is still a forecast", onlyLong.epsGrowth, 0.22);
  ok("carrying the three-year horizon", onlyLong.epsHorizonYears === 3);

  const empty = buildForecast({ points: [] });
  ok("no points yields no eps rate", empty.epsGrowth === undefined);
  ok("no points yields no revenue rate", empty.revenueGrowth === undefined);
  ok("horizons are zero, not one", empty.epsHorizonYears === 0 && empty.revenueHorizonYears === 0);
  ok("no roe", empty.futureRoe === undefined);
  ok("and a reason for it", typeof empty.futureRoeReason === "string" && empty.futureRoeReason.length > 0);

  // The dangerous one. Negative equity makes eps/equity a large positive number
  // for a loss-making balance sheet; it must never be published.
  const negBook = buildForecast({ points: parseEarningsTrend(yahooRows), bookValuePerShare: -8 });
  ok("negative book value yields no roe", negBook.futureRoe === undefined);
  ok("with a reason naming book value", /book value/i.test(negBook.futureRoeReason));

  const noBook = buildForecast({ points: parseEarningsTrend(yahooRows) });
  ok("missing book value yields no roe", noBook.futureRoe === undefined);

  const lossMaker = buildForecast({
    points: parseEarningsTrend([
      { period: "0y", earningsEstimate: { avg: { raw: -2 } } },
      { period: "+1y", earningsEstimate: { avg: { raw: -1 } } },
      { period: "+5y", growth: { raw: 0.3 } },
    ]),
    bookValuePerShare: 10,
  });
  ok("a loss-maker gets no roe", lossMaker.futureRoe === undefined);
  // The long-term rate exists here, and is deliberately NOT used: compounding a
  // 30% rate off a negative base renders as growth while describing a widening
  // loss.
  ok("no eps growth is published off a loss", lossMaker.epsGrowth === undefined);
  ok("horizon stays zero for a loss-maker", lossMaker.epsHorizonYears === 0);
  ok("the long-term rate is still recorded", lossMaker.longTermRate === 0.3);
  const lossChecks = futureChecks(lossMaker, { riskFreeRate: 0.04, peerEpsGrowth: 0.1, peerCount: 3 });
  ok("so its growth checks are unknown, not passing", lossChecks.find((c) => c.id === "eps-high-growth").passed === undefined);
}

// ── futureChecks ────────────────────────────────────────────────────────────
{
  const f = buildForecast({ points: parseEarningsTrend(yahooRows), bookValuePerShare: 20, payoutRatio: 0 });
  const full = futureChecks(f, { riskFreeRate: 0.04, peerEpsGrowth: 0.1, peerRevenueGrowth: 0.08, peerCount: 4 }, "TestCo");
  ok("six checks", full.length === 6);
  ok("all six assessable with full inputs", full.every((c) => c.passed != null));
  ok("beats the bond yield", full.find((c) => c.id === "eps-vs-riskfree").passed === true);
  ok("beats peer eps growth", full.find((c) => c.id === "eps-vs-peers").passed === true);
  ok("counts as high growth earnings", full.find((c) => c.id === "eps-high-growth").passed === true);
  ok("counts as high growth revenue", full.find((c) => c.id === "rev-high-growth").passed === true);
  ok("every check has a sentence", full.every((c) => c.detail.length > 10));
  ok("the company's name is used", full.some((c) => c.detail.includes("TestCo")));
  ok("no em-dashes in the copy", full.every((c) => !c.detail.includes("—") && !c.label.includes("—")));

  const tally = checkTally(full);
  ok("tally counts passes", tally.passed === full.filter((c) => c.passed).length);
  ok("tally counts assessed", tally.assessed === 6);
  ok("tally knows the total", tally.total === 6);

  // Missing peers must not read as a failure.
  const noPeers = futureChecks(f, { riskFreeRate: 0.04, peerCount: 0 });
  ok("peer eps check is unknown", noPeers.find((c) => c.id === "eps-vs-peers").passed === undefined);
  ok("peer revenue check is unknown", noPeers.find((c) => c.id === "rev-vs-peers").passed === undefined);
  ok("but the others still resolve", noPeers.find((c) => c.id === "eps-high-growth").passed === true);
  const t2 = checkTally(noPeers);
  ok("unassessed checks are excluded from assessed", t2.assessed === 4);
  ok("and are not counted as passes", t2.passed === 4);
  ok("total stays six", t2.total === 6);

  // A slow grower fails the growth bars rather than going unknown.
  const slow = buildForecast({
    points: parseEarningsTrend([
      { period: "0y", earningsEstimate: { avg: { raw: 2 } }, revenueEstimate: { avg: { raw: 100 } } },
      { period: "+1y", earningsEstimate: { avg: { raw: 2.1 } }, revenueEstimate: { avg: { raw: 102 } } },
    ]),
    bookValuePerShare: 40,
  });
  const slowChecks = futureChecks(slow, { riskFreeRate: 0.04, peerEpsGrowth: 0.3, peerRevenueGrowth: 0.25, peerCount: 3 });
  ok("slow eps growth fails the high-growth bar", slowChecks.find((c) => c.id === "eps-high-growth").passed === false);
  ok("slow revenue growth fails too", slowChecks.find((c) => c.id === "rev-high-growth").passed === false);
  ok("and loses to faster peers", slowChecks.find((c) => c.id === "eps-vs-peers").passed === false);
  ok("5% growth beats a 4% bond", slowChecks.find((c) => c.id === "eps-vs-riskfree").passed === true);

  // No forecasts at all: every check unknown, none failed.
  const blank = futureChecks(buildForecast({ points: [] }), {});
  ok("nothing known means nothing failed", blank.every((c) => c.passed === undefined));
  ok("and the tally assesses nothing", checkTally(blank).assessed === 0);
  ok("still six rows to explain themselves", blank.length === 6);

  // Exactly at the bar is not above it.
  const atBar = futureChecks({ epsGrowth: HIGH_GROWTH, revenueGrowth: HIGH_GROWTH, epsHorizonYears: 1, revenueHorizonYears: 1, futureRoe: HIGH_ROE }, {});
  ok("growth exactly at the bar does not pass", atBar.find((c) => c.id === "eps-high-growth").passed === false);
  ok("roe exactly at the bar does not pass", atBar.find((c) => c.id === "future-roe").passed === false);
}

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
