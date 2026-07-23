import { NextResponse } from "next/server";
import { resolveSymbol } from "@/lib/yahooCompany";
import { aliasSymbol, nameToTicker } from "@/lib/symbolAlias";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  if (!q) return NextResponse.json({ symbol: null });

  // 1) Curated name→ticker map first — reliable for names Yahoo's (rate-limited)
  //    search misses, e.g. "Sandisk" → SNDK.
  const curated = nameToTicker(q);
  if (curated) return NextResponse.json({ symbol: curated });

  // 2) Yahoo search for everything else.
  const r = await resolveSymbol(q);
  if (r?.symbol) return NextResponse.json({ symbol: aliasSymbol(r.symbol), name: r.name });

  // 3) Nothing resolved — return the raw upper-cased input so the caller can still
  //    try it as a literal ticker (aliased for known renames).
  return NextResponse.json({ symbol: aliasSymbol(q.toUpperCase()) });
}
