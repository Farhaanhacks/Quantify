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

const STOP_NAME = new Set([
  "first", "general", "american", "national", "united", "global", "capital",
  "energy", "financial", "group", "holdings", "international", "industries",
  "systems", "solutions", "services", "resources", "partners", "trust", "fund",
  "income", "growth", "corporate", "enterprise", "digital", "data", "health",
  "medical", "power", "water", "gold", "silver", "mining", "banks", "retail",
  "media", "networks", "global", "value", "core", "select", "premier",
]);

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
        if (kw.length >= 5 && !STOP_NAME.has(kw)) names.push({ ticker: sym, kw });
      }
    }
  } catch {
    /* fall back to curated list below */
  }

  // Always include curated names (India + supplemental) so coverage never regresses.
  for (const p of popularTickers) {
    const kw = cleanName(p.n);
    if (kw.length >= 4) names.push({ ticker: p.s, kw });
    syms.add(p.s.replace(/\.(NS|BO)$/, "").toUpperCase());
  }

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
