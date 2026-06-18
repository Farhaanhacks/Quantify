import { NextResponse } from "next/server";
import { getYahooCompany } from "@/lib/yahooCompany";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const data = await getYahooCompany(params.symbol);
    if (!data) return NextResponse.json({ available: false });
    return NextResponse.json({ available: true, data });
  } catch (err) {
    console.error("[company] failed:", err);
    return NextResponse.json({ available: false });
  }
}
