import { NextResponse } from "next/server";
import { getRecentInsiderTrades } from "@/lib/insider";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const trades = await getRecentInsiderTrades(18);
    return NextResponse.json({ available: trades.length > 0, trades });
  } catch {
    return NextResponse.json({ available: false, trades: [] });
  }
}
