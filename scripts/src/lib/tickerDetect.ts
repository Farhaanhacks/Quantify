import { popularTickers } from "@/data/popularTickers";

// Detects the stocks mentioned in a piece of text against (a) the full SEC
// universe of US-listed companies (~10k, fetched + cached), (b) a curated set of
// Indian names, and (c) index aliases. Runs on the server so the ~10k-name map
// never ships to the browser. Heuristic by nature — broad coverage, not perfect.

const SEC_UA = "Quantifi research app (contact: research@quantifi.app)";

const ALIASES: { re: RegExp; ticker: string }[] = [
  { re: /\bs&p\s*500\b|\bsp\s*500\b|\bspx\b|\bs and p 500\b/i, ticker: "SPY" },
  { re: /\bnasdaq\s*100\b|\bnasdaq\b|\bndx\b/i, ticker: "QQQ" },
  { re: /\bdow jones\b|\bdjia\b|\bdow industrials\b|\bthe dow\b/i, ticker: "DIA" },
  { re: /\brussell\s*2000\b/i, ticker: "IWM" },
  { re: /\bsemiconductor(s)?\b|\bchip stocks\b|\bsox\b/i, ticker: "SOXX" },
  { re: /\bwall street\b|\bu\.?s\.? stocks\b|\bamerican (stocks|market|markets|equities|shares)\b|\bus equities\b/i, ticker: "SPY" },
  { re: /\bsensex\b|\bnifty\b|\bnse\b|\bbse\b|\bdalal street\b|\bindian (stocks|shares|equities|market|markets)\b/i, ticker: "NIFTYBEES.NS" },
];

// Company names that clean down to a single common English word. Matching these
// as prose would misfire badly — e.g. MicroStrategy rebranded to "Strategy", so
// the bare word "strategy" (as in "growth strategy") must NOT pull in MSTR and
// its preferred-share tickers. Such names can still be detected by their ticker
// symbol via the all-caps pass below.
const STOP_NAME = new Set([
  "first", "general", "american", "national", "united", "global", "capital",
  "energy", "financial", "group", "holdings", "international", "industries",
  "systems", "solutions", "services", "resources", "partners", "trust", "fund",
  "income", "growth", "corporate", "enterprise", "digital", "data", "health",
  "medical", "power", "water", "gold", "silver", "mining", "banks", "retail",
  "media", "networks", "global", "value", "core", "select", "premier",
  "strategy", "strategies", "momentum", "quality", "dividend", "opportunity",
  "opportunities", "innovation", "technology", "technologies", "dynamics",
  "materials", "properties", "advantage", "signal", "sector", "index",
]);

// Single-word company names that also name a completely different, better-known
// business in another market. Matching the bare word attaches the wrong listing.
//
// The case that prompted this: SEC's company file lists "Reliance, Inc." (RS, a
// US metals distributor), which cleans down to just "reliance" — so every Indian
// headline about the Reliance group resolved to a US metals stock. Worse, some
// of those headlines are about Reliance Capital, which was delisted from BSE and
// NSE after its NCLT resolution and acquisition by IndusInd International
// Holdings, so there is no tradeable listing to point at in the first place.
//
// Names here are still reachable when qualified ("Reliance Industries" →
// RELIANCE.NS via the curated list) or by their all-caps symbol. A bare mention
// resolves to nothing, which is the correct answer: no ticker beats the wrong
// ticker.
const AMBIGUOUS_NAME = new Set(["reliance"]);

// A name is only usable as a prose keyword if it's long enough to be
// distinctive, isn't a bare English word, and isn't a known cross-market
// collision.
function usableName(kw: string, min: number): boolean {
  return kw.length >= min && !STOP_NAME.has(kw) && !AMBIGUOUS_NAME.has(kw);
}

// ETFs are absent from SEC company_tickers.json (that file is operating
// companies), so a named ETF ticker like MSOS would never be recognised. Seed a
// curated set of widely-covered ETFs so their tickers are detectable in prose.
const CURATED_ETFS = [
  "SPY", "VOO", "IVV", "VTI", "QQQ", "DIA", "IWM", "RSP", "MDY",
  "XLK", "XLF", "XLE", "XLY", "XLP", "XLI", "XLB", "XLU", "XLRE", "XLC", "XLV",
  "SMH", "SOXX", "IGV", "VGT", "ARKK", "ARKG", "ARKW", "ARKF",
  "TAN", "ICLN", "LIT", "XBI", "IBB", "KRE", "KBE", "ITB", "XHB", "PAVE",
  "GDX", "GDXJ", "SIL", "GLD", "IAU", "SLV", "USO", "UNG", "XOP", "OIH", "URA", "URNM",
  "MSOS", "MSOX", "YOLO", "MJ", "POTX", "THCX", "MJUS",
  "KWEB", "FXI", "MCHI", "EEM", "EFA", "VEA", "VWO", "INDA", "EWZ", "EWJ",
  "HACK", "BUG", "BOTZ", "ROBO", "DRIV", "IDRV", "JETS", "SKYY", "FINX",
  "TLT", "IEF", "SHY", "HYG", "LQD", "AGG", "BND", "TIP", "MUB",
  "VNQ", "SCHD", "VIG", "VYM", "DVY", "NOBL", "JEPI", "JEPQ", "DGRO", "SPHD",
  "BITO", "IBIT", "FBTC", "GBTC", "ETHE", "BITB",
];

const STOP_TICKER = new Set([
  "CEO", "CFO", "COO", "CTO", "GDP", "CPI", "USA", "USD", "EUR", "GBP", "INR",
  "API", "FAQ", "ETF", "IPO", "SEC", "FDA", "FBI", "IRS", "NYSE", "AGM", "EPS",
  "YOY", "QOQ", "AI", "EV", "UK", "EU", "UN", "FY", "ALL", "ARE", "NEW", "NOW",
  "ONE", "OUT", "OWN", "WHO", "WHY", "HOW", "CAN", "GET", "HAS", "HAD", "SEE",
  "TOP", "BIG", "CES", "ESG", "OIL", "GAS", "WAR", "TAX", "JOB", "JOBS", "USE",
]);

const CLEAN =
  /\b(inc|incorporated|corp|corporation|company|co|ltd|limited|plc|llc|lp|holding|holdings|group|the|class|common|stock|shares|share|ordinary|adr|sa|nv|ag|se)\b/gi;

function cleanName(title: string): string {
  return title
    .toLowerCase()
    .replace(/&amp;/g, " ")
    .replace(CLEAN, " ")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

interface Entry { ticker: string; kw: string }

let cachedNames: Entry[] | null = null;
let cachedSyms: Set<string> | null = null;
let cachedAt = 0;

async function loadUniverse(): Promise<{ names: Entry[]; syms: Set<string> }> {
  if (cachedNames && cachedSyms && Date.now() - cachedAt < 86_400_000) {
    return { names: cachedNames, syms: cachedSyms };
  }
  const names: Entry[] = [];
  const syms = new Set<string>();

  try {
    const r = await fetch("https://www.sec.gov/files/company_tickers.json", {
      headers: { "User-Agent": SEC_UA },
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(9000),
    });
    if (r.ok) {
      const j = (await r.json()) as Record<string, { ticker?: string; title?: string }>;
      for (const k in j) {
        const t = j[k]?.ticker;
        const title = j[k]?.title;
        if (!t || !title) continue;
        const sym = t.toUpperCase();
        syms.add(sym);
        const kw = cleanName(title);
        if (usableName(kw, 5)) names.push({ ticker: sym, kw });
      }
    }
  } catch {
    /* fall back to curated list below */
  }

  // Always include curated names (India + supplemental) so coverage never regresses.
  for (const p of popularTickers) {
    const kw = cleanName(p.n);
    if (usableName(kw, 4)) names.push({ ticker: p.s, kw });
    syms.add(p.s.replace(/\.(NS|BO)$/, "").toUpperCase());
  }

  // Curated ETF tickers (not in the SEC company file) so named ETFs resolve.
  for (const t of CURATED_ETFS) syms.add(t);

  cachedNames = names;
  cachedSyms = syms;
  cachedAt = Date.now();
  return { names, syms };
}

export async function detectTickersServer(text: string): Promise<string[]> {
  const { names, syms } = await loadUniverse();
  const found = new Set<string>();

  for (const { re, ticker } of ALIASES) if (re.test(text)) found.add(ticker);

  const norm = ` ${text.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ")} `;
  for (const e of names) {
    if (norm.includes(` ${e.kw} `)) found.add(e.ticker);
  }

  // All-caps tokens that are real tickers (headlines are Title Case, so plain
  // words like "All" won't match; only genuine all-caps symbols do).
  const tokens = text.match(/\b[A-Z]{3,5}\b/g) ?? [];
  for (const tok of tokens) {
    if (!STOP_TICKER.has(tok) && syms.has(tok)) found.add(tok);
  }

  return Array.from(found).slice(0, 10);
}
