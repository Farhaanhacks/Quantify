import { getInstitutionalHistory } from "@/lib/institutional";
import { jsonCached } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { symbol: string } }) {
  try {
    const rows = await getInstitutionalHistory(params.symbol.toUpperCase());
    // 13F institutional ownership updates quarterly — cache an hour.
    return jsonCached({ available: rows.length > 0, rows }, 3600, 7200);
  } catch {
    return jsonCached({ available: false, rows: [] }, 60);
  }
}
