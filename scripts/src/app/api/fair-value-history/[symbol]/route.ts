import { getFairValueHistory } from "@/lib/fairValueHistory";
import { jsonCached } from "@/lib/httpCache";
import { aliasSymbol } from "@/lib/symbolAlias";

export const dynamic = "force-dynamic";

// The recorded history of this company's cash-flow value against its share
// price. It accumulates one point per day — see lib/fairValueHistory for why it
// cannot be back-filled.
export async function GET(_req: Request, { params }: { params: { symbol: string } }) {
  const symbol = aliasSymbol(params.symbol.toUpperCase());
  try {
    const points = await getFairValueHistory(symbol);
    return jsonCached({ ok: true, symbol, points }, 300, 3600);
  } catch {
    return jsonCached({ ok: false, symbol, points: [] }, 60);
  }
}
