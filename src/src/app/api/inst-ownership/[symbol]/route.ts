import { NextResponse } from "next/server";
import { getInstitutionalHistory } from "@/lib/institutional";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { symbol: string } }) {
  try {
    const rows = await getInstitutionalHistory(params.symbol.toUpperCase());
    return NextResponse.json({ available: rows.length > 0, rows });
  } catch {
    return NextResponse.json({ available: false, rows: [] });
  }
}
