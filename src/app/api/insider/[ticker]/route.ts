import { NextResponse } from "next/server";
import { getCompanyInsiderTrades } from "@/lib/insider";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { ticker: string } }) {
  try {
    const trades = await getCompanyInsiderTrades(params.ticker, 15);
    return NextResponse.json({ available: trades.length > 0, trades });
  } catch {
    return NextResponse.json({ available: false, trades: [] });
  }
}
