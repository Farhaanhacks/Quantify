import { NextResponse } from "next/server";
import { getCongressTrades } from "@/lib/congress";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ticker = new URL(req.url).searchParams.get("ticker") ?? undefined;
  try {
    const trades = await getCongressTrades({ limit: ticker ? 60 : 40, ticker });
    return NextResponse.json({ available: trades.length > 0, trades });
  } catch {
    return NextResponse.json({ available: false, trades: [] });
  }
}
