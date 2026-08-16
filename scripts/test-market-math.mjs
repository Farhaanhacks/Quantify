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
const { aggregatePE, weightedMean, yearChangePct, returnOver, ytdReturn } = await import(
  join(out, "marketMath.js")
);
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
