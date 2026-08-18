import { yahooQuoteSummary } from "@/lib/yahooCrumb";
import { getYahooStatements } from "@/lib/yahooCompany";
import { jsonCached } from "@/lib/httpCache";
import { aliasSymbol } from "@/lib/symbolAlias";
import { riskFreeRate } from "@/lib/valuationModel";
import {
  parseEarningsTrend,
  buildForecast,
  futureChecks,
  checkTally,
  median,
  type TrendPoint,
  type GrowthForecast,
} from "@/lib/futureGrowth";

export const dynamic = "force-dynamic";

// Analyst forecasts for one company, plus the peer medians the section compares
// it against.
//
// Peers arrive as a query parameter rather than being resolved here: the client
// already holds them from /api/peers, that route is CDN-cached, and resolving
// them twice would double the upstream traffic for an identical answer. At most
// four are honoured, which caps this route at five upstream calls.

const MODULES = "earningsTrend,defaultKeyStatistics,summaryDetail,price";
const MAX_PEERS = 4;

const num = (x: unknown): number | undefined => {
  if (typeof x === "number") return isFinite(x) ? x : undefined;
  if (x && typeof x === "object" && "raw" in (x as Record<string, unknown>)) {
    const raw = (x as Record<string, unknown>).raw;
    return typeof raw === "number" && isFinite(raw) ? raw : undefined;
  }
  return undefined;
};

interface Fetched {
  points: TrendPoint[];
  bookValuePerShare?: number;
  payoutRatio?: number;
  currency?: string;
  name?: string;
}

async function fetchOne(symbol: string): Promise<Fetched | null> {
  const result = await yahooQuoteSummary(symbol, MODULES);
  if (!result) return null;
  const et = (result.earningsTrend ?? {}) as Record<string, unknown>;
  const ks = (result.defaultKeyStatistics ?? {}) as Record<string, unknown>;
  const sd = (result.summaryDetail ?? {}) as Record<string, unknown>;
  const pr = (result.price ?? {}) as Record<string, unknown>;
  return {
    points: parseEarningsTrend(et.trend),
    bookValuePerShare: num(ks.bookValue),
    payoutRatio: num(sd.payoutRatio),
    currency: typeof pr.currency === "string" ? pr.currency : undefined,
    name: typeof pr.longName === "string" ? pr.longName : undefined,
  };
}

/** Annual revenue and net income actuals, oldest first, for the chart's past. */
async function pastActuals(symbol: string) {
  try {
    const { income } = await getYahooStatements(symbol);
    return income
      .map((r) => ({
        date: r.date,
        revenue: r.values.annualTotalRevenue,
        earnings: r.values.annualNetIncome,
      }))
      .filter((r) => r.date && (r.revenue != null || r.earnings != null))
      .sort((a, b) => (a.date! < b.date! ? -1 : 1))
      .slice(-5) as { date: string; revenue?: number; earnings?: number }[];
  } catch {
    return [];
  }
}

export async function GET(req: Request, { params }: { params: { symbol: string } }) {
  const symbol = aliasSymbol(params.symbol.toUpperCase());
  const peerParam = new URL(req.url).searchParams.get("peers") ?? "";
  const peerSymbols = peerParam
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s && s !== symbol)
    .slice(0, MAX_PEERS);

  try {
    const [self, past, ...peerResults] = await Promise.all([
      fetchOne(symbol),
      pastActuals(symbol),
      ...peerSymbols.map((p) => fetchOne(p).catch(() => null)),
    ]);

    if (!self) {
      return jsonCached(
        {
          available: false,
          reason: "source_unavailable",
          message: `Couldn't reach analyst forecasts for ${symbol} right now.`,
        },
        60,
        120
      );
    }

    const forecast = buildForecast({
      points: self.points,
      bookValuePerShare: self.bookValuePerShare,
      payoutRatio: self.payoutRatio,
    });

    // Nothing to forecast is a real answer for a great many listings: young
    // companies, small caps, and most non-US names have no published consensus
    // at all. Saying so is the point; inventing a growth rate for them is not.
    if (forecast.epsGrowth == null && forecast.revenueGrowth == null) {
      return jsonCached(
        {
          available: false,
          reason: "no_forecasts",
          message: `No analyst forecasts are published for ${symbol}, so there is nothing to project. This is normal outside large-cap coverage.`,
        },
        1800,
        3600
      );
    }

    const peerForecasts: { symbol: string; forecast: GrowthForecast }[] = [];
    peerResults.forEach((r, i) => {
      if (!r) return;
      const f = buildForecast({
        points: r.points,
        bookValuePerShare: r.bookValuePerShare,
        payoutRatio: r.payoutRatio,
      });
      if (f.epsGrowth != null || f.revenueGrowth != null) {
        peerForecasts.push({ symbol: peerSymbols[i], forecast: f });
      }
    });

    const peerEpsGrowth = median(
      peerForecasts.map((p) => p.forecast.epsGrowth).filter((x): x is number => x != null)
    );
    const peerRevenueGrowth = median(
      peerForecasts.map((p) => p.forecast.revenueGrowth).filter((x): x is number => x != null)
    );
    const peerRoe = median(
      peerForecasts.map((p) => p.forecast.futureRoe).filter((x): x is number => x != null)
    );

    const ctx = {
      riskFreeRate: riskFreeRate(self.currency),
      peerEpsGrowth,
      peerRevenueGrowth,
      peerCount: peerForecasts.length,
    };
    const checks = futureChecks(forecast, ctx, self.name ?? symbol);

    // Forecasts move when estimates are revised, which happens on earnings days
    // and rarely otherwise. Six hours at the edge, half a day of stale-while-
    // revalidate, keeps this off the function for almost every reader.
    return jsonCached(
      {
        available: true,
        symbol,
        name: self.name,
        currency: self.currency,
        forecast,
        checks,
        tally: checkTally(checks),
        peers: {
          symbols: peerForecasts.map((p) => p.symbol),
          epsGrowth: peerEpsGrowth,
          revenueGrowth: peerRevenueGrowth,
          futureRoe: peerRoe,
        },
        riskFreeRate: ctx.riskFreeRate,
        past,
        estimates: self.points.filter((p) => p.period === "0y" || p.period === "+1y"),
      },
      21600,
      43200
    );
  } catch (err) {
    console.error("[future-growth] failed:", err);
    return jsonCached(
      {
        available: false,
        reason: "source_unavailable",
        message: `Couldn't reach analyst forecasts for ${symbol} right now.`,
      },
      60,
      120
    );
  }
}
