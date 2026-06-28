import { NextResponse } from "next/server";
import { getCongressTrades } from "@/lib/congress";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const trades = await getCongressTrades(30);
    return NextResponse.json({ available: trades.length > 0, trades });
  } catch {
    return NextResponse.json({ available: false, trades: [] });
  }
}
