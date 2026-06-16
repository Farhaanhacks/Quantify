import { NextResponse } from "next/server";
import { getEdgarFundamentals } from "@/lib/ingest/edgar";

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
  return NextResponse.json(data);
}
