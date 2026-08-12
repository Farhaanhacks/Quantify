import { SECTOR_MAP } from "@/data/sectors";

// The companies each market's heatmap can draw, with the sector they belong to.
//
// These are curated large-cap lists, not full index constituents — the same
// footing the US and India lists have always been on. Two things make that
// safe rather than sloppy:
//
//   1. A tile is only drawn for a symbol that comes back from Yahoo with a live
//      market cap and day change. A ticker listed here that is wrong, renamed
//      or delisted therefore produces NO tile — it can never produce a wrong
//      one. The failure mode is a missing company, not a false figure.
//   2. The heatmap is explicitly labelled "top N by market cap", so it does not
//      claim to be the whole index.
//
// US and India are read from SECTOR_MAP rather than repeated here, so the
// portfolio risk lens and the heatmap cannot disagree about a company's sector.

export interface RegionDef {
  key: string;
  label: string;
  /** Yahoo exchange suffix, "" for US. Used only for documentation here. */
  suffix: string;
}

export const REGIONS: RegionDef[] = [
  { key: "us", label: "US", suffix: "" },
  { key: "in", label: "India", suffix: ".NS" },
  { key: "uk", label: "UK", suffix: ".L" },
  { key: "ca", label: "Canada", suffix: ".TO" },
  { key: "au", label: "Australia", suffix: ".AX" },
  { key: "jp", label: "Japan", suffix: ".T" },
  { key: "de", label: "Germany", suffix: ".DE" },
  { key: "fr", label: "France", suffix: ".PA" },
  { key: "hk", label: "Hong Kong", suffix: ".HK" },
];

export const REGION_KEYS = REGIONS.map((r) => r.key);

type Lists = Record<string, string[]>;

/** Expand { sector: [codes] } into { "CODE.SUFFIX": sector }. */
function expand(lists: Lists, suffix: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [sector, codes] of Object.entries(lists)) {
    for (const c of codes) out[`${c}${suffix}`] = sector;
  }
  return out;
}

const UK: Lists = {
  Energy: ["SHEL", "BP"],
  "Health Care": ["AZN", "GSK", "HIK"],
  "Consumer Staples": ["ULVR", "DGE", "BATS", "RKT", "TSCO", "SBRY", "IMB"],
  Financials: ["HSBA", "BARC", "LLOY", "NWG", "PRU", "LGEN", "AV", "STAN", "III", "SDR"],
  Materials: ["RIO", "GLEN", "AAL", "ANTO", "MNDI", "CRDA"],
  Industrials: ["BA", "RR", "EXPN", "RELX", "SMIN", "MRO", "WEIR"],
  "Consumer Discretionary": ["NXT", "BDEV", "PSN", "IHG", "WTB", "JD", "BKG", "TW"],
  Utilities: ["NG", "SSE", "SVT", "UU", "CNA"],
  "Communication Services": ["VOD", "BT-A", "ITV", "WPP", "INF"],
  "Real Estate": ["LAND", "BLND", "SGRO"],
  Technology: ["SGE"],
};

const CANADA: Lists = {
  Financials: ["RY", "TD", "BNS", "BMO", "CM", "MFC", "SLF", "NA", "IFC", "GWO"],
  Energy: ["ENB", "CNQ", "SU", "TRP", "PPL", "IMO", "CVE", "TOU"],
  Materials: ["ABX", "AEM", "WPM", "FNV", "NTR", "K", "CCO"],
  Industrials: ["CNR", "CP", "WCN", "TFII", "TRI"],
  "Communication Services": ["BCE", "T", "RCI-B"],
  Technology: ["SHOP", "CSU", "OTEX"],
  "Consumer Staples": ["L", "ATD", "MRU"],
  "Consumer Discretionary": ["QSR", "DOL", "MG"],
  Utilities: ["FTS", "EMA", "H"],
};

const AUSTRALIA: Lists = {
  Financials: ["CBA", "WBC", "ANZ", "NAB", "MQG", "QBE", "SUN"],
  Materials: ["BHP", "RIO", "FMG", "S32", "NST", "PLS", "MIN", "JHX", "AMC"],
  "Health Care": ["CSL", "RMD", "COH", "SHL"],
  "Consumer Staples": ["WOW", "COL", "TWE"],
  "Consumer Discretionary": ["WES", "JBH", "HVN", "ALL", "DMP"],
  "Communication Services": ["TLS", "REA", "CAR", "SEK"],
  Industrials: ["TCL", "QAN", "BXB"],
  Energy: ["WDS", "STO"],
  "Real Estate": ["GMG", "SCG", "SGP"],
  Utilities: ["AGL", "ORG"],
  Technology: ["XRO", "WTC", "ALU"],
};

// Tokyo listings are numeric codes.
const JAPAN: Lists = {
  "Consumer Discretionary": ["7203", "6758", "6902", "7267", "9983", "4661", "5108"],
  Technology: ["6861", "8035", "6971"],
  Financials: ["8306", "8316", "8411", "8766", "8591"],
  "Communication Services": ["9432", "9984", "7974", "9433"],
  Industrials: ["6098", "6501", "8058", "8001", "6273", "6367", "6594", "9022", "7011"],
  Materials: ["4063", "4188", "5401"],
  "Health Care": ["4502", "4568", "7741", "4519"],
  "Consumer Staples": ["2914", "2802"],
};

const GERMANY: Lists = {
  Technology: ["SAP", "IFX"],
  Industrials: ["SIE", "AIR", "DHL", "ENR", "MTX"],
  Financials: ["ALV", "DBK", "MUV2", "DB1"],
  "Communication Services": ["DTE"],
  "Consumer Discretionary": ["MBG", "BMW", "VOW3", "ADS", "P911", "CON", "ZAL"],
  Materials: ["BAS", "HEI", "SY1"],
  "Health Care": ["BAYN", "MRK", "SHL", "FRE"],
  Utilities: ["RWE", "EOAN"],
  "Real Estate": ["VNA"],
  "Consumer Staples": ["BEI", "HEN3"],
};

const FRANCE: Lists = {
  "Consumer Discretionary": ["MC", "RMS", "KER", "STLAP", "ML"],
  "Consumer Staples": ["OR", "RI", "BN"],
  Energy: ["TTE"],
  "Health Care": ["SAN", "EL"],
  Materials: ["AI"],
  Industrials: ["SU", "AIR", "DG", "SGO", "LR", "SAF", "HO"],
  Financials: ["BNP", "CS", "ACA", "GLE"],
  "Communication Services": ["ORA", "PUB"],
  Utilities: ["VIE", "ENGI"],
  Technology: ["CAP"],
};

// Hong Kong codes are zero-padded to four digits on Yahoo.
const HONG_KONG: Lists = {
  "Communication Services": ["0700", "0941", "9999"],
  "Consumer Discretionary": ["9988", "3690", "2020", "1211", "2331", "9618", "0027"],
  Financials: ["0005", "1299", "0939", "1398", "2318", "0388", "0011"],
  Energy: ["0883", "0857", "0386"],
  Technology: ["1810", "0981"],
  "Health Care": ["2269", "1093"],
  "Real Estate": ["0016", "1109", "0688"],
  Industrials: ["0001"],
  Utilities: ["0002", "0003"],
};

const CURATED: Record<string, Record<string, string>> = {
  uk: expand(UK, ".L"),
  ca: expand(CANADA, ".TO"),
  au: expand(AUSTRALIA, ".AX"),
  jp: expand(JAPAN, ".T"),
  de: expand(GERMANY, ".DE"),
  fr: expand(FRANCE, ".PA"),
  hk: expand(HONG_KONG, ".HK"),
};

/** Region key → the SECTOR_MAP region string it corresponds to. */
const FROM_SECTOR_MAP: Record<string, string> = {
  us: "United States",
  in: "India",
};

// "Technology" is too coarse a bucket for a treemap. In the US it swallows a
// third of the market's value, so chip makers and software houses — businesses
// with almost nothing in common — end up in one block, and the block is so
// large that everything inside it is squeezed small.
//
// Splitting it the way market-structure classifications do (hardware and
// semiconductors on one side, software and IT services on the other) gives two
// legible blocks whose moves actually mean different things.
//
// Only the heatmap sees this. SECTOR_MAP keeps its GICS sectors, because the
// portfolio risk lens buckets holdings against those and should not silently
// change what "Technology" means to an existing user.
const ELECTRONIC_TECH = new Set([
  // US hardware, semiconductors, networking and devices
  "AAPL", "NVDA", "AVGO", "AMD", "INTC", "QCOM", "TXN", "CSCO", "AMAT", "MU",
  "LRCX", "KLAC", "ADI", "HPQ", "DELL", "HPE", "ANET", "SMCI", "ARM", "ASML",
  "MRVL", "ON", "NXPI", "MCHP", "GLW", "STX", "WDC",
  // Japan
  "6861.T", "8035.T", "6971.T",
  // Germany
  "IFX.DE",
  // Hong Kong
  "1810.HK", "0981.HK",
]);

// Second share classes of a company already in the list.
//
// Alphabet appeared twice — GOOGL (class A) and GOOG (class C) — as two tiles
// for one company. Beyond looking broken, it distorts the map: Yahoo quotes the
// ISSUER's market cap against each class, so Alphabet was claiming roughly
// twice its true area and inflating Communication Services with it.
//
// Keep the class carrying the voting shares and the more familiar ticker; drop
// the rest. Anything added here must be a share class of a company that is
// already in the universe under another symbol, never a company in its own
// right.
const SECONDARY_SHARE_CLASSES = new Set([
  "GOOG", // Alphabet class C — GOOGL (class A) is kept
]);

/**
 * Refine a company's sector for the heatmap. Currently only splits Technology;
 * everything else passes through untouched.
 */
function refineSector(symbol: string, sector: string): string {
  if (sector !== "Technology") return sector;
  return ELECTRONIC_TECH.has(symbol.toUpperCase())
    ? "Electronic Technology"
    : "Technology Services";
}

const isSecondaryClass = (symbol: string): boolean =>
  SECONDARY_SHARE_CLASSES.has(symbol.toUpperCase());

export function regionLabel(key: string): string {
  return REGIONS.find((r) => r.key === key)?.label ?? "US";
}

/** Every { symbol, sector } pair a region's heatmap may draw. */
export function universeFor(key: string): { symbol: string; sector: string }[] {
  const mapped = FROM_SECTOR_MAP[key];
  if (mapped) {
    return Object.entries(SECTOR_MAP)
      .filter(([symbol, info]) => info.region === mapped && !isSecondaryClass(symbol))
      .map(([symbol, info]) => ({ symbol, sector: refineSector(symbol, info.sector) }));
  }
  const curated = CURATED[key];
  if (!curated) return [];
  return Object.entries(curated)
    .filter(([symbol]) => !isSecondaryClass(symbol))
    .map(([symbol, sector]) => ({
      symbol,
      sector: refineSector(symbol, sector),
    }));
}
