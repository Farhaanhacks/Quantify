import { getYahooScore } from "@/lib/yahooFundamentals";
import { knownFund } from "@/data/knownFunds";
import { jsonCached } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol.toUpperCase();

  // Live fundamentals only — no demo/fallback scores. If we can't compute a
  // real score we say so, with an honest reason, rather than substituting
  // fabricated numbers.
  try {
    const y = await getYahooScore(symbol);
    if (y) {
      // Cache a real score at the edge for 5 min (fundamentals barely move
      // intraday) so the scanner's fan-out and repeat page views don't re-run.
      return jsonCached(
        {
          available: true,
          live: true,
          analytics: y.analytics,
          price: y.price,
          name: y.name,
          target: y.target,
          targetHigh: y.targetHigh,
          targetLow: y.targetLow,
          recommendation: y.recommendation,
          numAnalysts: y.numAnalysts,
          marketCap: y.marketCap,
          revenueGrowth: y.revenueGrowth,
          earningsGrowth: y.earningsGrowth,
          priceToSales: y.priceToSales,
          trailingPE: y.trailingPE,
        },
        300,
        900
      );
    }

    // Reached the source, but there were no company fundamentals to score.
    // This is expected for funds/ETFs, crypto, currencies and brand-new
    // listings — none of which have an income statement or cash flow. That
    // verdict is stable, so cache it a while too.
    const fund = knownFund(symbol);
    return jsonCached(
      {
        available: false,
        reason: fund ? "no_fundamentals_fund" : "no_fundamentals",
        message: fund
          ? `${symbol} is a fund/ETF, so it has no company income statement or cash flow to score. Open it for its holdings and exposure instead.`
          : `Live fundamentals aren't available for ${symbol}. This is normal for ETFs and funds, crypto, currencies and very recent listings — there's no company income statement or cash flow to build a score from.`,
      },
      300,
      900
    );
  } catch (err) {
    // We couldn't reach the data source (e.g. it rate-limited the request).
    // Only cache this briefly — it's usually transient and we want to recover.
    console.error("[score] Yahoo failed:", err);
    return jsonCached(
      {
        available: false,
        reason: "source_unavailable",
        message: `Couldn't reach live fundamentals for ${symbol} right now — the market-data source may be rate-limiting. Please try again shortly.`,
      },
      60,
      120
    );
  }
}
