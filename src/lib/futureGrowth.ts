// The arithmetic behind the Future Growth section.
//
// No imports, so scripts/test-future-growth.mjs can compile and exercise it on
// its own. That matters here more than it looks: every figure this module
// produces is a FORECAST, and a forecast that is wrong still renders as a
// confident percentage next to a green tick. The tests pin the growth maths,
// the horizon bookkeeping and, above all, the refusals.
//
// What the numbers actually are
//
// Yahoo's earningsTrend module gives analyst consensus for a small number of
// periods: the current fiscal year ("0y"), the next one ("+1y"), and a
// long-term annual rate ("+5y"). That is TWO annual estimate points and one
// rate, which is less than it appears:
//
//   • A "3-year growth rate" cannot be read off two points. Where the long-term
//     rate exists we blend it in for the years analysts have not estimated
//     individually, and the horizon we actually used travels with the number.
//   • Where it does not exist, the horizon is one year and the label says so.
//     Extrapolating a single year out to three and calling it a 3-year rate is
//     how a forecast becomes a fabrication.
//
// Net income growth and EPS growth are also not the same statistic: buybacks
// and issuance separate them, and nobody publishes a forecast share count. We
// report the EPS series as EPS, the revenue series as revenue, and never
// present one as the other.

export interface TrendPoint {
  /** Yahoo's period code: "0q", "+1q", "0y", "+1y", "+5y", "-5y". */
  period: string;
  /** Period end, epoch seconds, when Yahoo gives one. */
  endDate?: number;
  epsAvg?: number;
  epsLow?: number;
  epsHigh?: number;
  epsAnalysts?: number;
  revAvg?: number;
  revLow?: number;
  revHigh?: number;
  revAnalysts?: number;
  /** Yahoo's own growth figure for the period, as a fraction. */
  growth?: number;
}

const numOf = (x: unknown): number | undefined => {
  if (typeof x === "number") return isFinite(x) ? x : undefined;
  // Yahoo wraps most figures as { raw, fmt }. A missing value is often `{}`.
  if (x && typeof x === "object" && "raw" in (x as Record<string, unknown>)) {
    const raw = (x as Record<string, unknown>).raw;
    return typeof raw === "number" && isFinite(raw) ? raw : undefined;
  }
  return undefined;
};

/** Read Yahoo's earningsTrend rows into a shape that does not know about Yahoo. */
export function parseEarningsTrend(rows: unknown): TrendPoint[] {
  if (!Array.isArray(rows)) return [];
  const out: TrendPoint[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const row = r as Record<string, unknown>;
    const period = typeof row.period === "string" ? row.period : undefined;
    if (!period) continue;
    const ee = (row.earningsEstimate ?? {}) as Record<string, unknown>;
    const re = (row.revenueEstimate ?? {}) as Record<string, unknown>;
    out.push({
      period,
      endDate: numOf(row.endDate),
      epsAvg: numOf(ee.avg),
      epsLow: numOf(ee.low),
      epsHigh: numOf(ee.high),
      epsAnalysts: numOf(ee.numberOfAnalysts),
      revAvg: numOf(re.avg),
      revLow: numOf(re.low),
      revHigh: numOf(re.high),
      revAnalysts: numOf(re.numberOfAnalysts),
      growth: numOf(row.growth),
    });
  }
  return out;
}

export const findPeriod = (points: TrendPoint[], period: string): TrendPoint | undefined =>
  points.find((p) => p.period === period);

/**
 * Growth from one value to another, as a fraction per year.
 *
 * Returns undefined rather than a number whenever the answer would be
 * meaningless: a non-positive base makes the ratio arbitrary, and a loss
 * turning into a profit is a real event that no percentage describes. "Earnings
 * grew 340%" from a base of -0.01 is noise wearing a number's clothes.
 */
export function growthRate(from?: number, to?: number): number | undefined {
  if (from == null || to == null) return undefined;
  if (!isFinite(from) || !isFinite(to)) return undefined;
  if (from <= 0) return undefined;
  return to / from - 1;
}

/**
 * Blend one estimated year with a long-term rate over `years` total.
 *
 * ((1 + g1) · (1 + gLong)^(years-1))^(1/years) - 1
 *
 * Used only when both inputs exist. With no long-term rate the caller keeps the
 * one-year figure and reports a one-year horizon.
 */
export function blendedGrowth(g1: number, gLong: number, years: number): number | undefined {
  if (!isFinite(g1) || !isFinite(gLong) || years < 1) return undefined;
  const total = (1 + g1) * Math.pow(1 + gLong, years - 1);
  if (total <= 0) return undefined;
  return Math.pow(total, 1 / years) - 1;
}

export function median(xs: number[]): number | undefined {
  const v = xs.filter((x) => typeof x === "number" && isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return undefined;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export interface ForecastInput {
  points: TrendPoint[];
  /** Book value per share today, for the return-on-equity projection. */
  bookValuePerShare?: number;
  /** Dividend payout ratio as a fraction; what is not paid out is retained. */
  payoutRatio?: number;
}

export interface GrowthForecast {
  /** Forecast EPS growth per year, as a fraction. */
  epsGrowth?: number;
  /** Forecast revenue growth per year, as a fraction. */
  revenueGrowth?: number;
  /** Years the EPS rate covers. 3 when a long-term rate blended in, else 1. */
  epsHorizonYears: number;
  /** Years the revenue rate covers. Analysts estimate one year ahead. */
  revenueHorizonYears: number;
  /** Analysts contributing to the next-year estimate, when disclosed. */
  analysts?: number;
  epsThisYear?: number;
  epsNextYear?: number;
  revenueThisYear?: number;
  revenueNextYear?: number;
  /** Long-term annual rate as published, kept so the UI can show its provenance. */
  longTermRate?: number;
  /** Projected return on equity at the end of the EPS horizon, as a fraction. */
  futureRoe?: number;
  /** Why futureRoe is absent, when it is. */
  futureRoeReason?: string;
}

export const HIGH_GROWTH = 0.2; // the bar for calling growth "high", per year
export const HIGH_ROE = 0.2; // and for calling a return on equity high
const ROE_HORIZON = 3;

/**
 * Everything the section needs, derived from the consensus points.
 *
 * Each field is independent: a name with revenue estimates and no EPS estimates
 * gets the revenue half and nothing invented for the other.
 */
export function buildForecast(input: ForecastInput): GrowthForecast {
  const { points } = input;
  const y0 = findPeriod(points, "0y");
  const y1 = findPeriod(points, "+1y");
  const lt = findPeriod(points, "+5y");

  const epsG1 = growthRate(y0?.epsAvg, y1?.epsAvg);
  const revG1 = growthRate(y0?.revAvg, y1?.revAvg);
  const longTermRate = lt?.growth;

  let epsGrowth = epsG1;
  let epsHorizonYears = epsG1 != null ? 1 : 0;
  if (epsG1 != null && longTermRate != null) {
    const blended = blendedGrowth(epsG1, longTermRate, ROE_HORIZON);
    if (blended != null) {
      epsGrowth = blended;
      epsHorizonYears = ROE_HORIZON;
    }
  } else if (epsG1 == null && longTermRate != null && !(y0?.epsAvg != null && y0.epsAvg <= 0)) {
    // No annual estimates, but a published long-term rate is still a forecast.
    //
    // Withheld for a company currently losing money. A growth rate compounds a
    // base, and compounding a loss produces a bigger loss while the percentage
    // renders as green: "earnings forecast to grow 30% per year" beside a
    // negative EPS is worse than saying nothing.
    epsGrowth = longTermRate;
    epsHorizonYears = ROE_HORIZON;
  }

  const f: GrowthForecast = {
    epsGrowth,
    revenueGrowth: revG1,
    epsHorizonYears,
    revenueHorizonYears: revG1 != null ? 1 : 0,
    analysts: y1?.epsAnalysts ?? y1?.revAnalysts,
    epsThisYear: y0?.epsAvg,
    epsNextYear: y1?.epsAvg,
    revenueThisYear: y0?.revAvg,
    revenueNextYear: y1?.revAvg,
    longTermRate,
  };

  Object.assign(f, projectRoe(f, input));
  return f;
}

/**
 * Return on equity at the end of the horizon.
 *
 * Equity is rolled forward the only way a forecast can roll it: today's book
 * value plus the earnings retained each year. Nothing here models buybacks,
 * issuance or write-downs, all of which move book value and none of which are
 * forecast anywhere we can read. So this is a projection under stated
 * assumptions, and the section labels it as one.
 *
 * It refuses outright on negative book value. A company with negative equity has
 * a return on equity that is either negative or spuriously enormous depending on
 * which side of zero the arithmetic lands, and neither describes the business.
 */
function projectRoe(
  f: GrowthForecast,
  input: ForecastInput
): Pick<GrowthForecast, "futureRoe" | "futureRoeReason"> {
  const bvps = input.bookValuePerShare;
  const eps0 = f.epsThisYear;
  const g = f.epsGrowth;

  if (bvps == null) return { futureRoeReason: "book value per share not published" };
  if (bvps <= 0) return { futureRoeReason: "book value is negative, so equity returns are not meaningful" };
  if (eps0 == null || g == null) return { futureRoeReason: "no earnings estimates to project" };
  if (eps0 <= 0) return { futureRoeReason: "currently loss-making, so there are no earnings to compound" };

  const payout = input.payoutRatio != null && isFinite(input.payoutRatio)
    ? Math.max(0, Math.min(1, input.payoutRatio))
    : 0;

  let equity = bvps;
  let eps = eps0;
  for (let year = 1; year <= ROE_HORIZON; year++) {
    eps = eps * (1 + g);
    equity += eps * (1 - payout);
  }
  if (equity <= 0) return { futureRoeReason: "projected equity does not stay positive" };
  return { futureRoe: eps / equity };
}

export interface CheckContext {
  /** Local 10-year government bond yield, as a fraction. */
  riskFreeRate?: number;
  /** Median forecast EPS growth across the peer set. */
  peerEpsGrowth?: number;
  /** Median forecast revenue growth across the peer set. */
  peerRevenueGrowth?: number;
  /** How many peers those medians came from. */
  peerCount?: number;
}

export interface GrowthCheck {
  id: string;
  label: string;
  /** undefined when the inputs are missing: neither passed nor failed, unknown. */
  passed?: boolean;
  detail: string;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

/**
 * The six checks shown above the section.
 *
 * A check with a missing input is reported as unknown rather than failed. "We
 * could not compare this" and "this company compares badly" are different
 * statements, and a grey dot is the honest one.
 */
export function futureChecks(
  f: GrowthForecast,
  ctx: CheckContext,
  companyName = "This company"
): GrowthCheck[] {
  const peers = ctx.peerCount ? `${ctx.peerCount} peer${ctx.peerCount === 1 ? "" : "s"}` : "its peers";
  const checks: GrowthCheck[] = [];

  checks.push({
    id: "eps-vs-riskfree",
    label: "Earnings vs government bonds",
    passed:
      f.epsGrowth != null && ctx.riskFreeRate != null ? f.epsGrowth > ctx.riskFreeRate : undefined,
    detail:
      f.epsGrowth == null
        ? "No earnings forecast is available for this company."
        : ctx.riskFreeRate == null
          ? `Forecast earnings growth is ${pct(f.epsGrowth)} per year. No bond yield to compare it against.`
          : `${companyName}'s forecast earnings growth (${pct(f.epsGrowth)} per year) is ${
              f.epsGrowth > ctx.riskFreeRate ? "above" : "below"
            } the 10-year government bond yield (${pct(ctx.riskFreeRate)}).`,
  });

  checks.push({
    id: "eps-vs-peers",
    label: "Earnings vs peers",
    passed:
      f.epsGrowth != null && ctx.peerEpsGrowth != null ? f.epsGrowth > ctx.peerEpsGrowth : undefined,
    detail:
      f.epsGrowth == null || ctx.peerEpsGrowth == null
        ? `Not enough forecasts across ${peers} to compare.`
        : `${companyName}'s earnings (${pct(f.epsGrowth)} per year) are forecast to grow ${
            f.epsGrowth > ctx.peerEpsGrowth ? "faster" : "slower"
          } than the median of ${peers} (${pct(ctx.peerEpsGrowth)} per year).`,
  });

  checks.push({
    id: "eps-high-growth",
    label: "High growth earnings",
    passed: f.epsGrowth != null ? f.epsGrowth > HIGH_GROWTH : undefined,
    detail:
      f.epsGrowth == null
        ? "No earnings forecast is available for this company."
        : `Earnings are forecast to grow ${pct(f.epsGrowth)} per year, ${
            f.epsGrowth > HIGH_GROWTH ? "above" : "below"
          } the ${pct(HIGH_GROWTH)} bar for high growth.`,
  });

  checks.push({
    id: "rev-vs-peers",
    label: "Revenue vs peers",
    passed:
      f.revenueGrowth != null && ctx.peerRevenueGrowth != null
        ? f.revenueGrowth > ctx.peerRevenueGrowth
        : undefined,
    detail:
      f.revenueGrowth == null || ctx.peerRevenueGrowth == null
        ? `Not enough forecasts across ${peers} to compare.`
        : `${companyName}'s revenue (${pct(f.revenueGrowth)} per year) is forecast to grow ${
            f.revenueGrowth > ctx.peerRevenueGrowth ? "faster" : "slower"
          } than the median of ${peers} (${pct(ctx.peerRevenueGrowth)} per year).`,
  });

  checks.push({
    id: "rev-high-growth",
    label: "High growth revenue",
    passed: f.revenueGrowth != null ? f.revenueGrowth > HIGH_GROWTH : undefined,
    detail:
      f.revenueGrowth == null
        ? "No revenue forecast is available for this company."
        : `Revenue is forecast to grow ${pct(f.revenueGrowth)} per year, ${
            f.revenueGrowth > HIGH_GROWTH ? "above" : "below"
          } the ${pct(HIGH_GROWTH)} bar for high growth.`,
  });

  checks.push({
    id: "future-roe",
    label: "Future return on equity",
    passed: f.futureRoe != null ? f.futureRoe > HIGH_ROE : undefined,
    detail:
      f.futureRoe == null
        ? `Return on equity could not be projected: ${f.futureRoeReason ?? "inputs are missing"}.`
        : `Return on equity is projected at ${pct(f.futureRoe)} in ${ROE_HORIZON} years, ${
            f.futureRoe > HIGH_ROE ? "above" : "below"
          } the ${pct(HIGH_ROE)} mark.`,
  });

  return checks;
}

/** Passed / assessable, for the "criteria checks n/m" headline. */
export function checkTally(checks: GrowthCheck[]): { passed: number; assessed: number; total: number } {
  return {
    passed: checks.filter((c) => c.passed === true).length,
    assessed: checks.filter((c) => c.passed != null).length,
    total: checks.length,
  };
}
