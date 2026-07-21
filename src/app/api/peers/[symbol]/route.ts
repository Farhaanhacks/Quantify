import { yahooQuoteSummary } from "@/lib/yahooCrumb";
import { jsonCached } from "@/lib/httpCache";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const str = (x: unknown): string | undefined =>
  typeof x === "string" && x.length ? x : undefined;

// Curated peer overrides. Yahoo's "people also watch" feed is unreliable for
// newly-listed and Indian names (it returns 0–1 loosely-related tickers — e.g.
// Meesho → only Swiggy), so for these we hand-pick the real competitors. Keyed
// by the exact symbol; the generic Yahoo path still handles everything else.
// Extend this map as needed — it's the correctness lever for headline names.
const PEER_OVERRIDES: Record<string, string[]> = {
  // Indian new-age consumer-internet / e-commerce / marketplaces
  "MEESHO.NS": ["ETERNAL.NS", "NYKAA.NS", "SWIGGY.NS", "PAYTM.NS"],
  "SWIGGY.NS": ["ETERNAL.NS", "NYKAA.NS", "MEESHO.NS", "PAYTM.NS"],
  "NYKAA.NS": ["ETERNAL.NS", "TRENT.NS", "MEESHO.NS", "SWIGGY.NS"],
  "ETERNAL.NS": ["SWIGGY.NS", "NYKAA.NS", "MEESHO.NS", "PAYTM.NS"], // Zomato → Eternal Ltd
  "ZOMATO.NS": ["SWIGGY.NS", "NYKAA.NS", "MEESHO.NS", "PAYTM.NS"],
  "PAYTM.NS": ["POLICYBZR.NS", "NYKAA.NS", "ETERNAL.NS", "MEESHO.NS"],
  "POLICYBZR.NS": ["PAYTM.NS", "NYKAA.NS", "ETERNAL.NS"],
  "NAUKRI.NS": ["ETERNAL.NS", "PAYTM.NS", "NYKAA.NS"], // Info Edge
};

function overrideFor(symbol: string): string[] | null {
  const bare = symbol.replace(/\.(NS|BO)$/i, "");
  const list = PEER_OVERRIDES[symbol] || PEER_OVERRIDES[`${bare}.NS`] || PEER_OVERRIDES[bare];
  if (!list) return null;
  return list.filter((s) => s.toUpperCase() !== symbol.toUpperCase()).slice(0, 4);
}

interface PeerInfo {
  symbol: string;
  sector?: string;
  industry?: string;
}

// A candidate's classification, so we can keep only same-industry names.
async function classify(symbol: string): Promise<PeerInfo | null> {
  const r = await yahooQuoteSummary(symbol, "assetProfile,quoteType", 86400);
  if (!r) return null;
  const ap = (r.assetProfile ?? {}) as Record<string, unknown>;
  return { symbol, sector: str(ap.sector), industry: str(ap.industry) };
}

// Related symbols for a stock or ETF. The raw "people also watch" list is noisy
// for illiquid names (it returns unrelated tickers), so for an actual company we
// validate candidates against the base company's INDUSTRY (then sector) and drop
// anything that isn't a genuine peer. Funds/indexes (no assetProfile industry)
// keep the raw similar-symbol list, which is already comparable.
export async function GET(
  _req: Request,
  { params }: { params: { symbol: string } }
) {
  const symbol = params.symbol.toUpperCase();

  // 0) Curated override wins — hand-picked real competitors for names where
  //    Yahoo's peer feed is unreliable (e.g. Meesho).
  const override = overrideFor(symbol);
  if (override && override.length) return jsonCached({ peers: override }, 3600, 7200);

  // 1) Candidate symbols.
  let candidates: string[] = [];
  try {
    const res = await fetch(
      `https://query2.finance.yahoo.com/v6/finance/recommendationsbysymbol/${encodeURIComponent(
        symbol
      )}`,
      { headers: { "User-Agent": UA }, next: { revalidate: 86400 }, signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const json = (await res.json()) as {
        finance?: { result?: { recommendedSymbols?: { symbol?: string }[] }[] };
      };
      candidates = (json?.finance?.result?.[0]?.recommendedSymbols ?? [])
        .map((r) => String(r.symbol ?? "").toUpperCase())
        .filter((s) => s && s !== symbol)
        .slice(0, 6);
    }
  } catch {
    /* fall through */
  }
  if (!candidates.length) return jsonCached({ peers: [] }, 600);

  // 2) Base classification + candidate classifications (parallel, cached).
  const [base, ...infos] = await Promise.all([
    classify(symbol),
    ...candidates.map(classify),
  ]);
  const valid = infos.filter((x): x is PeerInfo => !!x);

  const baseIndustry = base?.industry?.toLowerCase();
  const baseSector = base?.sector?.toLowerCase();

  // 3) Filter to true peers. Funds/indexes (no base industry/sector) keep the
  //    raw list; companies must match industry, else sector.
  let chosen: PeerInfo[];
  if (!baseIndustry && !baseSector) {
    chosen = valid; // base isn't a classifiable company (ETF/index) → keep raw
  } else {
    chosen = valid.filter((p) => baseIndustry && p.industry?.toLowerCase() === baseIndustry);
    if (chosen.length < 2 && baseSector) {
      const bySector = valid.filter((p) => p.sector?.toLowerCase() === baseSector);
      if (bySector.length > chosen.length) chosen = bySector;
    }
  }

  const peers = chosen.slice(0, 4).map((p) => p.symbol);
  // Peer lists are very stable — cache an hour.
  return jsonCached({ peers }, 3600, 7200);
}
