// Curated set of names most associated with the current AI build-out / "AI
// bubble" — the stocks whose prices are driven by AI expectations rather than
// present cash flows. For these, the more honest valuation lens is "share price
// vs future cash-flow value" (a DCF) rather than an analyst mean target, so the
// company page features the cash-flow comparison first. Tickers are stored
// bare (no exchange suffix) and matched case-insensitively against the base
// symbol, so both "NVDA" and a hypothetical "NVDA.NE" resolve.
const AI_BUBBLE = new Set<string>([
  // AI chips & semis
  "NVDA",
  "AMD",
  "AVGO",
  "MRVL",
  "MU",
  "TSM",
  "ASML",
  "SMCI",
  "ARM",
  "QCOM",
  "INTC",
  // AI software / platforms
  "PLTR",
  "MSFT",
  "GOOGL",
  "GOOG",
  "META",
  "AMZN",
  "ORCL",
  "NOW",
  "SNOW",
  "CRWD",
  "AI", // C3.ai
  "BBAI",
  "SOUN",
  "PATH",
  // AI infrastructure / power / networking
  "DELL",
  "ANET",
  "VRT",
  "COHR",
  "CRDO",
  "NBIS",
  "CRWV", // CoreWeave
  // Quantum / adjacent AI-hype names
  "IONQ",
  "RGTI",
  "QBTS",
  "TSLA",
]);

// Normalise to the base ticker (strip an exchange suffix like .NS / .BO / .NE).
function baseTicker(ticker: string): string {
  return ticker.trim().toUpperCase().split(".")[0];
}

export function isAiBubbleStock(ticker: string | undefined | null): boolean {
  if (!ticker) return false;
  return AI_BUBBLE.has(baseTicker(ticker));
}
