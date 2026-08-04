import { NextResponse } from "next/server";
import { getEdgarFundamentals } from "@/lib/ingest/edgar";
import { jsonCached } from "@/lib/httpCache";

// GET /api/fundamentals/AAPL  → free fundamentals from SEC EDGAR (US filers).
export async function GET(
  _req: Request,
  { params }: { params: { ticker: string } }
) {
  const data = await getEdgarFundamentals(params.ticker);
  if (!data) {
    return NextResponse.json(
      {
        error:
          "No EDGAR data. EDGAR covers US filers only, and EDGAR_USER_AGENT must be set.",
      },
      { status: 404 }
    );
  }
  // SEC filings change quarterly — safe to cache for an hour.
  return jsonCached(data, 3600, 7200);
}
