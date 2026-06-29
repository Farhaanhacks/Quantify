import { NextResponse } from "next/server";
import { resolveSymbol } from "@/lib/yahooCompany";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q") ?? "";
  if (!q.trim()) return NextResponse.json({ symbol: null });
  const r = await resolveSymbol(q.trim());
  return NextResponse.json(r ?? { symbol: null });
}
