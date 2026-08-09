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
  // ── US mega / large caps ────────────────────────────────────────────────
  // Yahoo's industry filter drops these (Apple's "Consumer Electronics" peers
  // are almost none), so we hand-pick the names investors actually compare.
  AAPL: ["MSFT", "GOOGL", "AMZN", "META"],
  MSFT: ["AAPL", "GOOGL", "AMZN", "ORCL"],
  GOOGL: ["META", "MSFT", "AMZN", "AAPL"],
  GOOG: ["META", "MSFT", "AMZN", "AAPL"],
  AMZN: ["MSFT", "GOOGL", "WMT", "AAPL"],
  META: ["GOOGL", "SNAP", "PINS", "AMZN"],
  NVDA: ["AMD", "AVGO", "INTC", "TSM"],
  AMD: ["NVDA", "INTC", "AVGO", "QCOM"],
  INTC: ["AMD", "NVDA", "TSM", "QCOM"],
  TSM: ["NVDA", "INTC", "AMD", "AVGO"],
  QCOM: ["AVGO", "NVDA", "TXN", "AMD"],
  AVGO: ["QCOM", "NVDA", "TXN", "AMD"],
  MU: ["WDC", "STX", "SNDK", "INTC"],
  TSLA: ["F", "GM", "RIVN", "NIO"],
  F: ["GM", "TSLA", "STLA", "TM"],
  GM: ["F", "TSLA", "STLA", "TM"],
  NFLX: ["DIS", "WBD", "PARA", "CMCSA"],
  DIS: ["NFLX", "WBD", "CMCSA", "PARA"],
  JPM: ["BAC", "WFC", "C", "GS"],
  BAC: ["JPM", "WFC", "C", "USB"],
  WFC: ["JPM", "BAC", "C", "USB"],
  GS: ["MS", "JPM", "BAC", "C"],
  MS: ["GS", "JPM", "BAC", "C"],
  V: ["MA", "AXP", "PYPL", "DFS"],
  MA: ["V", "AXP", "PYPL", "DFS"],
  PYPL: ["SQ", "V", "MA", "COIN"],
  KO: ["PEP", "KDP", "MNST", "CCEP"],
  PEP: ["KO", "MDLZ", "KDP", "MNST"],
  WMT: ["TGT", "COST", "AMZN", "KR"],
  COST: ["WMT", "TGT", "KR", "BJ"],
  TGT: ["WMT", "COST", "KR", "DG"],
  PG: ["KMB", "CL", "UL", "CHD"],
  JNJ: ["PFE", "MRK", "ABBV", "LLY"],
  PFE: ["MRK", "JNJ", "ABBV", "BMY"],
  MRK: ["PFE", "JNJ", "ABBV", "BMY"],
  LLY: ["NVO", "MRK", "PFE", "ABBV"],
  UNH: ["ELV", "CI", "HUM", "CVS"],
  XOM: ["CVX", "COP", "SLB", "BP"],
  CVX: ["XOM", "COP", "SLB", "EOG"],
  BA: ["LMT", "RTX", "GD", "NOC"],
  LMT: ["RTX", "NOC", "GD", "BA"],
  CRM: ["MSFT", "ORCL", "ADBE", "NOW"],
  ADBE: ["CRM", "MSFT", "ORCL", "NOW"],
  ORCL: ["MSFT", "CRM", "SAP", "IBM"],
  IBM: ["ORCL", "ACN", "SAP", "HPE"],
  UBER: ["LYFT", "DASH", "ABNB", "GRAB"],
  ABNB: ["BKNG", "EXPE", "MAR", "UBER"],
  COIN: ["HOOD", "PYPL", "SQ", "MSTR"],
  SNDK: ["WDC", "STX", "MU", "NTAP"],
  WDC: ["STX", "SNDK", "MU", "NTAP"],

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
  // Not HINDZINC — Hindustan Zinc is Vedanta's own ~65%-owned subsidiary.
  "VEDL.NS": ["HINDALCO.NS", "NATIONALUM.NS", "NMDC.NS", "JINDALSTEL.NS"],
  "NMDC.NS": ["SAIL.NS", "VEDL.NS", "HINDZINC.NS", "MOIL.NS"],
  "COALINDIA.NS": ["NMDC.NS", "SAIL.NS", "VEDL.NS"],

  // Banks & financials
  "HDFCBANK.NS": ["ICICIBANK.NS", "KOTAKBANK.NS", "AXISBANK.NS", "SBIN.NS"],
  "ICICIBANK.NS": ["HDFCBANK.NS", "AXISBANK.NS", "KOTAKBANK.NS", "SBIN.NS"],
  "AXISBANK.NS": ["ICICIBANK.NS", "HDFCBANK.NS", "KOTAKBANK.NS", "SBIN.NS"],
  "KOTAKBANK.NS": ["HDFCBANK.NS", "ICICIBANK.NS", "AXISBANK.NS"],
  "SBIN.NS": ["BANKBARODA.NS", "PNB.NS", "CANBK.NS", "ICICIBANK.NS"],
  // Not BAJAJFINSV — Bajaj Finserv is Bajaj Finance's own parent holdco.
  "BAJFINANCE.NS": ["CHOLAFIN.NS", "SHRIRAMFIN.NS", "SBICARD.NS", "MUTHOOTFIN.NS"],

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
  // Vodafone Idea and Jio (Reliance) are the real rivals; Indus Towers is a
  // part-owned Airtel associate (passive tower infra), so keep it out of the top 3.
  "BHARTIARTL.NS": ["IDEA.NS", "RELIANCE.NS", "TATACOMM.NS", "INDUSTOWER.NS"],

  // Hospitality — so ITC Hotels gets hotels, not autos
  "ITCHOTELS.NS": ["INDHOTEL.NS", "EIHOTEL.NS", "CHALET.NS", "LEMONTREE.NS"],
  "INDHOTEL.NS": ["ITCHOTELS.NS", "EIHOTEL.NS", "CHALET.NS", "LEMONTREE.NS"],

  // ── Adani group ─────────────────────────────────────────────────────────
  // Peers must be EXTERNAL competitors, never same-group sister companies —
  // ADANIENT vs ADANIPORTS/ADANIPOWER is comparing the group to itself (they all
  // co-move on Adani sentiment), which tells the user nothing. Hand-picked by what
  // each entity actually does against non-Adani names.
  "ADANIENT.NS": ["RELIANCE.NS", "LT.NS", "ITC.NS", "GRASIM.NS"], // diversified conglomerates
  "ADANIPORTS.NS": ["JSWINFRA.NS", "CONCOR.NS", "GMRAIRPORT.NS", "GPPL.NS"], // ports / logistics / infra
  "ADANIPOWER.NS": ["NTPC.NS", "TATAPOWER.NS", "JSWENERGY.NS", "NHPC.NS"],
  "ADANIGREEN.NS": ["TATAPOWER.NS", "JSWENERGY.NS", "NHPC.NS", "SUZLON.NS"], // power / renewables
  "ADANIENSOL.NS": ["POWERGRID.NS", "TATAPOWER.NS", "NTPC.NS", "JSWENERGY.NS"],
  "ATGL.NS": ["IGL.NS", "MGL.NS", "GUJGASLTD.NS", "GAIL.NS"],
  "AWL.NS": ["MARICO.NS", "TATACONSUM.NS", "PATANJALI.NS", "NESTLEIND.NS"],
  "AMBUJACEM.NS": ["ULTRACEMCO.NS", "ACC.NS", "SHREECEM.NS", "DALBHARAT.NS"],
  "ACC.NS": ["ULTRACEMCO.NS", "AMBUJACEM.NS", "SHREECEM.NS", "DALBHARAT.NS"],

  // ── Power & utilities ───────────────────────────────────────────────────
  "NTPC.NS": ["POWERGRID.NS", "TATAPOWER.NS", "ADANIPOWER.NS", "NHPC.NS"],
  "POWERGRID.NS": ["NTPC.NS", "ADANIENSOL.NS", "TATAPOWER.NS", "NHPC.NS"],
  "TATAPOWER.NS": ["NTPC.NS", "ADANIPOWER.NS", "JSWENERGY.NS", "POWERGRID.NS"],
  "JSWENERGY.NS": ["TATAPOWER.NS", "ADANIPOWER.NS", "NTPC.NS", "NHPC.NS"],
  "NHPC.NS": ["NTPC.NS", "SJVN.NS", "POWERGRID.NS", "TATAPOWER.NS"],
  "GAIL.NS": ["IGL.NS", "MGL.NS", "GUJGASLTD.NS", "PETRONET.NS"],
  "IGL.NS": ["MGL.NS", "GUJGASLTD.NS", "ATGL.NS", "GAIL.NS"],

  // ── Engineering / capital goods / defence ──────────────────────────────
  "LT.NS": ["SIEMENS.NS", "ABB.NS", "BHEL.NS", "BEL.NS"],
  "SIEMENS.NS": ["ABB.NS", "LT.NS", "BHEL.NS", "CGPOWER.NS"],
  "ABB.NS": ["SIEMENS.NS", "CGPOWER.NS", "LT.NS", "BHEL.NS"],
  "BEL.NS": ["HAL.NS", "BDL.NS", "MAZDOCK.NS", "COCHINSHIP.NS"],
  "HAL.NS": ["BEL.NS", "BDL.NS", "MAZDOCK.NS", "COCHINSHIP.NS"],

  // ── Consumer / retail / jewellery ──────────────────────────────────────
  "TITAN.NS": ["KALYANKJIL.NS", "SENCO.NS", "PCJEWELLER.NS", "RAJESHEXPO.NS"],
  "DMART.NS": ["TRENT.NS", "VMART.NS", "ABFRL.NS", "NYKAA.NS"],
  "TRENT.NS": ["DMART.NS", "ABFRL.NS", "VMART.NS", "NYKAA.NS"],
  "TATACONSUM.NS": ["NESTLEIND.NS", "BRITANNIA.NS", "HINDUNILVR.NS", "MARICO.NS"],
  "MARICO.NS": ["DABUR.NS", "GODREJCP.NS", "TATACONSUM.NS", "COLPAL.NS"],
  "VBL.NS": ["HINDUNILVR.NS", "NESTLEIND.NS", "TATACONSUM.NS", "BRITANNIA.NS"], // Varun Beverages
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

  // 3) Filter to true peers. Prefer an exact INDUSTRY match — the tightest,
  //    most-correct set. But if that yields fewer than two names (common: Yahoo's
  //    recommendations for a company are often in adjacent industries, e.g. Apple's
  //    are Software/Internet, not "Consumer Electronics"), fall back to same-SECTOR
  //    so the user still sees comparables instead of an empty box. The handful of
  //    sectors where that's misleading (autos vs hotels) are already handled by the
  //    curated overrides above, which win before we ever get here.
  let chosen: PeerInfo[];
  if (!baseIndustry) {
    chosen = baseSector ? [] : valid; // classifiable company w/o industry → none; ETF/index → raw
  } else {
    const sameIndustry = valid.filter((p) => p.industry?.toLowerCase() === baseIndustry);
    if (sameIndustry.length >= 2) {
      chosen = sameIndustry;
    } else {
      const sameSector = baseSector
        ? valid.filter((p) => p.sector?.toLowerCase() === baseSector)
        : [];
      chosen = sameSector.length >= sameIndustry.length ? sameSector : sameIndustry;
    }
  }

  const peers = chosen.slice(0, 4).map((p) => p.symbol);
  // Peer lists are very stable — cache an hour.
  return jsonCached({ peers }, 3600, 7200);
}
