// Sector + listing-region lookup for common tickers, used by the portfolio risk
// lens so holdings bucket into real sectors/regions instead of everything
// collapsing into "Other". Not exhaustive — any ticker not found here falls back
// to a live company lookup in the UI, and only then to "Other".

export interface SectorInfo {
  sector: string;
  region: string;
}

function build(): Record<string, SectorInfo> {
  const m: Record<string, SectorInfo> = {};
  const us = (sector: string, syms: string[]) =>
    syms.forEach((s) => {
      m[s] = { sector, region: "United States" };
    });
  const india = (sector: string, syms: string[]) =>
    syms.forEach((s) => {
      m[s] = { sector, region: "India" };
    });

  us("Technology", [
    "AAPL", "MSFT", "NVDA", "AVGO", "ORCL", "CRM", "ADBE", "AMD", "INTC", "QCOM",
    "TXN", "CSCO", "IBM", "NOW", "INTU", "AMAT", "MU", "LRCX", "KLAC", "ADI",
    "SNPS", "CDNS", "PLTR", "SNOW", "DDOG", "NET", "CRWD", "ZS", "PANW", "FTNT",
    "OKTA", "MDB", "TWLO", "TEAM", "WDAY", "HPQ", "DELL", "HPE", "ANET", "SMCI",
    "ARM", "ASML", "MRVL", "ON", "DOCU", "ZM", "NXPI", "MCHP", "GLW", "STX", "WDC",
  ]);
  us("Communication Services", [
    "GOOGL", "GOOG", "META", "NFLX", "DIS", "T", "VZ", "TMUS", "CMCSA", "CHTR",
    "SPOT", "PINS", "SNAP", "RBLX", "TTD", "EA", "TTWO", "OMC", "WBD", "LYV",
    "MTCH", "PARA", "FOXA", "IPG", "NWSA",
  ]);
  us("Consumer Discretionary", [
    "AMZN", "TSLA", "HD", "NKE", "MCD", "SBUX", "LOW", "BKNG", "ABNB", "TJX",
    "ORLY", "CMG", "MAR", "GM", "F", "RIVN", "LCID", "DASH", "ROKU", "EBAY",
    "ETSY", "LULU", "YUM", "DPZ", "RCL", "CCL", "NCLH", "DKNG", "EXPE", "AZO",
    "ROST", "HLT", "GPC", "BBY", "DHI", "LEN", "BOBS",
  ]);
  us("Consumer Staples", [
    "WMT", "COST", "KO", "PEP", "PG", "PM", "MO", "MDLZ", "CL", "KMB", "GIS",
    "KHC", "STZ", "KDP", "MNST", "TGT", "SYY", "ADM", "HSY", "K", "KR", "CLX",
    "EL", "WBA",
  ]);
  us("Financials", [
    "JPM", "BAC", "WFC", "C", "GS", "MS", "BRK.B", "V", "MA", "AXP", "BLK",
    "SCHW", "SPGI", "CB", "PGR", "MMC", "PYPL", "COIN", "HOOD", "SOFI", "AFRM",
    "ICE", "CME", "USB", "PNC", "TFC", "BX", "KKR", "AIG", "MET", "PRU", "MCO",
    "AON", "TRV", "ALL", "COF", "DFS",
  ]);
  us("Health Care", [
    "JNJ", "UNH", "LLY", "PFE", "MRK", "ABBV", "TMO", "ABT", "DHR", "BMY",
    "AMGN", "MDT", "GILD", "CVS", "CI", "ELV", "ISRG", "VRTX", "REGN", "ZTS",
    "MRNA", "HUM", "BSX", "SYK", "BDX", "HCA", "IDXX", "DXCM", "IQV", "GEHC",
  ]);
  us("Industrials", [
    "BA", "GE", "CAT", "HON", "UPS", "RTX", "UNP", "DE", "LMT", "GD", "NOC",
    "MMM", "EMR", "ETN", "ITW", "CSX", "NSC", "FDX", "WM", "GEV", "PH", "TDG",
    "CARR", "OTIS", "PCAR", "RSG", "JCI", "CMI", "ROP", "FAST", "ODFL",
  ]);
  us("Energy", [
    "XOM", "CVX", "COP", "SLB", "EOG", "MPC", "PSX", "VLO", "OXY", "WMB", "KMI",
    "HAL", "DVN", "HES", "BKR", "FANG", "EXE", "TRGP", "OKE", "CTRA", "MRO",
  ]);
  us("Materials", [
    "LIN", "SHW", "APD", "ECL", "FCX", "NEM", "NUE", "DOW", "DD", "CTVA", "VMC",
    "MLM", "PPG", "ALB", "IFF", "STLD",
  ]);
  us("Real Estate", [
    "PLD", "AMT", "EQIX", "CCI", "PSA", "O", "SPG", "DLR", "WELL", "VICI",
    "SBAC", "AVB", "EQR", "EXR", "INVH",
  ]);
  us("Utilities", [
    "NEE", "DUK", "SO", "D", "AEP", "EXC", "SRE", "XEL", "PEG", "ED", "ETR",
    "WEC", "AEE", "PCG", "CEG",
  ]);

  india("Technology", ["TCS.NS", "INFY.NS", "HCLTECH.NS", "WIPRO.NS", "TECHM.NS", "LTIM.NS", "PERSISTENT.NS"]);
  india("Financials", ["HDFCBANK.NS", "ICICIBANK.NS", "SBIN.NS", "KOTAKBANK.NS", "AXISBANK.NS", "BAJFINANCE.NS", "BAJAJFINSV.NS", "HDFCLIFE.NS", "SBILIFE.NS", "INDUSINDBK.NS"]);
  india("Consumer Staples", ["HINDUNILVR.NS", "ITC.NS", "NESTLEIND.NS", "BRITANNIA.NS", "DABUR.NS", "TATACONSUM.NS"]);
  india("Consumer Discretionary", ["MARUTI.NS", "TATAMOTORS.NS", "TITAN.NS", "M&M.NS", "BAJAJ-AUTO.NS", "EICHERMOT.NS", "TRENT.NS"]);
  india("Communication Services", ["BHARTIARTL.NS", "ZOMATO.NS"]);
  india("Energy", ["RELIANCE.NS", "ONGC.NS", "COALINDIA.NS", "IOC.NS", "BPCL.NS"]);
  india("Industrials", ["LT.NS", "ADANIENT.NS", "ADANIPORTS.NS", "SIEMENS.NS"]);
  india("Materials", ["ASIANPAINT.NS", "ULTRACEMCO.NS", "TATASTEEL.NS", "JSWSTEEL.NS", "GRASIM.NS", "HINDALCO.NS", "SHREECEM.NS"]);
  india("Health Care", ["SUNPHARMA.NS", "DRREDDY.NS", "CIPLA.NS", "DIVISLAB.NS", "APOLLOHOSP.NS"]);
  india("Utilities", ["POWERGRID.NS", "NTPC.NS", "TATAPOWER.NS"]);

  return m;
}

export const SECTOR_MAP: Record<string, SectorInfo> = build();

const SUFFIX_REGION: { re: RegExp; region: string }[] = [
  { re: /\.(NS|BO)$/i, region: "India" },
  { re: /\.L$/i, region: "United Kingdom" },
  { re: /\.TO$/i, region: "Canada" },
  { re: /\.HK$/i, region: "Hong Kong" },
  { re: /\.AX$/i, region: "Australia" },
  { re: /\.(DE|F)$/i, region: "Germany" },
  { re: /\.PA$/i, region: "France" },
  { re: /\.T$/i, region: "Japan" },
  { re: /\.(SS|SZ)$/i, region: "China" },
];

export function regionForTicker(ticker: string): string {
  const t = ticker.toUpperCase();
  const hit = SECTOR_MAP[t];
  if (hit?.region) return hit.region;
  for (const s of SUFFIX_REGION) if (s.re.test(t)) return s.region;
  return "United States";
}

export function sectorForTicker(ticker: string): string | null {
  return SECTOR_MAP[ticker.toUpperCase()]?.sector ?? null;
}
