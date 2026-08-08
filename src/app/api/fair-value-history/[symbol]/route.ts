import { getFairValueHistory, fairValueHistoryConfigured } from "@/lib/fairValueHistory";
import { backfillFairValue, monthlyCloses } from "@/lib/fairValueBackfill";
import { getYahooCompany } from "@/lib/yahooCompany";
import { jsonCached } from "@/lib/httpCache";
import { aliasSymbol } from "@/lib/symbolAlias";

export const dynamic = "force-dynamic";

// The recorded history of this company's cash-flow value against its share
// price, plus a modelled reconstruction of the years before the recorder
// started.
//
// The recorded series accumulates one point per day and cannot be back-filled —
// see lib/fairValueHistory. What CAN be reconstructed is a point per reported
// financial year: the free cash flow each year actually reported, valued by the
// same model, against the share price on the day that year closed. Those points
// are flagged `modelled` so the chart can draw them as the estimate they are.
// Where a recorded point and a modelled one land on the same date the recorded
// one wins — it is an observation, the other is a reconstruction.
export async function GET(_req: Request, { params }: { params: { symbol: string } }) {
  const symbol = aliasSymbol(params.symbol.toUpperCase());
  // `recording` tells the client whether points are being written at all. With
  // no KV credentials configured the series can never fill up, and saying
  // "history starts building from today" every day for a week is a promise the
  // deployment cannot keep.
  const recording = fairValueHistoryConfigured();

  let recorded: Awaited<ReturnType<typeof getFairValueHistory>> = [];
  try {
    recorded = await getFairValueHistory(symbol);
  } catch {
    /* fall through with an empty recorded series */
  }

  let modelled: Awaited<ReturnType<typeof backfillFairValue>> = [];
  try {
    const [company, closes] = await Promise.all([
      getYahooCompany(symbol),
      monthlyCloses(symbol),
    ]);
    if (company && closes.length) modelled = backfillFairValue(company, closes);
  } catch {
    /* the reconstruction is a bonus; never fail the endpoint for it */
  }

  const byDate = new Map<string, { d: string; v: number; p: number; modelled?: boolean }>();
  for (const m of modelled) byDate.set(m.d, m);
  for (const r of recorded) byDate.set(r.d, r); // observation beats reconstruction
  const points = [...byDate.values()].sort((a, b) => a.d.localeCompare(b.d));

  return jsonCached(
    { ok: true, symbol, recording, points, modelledCount: modelled.length },
    300,
    3600
  );
}
