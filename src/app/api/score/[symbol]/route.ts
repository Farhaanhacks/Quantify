import { getYahooScore } from "@/lib/yahooFundamentals";
import { knownFund } from "@/data/knownFunds";
import { jsonCached } from "@/lib/httpCache";
import { aliasSymbol } from "@/lib/symbolAlias";
import { recordFairValue } from "@/lib/fairValueHistory";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = aliasSymbol(params.symbol.toUpperCase());

  // Live fundamentals only — no demo/fallback scores. If we can't compute a
  // real score we say so, with an honest reason, rather than substituting
  // fabricated numbers.
  try {
    const y = await getYahooScore(symbol);
    if (y) {
      // Log today's cash-flow value so the history chart has something real to
      // draw.
      //
      // This has to be awaited. It used to be `void recordFairValue(...)` on
      // the reasoning that the series is a nice-to-have and the score is not —
      // but a serverless function can be frozen the moment it returns its
      // response, so the pending write was being killed before it reached the
      // database. Nothing was ever recorded, and the chart sat on "history
      // starts building from today" indefinitely.
      //
      // The cost is one round trip: the day-claim below returns false for
      // every request after the first each day, and the score response is
      // edge-cached anyway. It can never fail the score — the helper swallows
      // its own errors and this catch is a backstop.
      //
      // The METHOD-AWARE value, not the cash-flow one. A bank has no cash-flow
      // value any more (by design), and recording only that field would leave
      // every financial institution with a permanently empty chart.
      const iv = y.analytics?.intrinsicValue;
      if (iv?.estimate != null && y.price != null) {
        try {
          await recordFairValue(symbol, iv.estimate, y.price, iv.method, iv.modelVersion);
        } catch {
          /* the score matters more than the series */
        }
      }
      // Cache at the edge for 60s — long enough to absorb the scanner's fan-out
      // and quick reloads, short enough that the price and market cap stay close
      // to the live market during trading hours.
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
          currency: y.currency,
        },
        60,
        180
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
