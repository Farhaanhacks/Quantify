#!/usr/bin/env node
// Tests for the market-page arithmetic.
//
// Run: node scripts/test-market-math.mjs
//
// These exist because every number on the markets page is derived, and a derived
// number that is wrong still looks like a number. Two failure modes in
// particular are invisible on screen:
//
//   • A percentage in the wrong unit. Yahoo's 52-week change is a fraction on
//     some endpoints and a percent on others, and "+0.2%" for a year the market
//     rose 23% reads as a perfectly ordinary quiet year.
//   • A window measured from the wrong day. A "1 year" return computed from
//     eight months of history is not approximately right, it is a different
//     statistic with the wrong label on it.
//
// The aggregate P/E is here for a different reason: it is the one figure on the
// page that people will assume is an average, and it must never be one.

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const out = mkdtempSync(join(tmpdir(), "marketmath-"));
execFileSync(
  "npx",
  ["tsc", join(root, "src/lib/marketMath.ts"), "--outDir", out, "--module", "esnext", "--target", "es2022", "--moduleResolution", "bundler"],
  { stdio: "pipe" }
);
const {
  aggregatePE,
  weightedMean,
  yearChangePct,
  returnOver,
  ytdReturn,
  parseSparkPayload,
  seriesReturnPct,
  chunk,
  pooled,
  SPARK_SYMBOL_LIMIT,
  seriesLadder,
  MIN_DRAWABLE_POINTS,
} = await import(join(out, "marketMath.js"));
rmSync(out, { recursive: true, force: true });

let pass = 0;
let fail = 0;
const check = (name, cond, extra = "") => {
  if (cond) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); }
};
const near = (a, b, tol = 1e-6) => a != null && Math.abs(a - b) <= tol;

// A series of daily closes ending today, oldest first.
function series(days, from = 100, step = 0.02) {
  const pts = [];
  const end = new Date("2026-08-16");
  for (let i = days; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    pts.push({ time: d.toISOString().slice(0, 10), value: from * (1 + step) ** (days - i) });
  }
  return pts;
}

console.log("\n[aggregate P/E is not an average of P/Es]");
// One near-break-even company on a huge multiple, among ordinary ones. The mean
// of the ratios is ~103x; the market is really on ~19x.
const withOutlier = [
  { marketCap: 1000, pe: 20 },
  { marketCap: 1000, pe: 15 },
  { marketCap: 1000, pe: 25 },
  { marketCap: 20, pe: 400 },
];
const mean = withOutlier.reduce((s, r) => s + r.pe, 0) / withOutlier.length;
const agg = aggregatePE(withOutlier);
check("the mean of the ratios is badly skewed", mean > 100, String(mean));
check("the aggregate is not", agg < 25, String(agg));
check(
  "and equals total value over total earnings",
  near(agg, 3020 / (1000 / 20 + 1000 / 15 + 1000 / 25 + 20 / 400), 1e-9),
  String(agg)
);
check("identical multiples aggregate to themselves",
  near(aggregatePE([{ marketCap: 5, pe: 18 }, { marketCap: 500, pe: 18 }]), 18, 1e-9));
check("a loss-maker is excluded, not counted as zero earnings",
  near(aggregatePE([{ marketCap: 100, pe: 10 }, { marketCap: 100, pe: -4 }]), 10, 1e-9));
check("all loss-makers → no ratio at all", aggregatePE([{ marketCap: 100, pe: -4 }]) === undefined);
check("no rows → undefined", aggregatePE([]) === undefined);
check("a nonsense multiple is rejected rather than published",
  aggregatePE([{ marketCap: 100, pe: 100000 }]) === undefined);

console.log("\n[cap-weighted means]");
const rows = [
  { cap: 900, ret: 10 },
  { cap: 100, ret: -10 },
];
check("weights by size, not by name",
  near(weightedMean(rows, (r) => r.ret, (r) => r.cap).value, 8, 1e-9));
check("counts how many rows contributed",
  weightedMean([{ cap: 1, ret: 5 }, { cap: 1 }], (r) => r.ret, (r) => r.cap).n === 1);
check("a missing value doesn't count as zero",
  near(weightedMean([{ cap: 1, ret: 5 }, { cap: 1 }], (r) => r.ret, (r) => r.cap).value, 5, 1e-9));
check("no weight anywhere → undefined",
  weightedMean([{ cap: 0, ret: 5 }], (r) => r.ret, (r) => r.cap).value === undefined);

console.log("\n[the 52-week unit trap]");
check("derived from the absolute change, not the percent field",
  near(yearChangePct({ price: 123, fiftyTwoWeekChange: 23, fiftyTwoWeekChangePercent: 0.23 }), 23, 1e-9),
  String(yearChangePct({ price: 123, fiftyTwoWeekChange: 23, fiftyTwoWeekChangePercent: 0.23 })));
check("a fall is negative",
  near(yearChangePct({ price: 80, fiftyTwoWeekChange: -20 }), -20, 1e-9));
check("a fraction-shaped fallback is read as a fraction",
  near(yearChangePct({ fiftyTwoWeekChangePercent: 0.234 }), 23.4, 1e-9));
check("a percent-shaped fallback is read as a percent",
  near(yearChangePct({ fiftyTwoWeekChangePercent: 23.4 }), 23.4, 1e-9));
check("nothing to read → undefined", yearChangePct({}) === undefined);
check("an impossible move is rejected",
  yearChangePct({ fiftyTwoWeekChangePercent: 5000 }) === undefined);
check("a price at or below its own change can't be inverted",
  yearChangePct({ price: 10, fiftyTwoWeekChange: 10 }) === undefined);

console.log("\n[windowed returns]");
const oneYear = series(365, 100, 0.0005);
const yr = returnOver(oneYear, 365);
check("a one-year series answers for one year", yr != null, String(yr));
check("and the answer is the whole series' return",
  near(yr, ((oneYear[oneYear.length - 1].value - oneYear[0].value) / oneYear[0].value) * 100, 1e-6));
check("a week is measured over a week, not the whole series",
  returnOver(oneYear, 7) < yr / 10, String(returnOver(oneYear, 7)));

// The regression this slack exists for: an upstream "1y" range starts a day or
// two AFTER the exact cutoff (weekends), and the strict test blanked the figure.
const shortByTwoDays = series(363, 100, 0.0005);
check("two days short still answers for a year", returnOver(shortByTwoDays, 365) != null);
// But eight months is not a year, and must not be labelled one.
check("eight months does not", returnOver(series(240), 365) === undefined);
check("one point is not a window", returnOver([{ time: "2026-08-16", value: 5 }], 7) === undefined);
check("an empty series answers nothing", returnOver([], 7) === undefined);

console.log("\n[year to date]");
const ytdPts = [
  { time: "2025-12-30", value: 100 },
  { time: "2026-01-02", value: 110 },
  { time: "2026-08-16", value: 132 },
];
check("measured from the first session of THIS year, not from the series start",
  near(ytdReturn(ytdPts), 20, 1e-9), String(ytdReturn(ytdPts)));
check("a series that starts mid-year has no year-to-date figure",
  ytdReturn([
    { time: "2026-03-02", value: 100 },
    { time: "2026-08-16", value: 120 },
  ]) === undefined);

console.log("\n[batched price series: both shapes Yahoo serves]");
// The flat shape: a map keyed by symbol.
const flat = {
  "AAPL": { symbol: "AAPL", close: [100, 105, 110] },
  "MSFT": { symbol: "MSFT", close: [200, 190] },
};
const flatParsed = parseSparkPayload(flat);
check("reads the flat shape", flatParsed.size === 2, String(flatParsed.size));
check("keeps the closes in order", JSON.stringify(flatParsed.get("AAPL")) === "[100,105,110]");

// The envelope shape: chart-style, closes nested under indicators.
const envelope = {
  spark: {
    result: [
      {
        symbol: "RELIANCE.NS",
        response: [{ indicators: { quote: [{ close: [1000, 1100] }] } }],
      },
    ],
  },
};
const envParsed = parseSparkPayload(envelope);
check("reads the envelope shape", envParsed.size === 1, String(envParsed.size));
check("and finds the nested closes",
  JSON.stringify(envParsed.get("RELIANCE.NS")) === "[1000,1100]",
  JSON.stringify([...envParsed]));

check("symbols are upper-cased so lookups match the universe",
  parseSparkPayload({ "aapl": { symbol: "aapl", close: [1, 2] } }).has("AAPL"));
check("a null close is dropped, not read as zero",
  JSON.stringify(parseSparkPayload({ A: { symbol: "A", close: [10, null, 12] } }).get("A")) === "[10,12]");
check("a one-point series is no series at all",
  parseSparkPayload({ A: { symbol: "A", close: [10] } }).size === 0);
check("an unrecognised payload yields nothing rather than something wrong",
  parseSparkPayload({ nonsense: true }).size === 0);
check("garbage in, empty out", parseSparkPayload(null).size === 0 && parseSparkPayload("x").size === 0);

console.log("\n[series returns]");
check("first to last", near(seriesReturnPct([100, 150]), 50, 1e-9));
check("a fall is negative", near(seriesReturnPct([200, 150]), -25, 1e-9));
check("intermediate points don't change the answer",
  near(seriesReturnPct([100, 5, 900, 150]), 50, 1e-9));
check("a single point has no return", seriesReturnPct([100]) === undefined);
check("a zero start can't be divided by", seriesReturnPct([0, 100]) === undefined);
check("an unadjusted split is rejected rather than shown as a 10,000% gain",
  seriesReturnPct([1, 5000]) === undefined);

console.log("\n[batch size: the bug that showed two sectors as a market]");
// India's universe is 56 companies. At a chunk of 50 that is one request of 50
// and one of 6; the 6 came back, the 50 came back EMPTY, and the page drew the
// two sectors that happened to sit in that tail — Health Care and Utilities —
// as though they were the Indian market. The upstream caps the symbol list and
// says nothing about it, so the only defence is never to approach the cap.
check("the batch limit is small", SPARK_SYMBOL_LIMIT <= 10, String(SPARK_SYMBOL_LIMIT));

const india = Array.from({ length: 56 }, (_, i) => `SYM${i}.NS`);
const batches = chunk(india, SPARK_SYMBOL_LIMIT);
check("no batch approaches the cap", batches.every((b) => b.length <= SPARK_SYMBOL_LIMIT),
  JSON.stringify(batches.map((b) => b.length)));
check("the 50/6 split cannot recur", !batches.some((b) => b.length > 10),
  JSON.stringify(batches.map((b) => b.length)));
check("every company is asked for exactly once",
  batches.flat().length === india.length && new Set(batches.flat()).size === india.length);
check("order is preserved", batches.flat().every((s, i) => s === india[i]));
check("an exact multiple leaves no empty batch",
  chunk(Array.from({ length: 20 }, (_, i) => i), 10).length === 2);
check("an empty list needs no requests", chunk([], 10).length === 0);
check("a nonsense size still makes progress rather than looping",
  chunk([1, 2, 3], 0).length === 3);

console.log("\n[the request pool]");
{
  let live = 0;
  let peak = 0;
  const order = [];
  const tasks = Array.from({ length: 17 }, (_, i) => async () => {
    live++;
    peak = Math.max(peak, live);
    await new Promise((r) => setTimeout(r, (i % 3) * 4));
    order.push(i);
    live--;
    return i * 2;
  });
  const results = await pooled(tasks, 4);
  check("every task ran", order.length === 17, String(order.length));
  check("results come back in task order, not completion order",
    results.every((v, i) => v === i * 2), JSON.stringify(results.slice(0, 5)));
  check("never more than the limit in flight", peak <= 4, String(peak));
  check("and it actually ran them concurrently", peak > 1, String(peak));
  check("no tasks, no workers", (await pooled([], 4)).length === 0);
  check("a limit below one still makes progress", (await pooled(tasks.slice(0, 3), 0)).length === 3);
}

console.log("\n[chart windows for a company that has barely traded]");
// The bug: a company listed three days ago has three daily bars, so a 1Y
// request at a daily interval came back below the stub floor and was discarded.
// The page then said "live chart data isn't available" directly beneath a live
// price badge, which is the page contradicting itself about data it holds.
//
// The ladder asks for shorter windows at finer intervals, where those same
// three days are hundreds of bars. What it must never do is ask for MORE than
// the caller wanted, which would quietly draw a different period than the one
// labelled on screen.
{
  const oneY = seriesLadder("1y");
  check("1Y starts with the year asked for", oneY[0].range === "1y" && oneY[0].interval === "1d");
  check("then narrows", oneY.length > 1);
  check("ending at the finest window", oneY[oneY.length - 1].interval === "5m");
  check("and never asks for more than a year", oneY.every((a) => a.range !== "5y" && a.range !== "max"));

  const oneD = seriesLadder("1d");
  check("1D is intraday from the start", oneD[0].interval === "5m");
  check("and has nothing finer to fall back to", oneD.length === 1);

  const max = seriesLadder("max");
  check("max uses weekly bars first", max[0].interval === "1wk");
  check("and still narrows for a young company", max.length > 1);

  const oneMo = seriesLadder("1mo");
  check("1M starts daily", oneMo[0].range === "1mo" && oneMo[0].interval === "1d");
  check("and does not repeat itself", oneMo.filter((a) => a.range === "1mo").length === 1);

  for (const r of ["1mo", "3mo", "6mo", "ytd", "1y", "5y", "max", "10y"]) {
    const l = seriesLadder(r);
    check(`${r}: first attempt is the requested range`, l[0].range === r);
    check(`${r}: every attempt names an interval`, l.every((a) => typeof a.interval === "string" && a.interval.length > 0));
    check(`${r}: no attempt is repeated`, new Set(l.map((a) => `${a.range}|${a.interval}`)).size === l.length);
  }

  // Two points make a line; one makes a dot nobody can read.
  check("the drawable floor is two points", MIN_DRAWABLE_POINTS === 2);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
