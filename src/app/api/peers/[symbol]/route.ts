import { yahooQuoteSummary } from "@/lib/yahooCrumb";
import { jsonCached } from "@/lib/httpCache";
import { aliasSymbol } from "@/lib/symbolAlias";

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

  // Autos — commercial + passenger + 2-wheelers. Tata Motors is now the CV entity
  // TMCV.NS post-demerger (both keys mapped so old links still resolve).
  "TMCV.NS": ["ASHOKLEY.NS", "M&M.NS", "EICHERMOT.NS", "MARUTI.NS"],
  "TATAMOTORS.NS": ["ASHOKLEY.NS", "M&M.NS", "EICHERMOT.NS", "MARUTI.NS"],
  "MARUTI.NS": ["M&M.NS", "TMCV.NS", "EICHERMOT.NS", "ASHOKLEY.NS"],
  "M&M.NS": ["MARUTI.NS", "TMCV.NS", "EICHERMOT.NS", "ASHOKLEY.NS"],
  "ASHOKLEY.NS": ["TMCV.NS", "EICHERMOT.NS", "M&M.NS", "MARUTI.NS"],
  "EICHERMOT.NS": ["ASHOKLEY.NS", "TVSMOTOR.NS", "BAJAJ-AUTO.NS", "HEROMOTOCO.NS"],
  "BAJAJ-AUTO.NS": ["HEROMOTOCO.NS", "TVSMOTOR.NS", "EICHERMOT.NS"],
  "HEROMOTOCO.NS": ["BAJAJ-AUTO.NS", "TVSMOTOR.NS", "EICHERMOT.NS"],
  "TVSMOTOR.NS": ["BAJAJ-AUTO.NS", "HEROMOTOCO.NS", "EICHERMOT.NS"],

  // Metals & mining
  "TATASTEEL.NS": ["JSWSTEEL.NS", "JINDALSTEL.NS", "SAIL.NS", "HINDALCO.NS"],
  "JSWSTEEL.NS": ["TATASTEEL.NS", "JINDALSTEL.NS", "SAIL.NS"],
  "JINDALSTEL.NS": ["TATASTEEL.NS", "JSWSTEEL.NS", "SAIL.NS"],
  "SAIL.NS": ["TATASTEEL.NS", "JSWSTEEL.NS", "JINDALSTEL.NS"],
  "HINDALCO.NS": ["VEDL.NS", "NATIONALUM.NS", "HINDZINC.NS"],
  "VEDL.NS": ["HINDALCO.NS", "NATIONALUM.NS", "HINDZINC.NS"],
  "NMDC.NS": ["SAIL.NS", "VEDL.NS", "HINDZINC.NS", "MOIL.NS"],
  "COALINDIA.NS": ["NMDC.NS", "SAIL.NS", "VEDL.NS"],

  // Banks & financials
  "HDFCBANK.NS": ["ICICIBANK.NS", "KOTAKBANK.NS", "AXISBANK.NS", "SBIN.NS"],
  "ICICIBANK.NS": ["HDFCBANK.NS", "AXISBANK.NS", "KOTAKBANK.NS", "SBIN.NS"],
  "AXISBANK.NS": ["ICICIBANK.NS", "HDFCBANK.NS", "KOTAKBANK.NS", "SBIN.NS"],
  "KOTAKBANK.NS": ["HDFCBANK.NS", "ICICIBANK.NS", "AXISBANK.NS"],
  "SBIN.NS": ["BANKBARODA.NS", "PNB.NS", "CANBK.NS", "ICICIBANK.NS"],
  "BAJFINANCE.NS": ["BAJAJFINSV.NS", "CHOLAFIN.NS", "SBICARD.NS", "SHRIRAMFIN.NS"],

  // IT services
  "TCS.NS": ["INFY.NS", "WIPRO.NS", "HCLTECH.NS", "TECHM.NS"],
  "INFY.NS": ["TCS.NS", "WIPRO.NS", "HCLTECH.NS", "TECHM.NS"],
  "WIPRO.NS": ["INFY.NS", "TCS.NS", "HCLTECH.NS", "TECHM.NS"],
  "HCLTECH.NS": ["TCS.NS", "INFY.NS", "WIPRO.NS", "TECHM.NS"],
  "TECHM.NS": ["INFY.NS", "WIPRO.NS", "HCLTECH.NS", "LTIM.NS"],
  "LTIM.NS": ["TCS.NS", "INFY.NS", "TECHM.NS", "MPHASIS.NS"],

  // Energy / oil & gas
  "RELIANCE.NS": ["ONGC.NS", "BPCL.NS", "IOC.NS", "HINDPETRO.NS"],
  "ONGC.NS": ["OIL.NS", "RELIANCE.NS", "BPCL.NS"],
  "BPCL.NS": ["IOC.NS", "HINDPETRO.NS", "ONGC.NS"],
  "IOC.NS": ["BPCL.NS", "HINDPETRO.NS", "ONGC.NS"],

  // FMCG
  "HINDUNILVR.NS": ["ITC.NS", "NESTLEIND.NS", "BRITANNIA.NS", "DABUR.NS"],
  "ITC.NS": ["HINDUNILVR.NS", "NESTLEIND.NS", "BRITANNIA.NS", "GODREJCP.NS"],
  "NESTLEIND.NS": ["HINDUNILVR.NS", "BRITANNIA.NS", "ITC.NS"],
  "BRITANNIA.NS": ["NESTLEIND.NS", "HINDUNILVR.NS", "ITC.NS"],
  "DABUR.NS": ["MARICO.NS", "GODREJCP.NS", "HINDUNILVR.NS", "COLPAL.NS"],

  // Pharma
  "SUNPHARMA.NS": ["DRREDDY.NS", "CIPLA.NS", "DIVISLAB.NS", "LUPIN.NS"],
  "DRREDDY.NS": ["SUNPHARMA.NS", "CIPLA.NS", "LUPIN.NS", "AUROPHARMA.NS"],
  "CIPLA.NS": ["SUNPHARMA.NS", "DRREDDY.NS", "LUPIN.NS"],

  // Cement, paints, telecom
  "ULTRACEMCO.NS": ["SHREECEM.NS", "AMBUJACEM.NS", "ACC.NS", "DALBHARAT.NS"],
  "SHREECEM.NS": ["ULTRACEMCO.NS", "AMBUJACEM.NS", "ACC.NS"],
  "ASIANPAINT.NS": ["BERGEPAINT.NS", "KANSAINER.NS", "AKZOINDIA.NS"],
  "BERGEPAINT.NS": ["ASIANPAINT.NS", "KANSAINER.NS", "AKZOINDIA.NS"],
  "BHARTIARTL.NS": ["IDEA.NS", "TATACOMM.NS", "INDUSTOWER.NS"],

  // Hospitality — so ITC Hotels gets hotels, not autos
  "ITCHOTELS.NS": ["INDHOTEL.NS", "EIHOTEL.NS", "CHALET.NS", "LEMONTREE.NS"],
  "INDHOTEL.NS": ["ITCHOTELS.NS", "EIHOTEL.NS", "CHALET.NS", "LEMONTREE.NS"],
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
  const symbol = aliasSymbol(params.symbol.toUpperCase());

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

  // 3) Filter to true peers. A company MUST match on INDUSTRY — we deliberately do
  //    NOT fall back to sector, because sectors are far too broad (e.g. "Consumer
  //    Cyclical" lumps car makers with hotels, which is how Tata Motors was getting
  //    ITC Hotels). Showing fewer correct peers — or an honest empty list — beats
  //    showing a wrong one. Funds/indexes (no base industry) keep the raw list.
  let chosen: PeerInfo[];
  if (!baseIndustry) {
    chosen = baseSector ? [] : valid; // classifiable company w/o industry → none; ETF/index → raw
  } else {
    chosen = valid.filter((p) => p.industry?.toLowerCase() === baseIndustry);
  }

  const peers = chosen.slice(0, 4).map((p) => p.symbol);
  // Peer lists are very stable — cache an hour.
  return jsonCached({ peers }, 3600, 7200);
}
