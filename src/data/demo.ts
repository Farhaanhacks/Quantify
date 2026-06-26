// ─────────────────────────────────────────────────────────────────────────────
// Quantifi — demo data
// All data here is static, illustrative, and for educational/demo purposes only.
// Nothing in this file is financial advice or a recommendation to buy/sell/hold.
// ─────────────────────────────────────────────────────────────────────────────

export type MarketRegion = "Global" | "India" | "US";
export type Direction = "up" | "down" | "flat";

export interface Stock {
  ticker: string;
  name: string;
  region: MarketRegion;
  exchange: string;
  sector: string;
  price: number;
  changePct: number; // day change %
  marketCap: string;
  spark: number[]; // small illustrative series
}

export interface Holding {
  ticker: string;
  name: string;
  sector: string;
  geo: string;
  shares: number;
  avgCost: number;
  price: number;
}

// The thematic research library now lives in ./ideas (richer model). Re-export
// so existing `@/data/demo` imports keep working.
export type { TradingIdea } from "./ideas";
export { ideaCategories, tradingIdeas } from "./ideas";

export interface AffectedStock {
  ticker: string;
  note: string;
  dir: Direction;
}

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  time: string;
  region: MarketRegion;
  sentiment: "positive" | "negative" | "mixed";
  summary: string;
  direct: AffectedStock[];
  peers: AffectedStock[];
  sector: { name: string; note: string };
  etfs: AffectedStock[];
  whyAffected: string;
  whatToWatch: string[];
}

export type InsiderType =
  | "Insider Buying"
  | "Insider Selling"
  | "Promoter Stake Change"
  | "Pledge Created"
  | "Pledge Released"
  | "Large Transaction"
  | "Repeated Selling"
  | "Unusual Activity";

export interface InsiderEvent {
  id: string;
  ticker: string;
  company: string;
  person: string;
  role: string;
  type: InsiderType;
  value: string;
  shares: string;
  date: string;
  note: string;
}

export interface FamousTake {
  id: string;
  author: string;
  role: string;
  lens: string;
  thesis: string;
  affectedStocks: string[];
  affectedEtfs: string[];
  risk: string;
  monitor: string[];
  stance: "Cautious" | "Contrarian" | "Skeptical";
}

// ── Universe of demo tickers ────────────────────────────────────────────────

export const stocks: Stock[] = [
  { ticker: "NVDA", name: "NVIDIA Corp.", region: "US", exchange: "NASDAQ", sector: "Semiconductors", price: 174.32, changePct: 2.41, marketCap: "$4.2T", spark: [120, 128, 124, 139, 146, 158, 151, 166, 174] },
  { ticker: "MSFT", name: "Microsoft Corp.", region: "US", exchange: "NASDAQ", sector: "Software", price: 472.18, changePct: 0.86, marketCap: "$3.5T", spark: [430, 441, 438, 449, 455, 451, 463, 468, 472] },
  { ticker: "AMZN", name: "Amazon.com Inc.", region: "US", exchange: "NASDAQ", sector: "E-commerce", price: 231.55, changePct: -0.62, marketCap: "$2.4T", spark: [240, 236, 238, 233, 229, 234, 230, 232, 231] },
  { ticker: "GOOGL", name: "Alphabet Inc.", region: "US", exchange: "NASDAQ", sector: "Internet", price: 198.7, changePct: 1.12, marketCap: "$2.4T", spark: [178, 182, 180, 186, 189, 191, 194, 196, 198] },
  { ticker: "META", name: "Meta Platforms", region: "US", exchange: "NASDAQ", sector: "Internet", price: 712.04, changePct: 1.74, marketCap: "$1.8T", spark: [640, 655, 648, 668, 679, 686, 695, 704, 712] },
  { ticker: "AMD", name: "Advanced Micro Devices", region: "US", exchange: "NASDAQ", sector: "Semiconductors", price: 168.9, changePct: 3.08, marketCap: "$273B", spark: [132, 138, 134, 145, 151, 149, 158, 163, 168] },
  { ticker: "PLTR", name: "Palantir Technologies", region: "US", exchange: "NASDAQ", sector: "Software", price: 84.26, changePct: 4.52, marketCap: "$190B", spark: [58, 62, 60, 66, 71, 69, 76, 80, 84] },
  { ticker: "ORCL", name: "Oracle Corp.", region: "US", exchange: "NYSE", sector: "Software", price: 201.33, changePct: 0.41, marketCap: "$560B", spark: [186, 190, 188, 193, 197, 195, 199, 200, 201] },
  { ticker: "TSLA", name: "Tesla Inc.", region: "US", exchange: "NASDAQ", sector: "Autos", price: 348.7, changePct: -1.85, marketCap: "$1.1T", spark: [372, 366, 369, 360, 355, 359, 352, 350, 348] },
  { ticker: "RKLB", name: "Rocket Lab", region: "US", exchange: "NASDAQ", sector: "Aerospace", price: 31.42, changePct: 5.13, marketCap: "$15B", spark: [22, 24, 23, 26, 28, 27, 29, 30, 31] },
  { ticker: "ASTS", name: "AST SpaceMobile", region: "US", exchange: "NASDAQ", sector: "Aerospace", price: 39.18, changePct: 6.27, marketCap: "$12B", spark: [26, 29, 28, 31, 34, 33, 36, 38, 39] },
  { ticker: "SMH", name: "VanEck Semiconductor ETF", region: "US", exchange: "NASDAQ", sector: "ETF", price: 298.4, changePct: 1.96, marketCap: "—", spark: [262, 270, 266, 278, 284, 281, 290, 295, 298] },
  { ticker: "SOXX", name: "iShares Semiconductor ETF", region: "US", exchange: "NASDAQ", sector: "ETF", price: 256.12, changePct: 1.81, marketCap: "—", spark: [226, 232, 229, 239, 244, 241, 250, 254, 256] },
  { ticker: "QQQ", name: "Invesco QQQ Trust", region: "US", exchange: "NASDAQ", sector: "ETF", price: 542.9, changePct: 0.74, marketCap: "—", spark: [512, 520, 517, 526, 531, 529, 537, 540, 542] },
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", region: "US", exchange: "NYSE", sector: "ETF", price: 588.31, changePct: 0.52, marketCap: "—", spark: [562, 568, 566, 573, 578, 576, 583, 586, 588] },
  { ticker: "TCS.NS", name: "Tata Consultancy Services", region: "India", exchange: "NSE", sector: "IT Services", price: 4128.5, changePct: 0.94, marketCap: "₹14.9T", spark: [3920, 3970, 3950, 4010, 4060, 4040, 4090, 4110, 4128] },
  { ticker: "RELIANCE.NS", name: "Reliance Industries", region: "India", exchange: "NSE", sector: "Conglomerate", price: 1492.2, changePct: -0.73, marketCap: "₹20.2T", spark: [1540, 1528, 1532, 1515, 1502, 1510, 1498, 1494, 1492] },
  { ticker: "INFY.NS", name: "Infosys Ltd.", region: "India", exchange: "NSE", sector: "IT Services", price: 1864.7, changePct: 1.38, marketCap: "₹7.7T", spark: [1760, 1788, 1772, 1810, 1834, 1822, 1848, 1858, 1864] },
];

export const stockByTicker: Record<string, Stock> = stocks.reduce(
  (acc, s) => {
    acc[s.ticker] = s;
    return acc;
  },
  {} as Record<string, Stock>,
);

// ── Market pulse (ticker row) ────────────────────────────────────────────────

export interface PulseItem {
  label: string;
  value: string;
  changePct: number;
}

export const marketPulse: PulseItem[] = [
  { label: "S&P 500", value: "6,148", changePct: 0.52 },
  { label: "NASDAQ", value: "20,114", changePct: 0.74 },
  { label: "DOW", value: "44,920", changePct: 0.18 },
  { label: "NIFTY 50", value: "26,418", changePct: 0.31 },
  { label: "SENSEX", value: "86,204", changePct: 0.27 },
  { label: "FTSE 100", value: "8,762", changePct: -0.14 },
  { label: "NIKKEI", value: "41,330", changePct: 0.88 },
  { label: "VIX", value: "13.2", changePct: -2.40 },
  { label: "BTC", value: "$104,820", changePct: 1.62 },
  { label: "GOLD", value: "$2,684", changePct: 0.44 },
  { label: "BRENT", value: "$71.40", changePct: -0.92 },
  { label: "10Y UST", value: "4.18%", changePct: -0.6 },
];

export const topMovers: { ticker: string; changePct: number }[] = [
  { ticker: "ASTS", changePct: 6.27 },
  { ticker: "RKLB", changePct: 5.13 },
  { ticker: "PLTR", changePct: 4.52 },
  { ticker: "AMD", changePct: 3.08 },
  { ticker: "NVDA", changePct: 2.41 },
  { ticker: "TSLA", changePct: -1.85 },
  { ticker: "RELIANCE.NS", changePct: -0.73 },
];

// ── Portfolio ────────────────────────────────────────────────────────────────

export const holdings: Holding[] = [
  { ticker: "NVDA", name: "NVIDIA Corp.", sector: "Semiconductors", geo: "US", shares: 120, avgCost: 96.4, price: 174.32 },
  { ticker: "MSFT", name: "Microsoft Corp.", sector: "Software", geo: "US", shares: 30, avgCost: 388.2, price: 472.18 },
  { ticker: "PLTR", name: "Palantir Technologies", sector: "Software", geo: "US", shares: 240, avgCost: 41.7, price: 84.26 },
  { ticker: "TCS.NS", name: "Tata Consultancy Services", sector: "IT Services", geo: "India", shares: 90, avgCost: 3640.0, price: 4128.5 },
  { ticker: "RELIANCE.NS", name: "Reliance Industries", sector: "Conglomerate", geo: "India", shares: 180, avgCost: 1380.0, price: 1492.2 },
  { ticker: "RKLB", name: "Rocket Lab", sector: "Aerospace", geo: "US", shares: 300, avgCost: 19.8, price: 31.42 },
  { ticker: "QQQ", name: "Invesco QQQ Trust", sector: "ETF", geo: "US", shares: 40, avgCost: 488.0, price: 542.9 },
].map((h) => ({ ...h })) as Holding[];

// Holdings carry mixed currencies in real life; for the demo we treat values in a
// single notional unit so weights/diversification math stays simple and illustrative.
export const holdingValue = (h: Holding) => h.shares * h.price;

export const portfolioTotal = holdings.reduce((sum, h) => sum + holdingValue(h), 0);

export const portfolioMeta = {
  dayChangePct: 1.12,
  unrealizedPct: 38.6,
  positions: holdings.length,
  beta: 1.28,
  topWeightPct: Math.round((Math.max(...holdings.map(holdingValue)) / portfolioTotal) * 100),
};

export const sectorDiversification = [
  { name: "Semiconductors", pct: 41, color: "#E9B872" },
  { name: "Software", pct: 26, color: "#4FD1C5" },
  { name: "IT Services", pct: 14, color: "#818CF8" },
  { name: "Conglomerate", pct: 11, color: "#F472B6" },
  { name: "Aerospace", pct: 5, color: "#34D399" },
  { name: "ETF", pct: 3, color: "#94A3B8" },
];

export const geoRevenueSplit = [
  { name: "United States", pct: 58, color: "#E9B872" },
  { name: "Asia-Pacific", pct: 22, color: "#4FD1C5" },
  { name: "Europe", pct: 12, color: "#818CF8" },
  { name: "Rest of World", pct: 8, color: "#94A3B8" },
];

export const concentrationNotes = [
  { label: "Single-name concentration", detail: "NVDA is the largest weight — a single semiconductor name drives a meaningful share of moves.", level: "Elevated" as const },
  { label: "Sector concentration", detail: "Semis + Software together dominate the book. Tech-correlated names tend to move together.", level: "High" as const },
  { label: "Geographic mix", detail: "US-listed exposure leads, with a secondary India sleeve via TCS and Reliance.", level: "Moderate" as const },
];

export const stocksToReview = [
  { ticker: "NVDA", reason: "Largest weight + high beta — worth keeping on your risk lens after the recent run." },
  { ticker: "TSLA", reason: "Not held, but on your watchlist and showing the weakest tape in the group today." },
  { ticker: "PLTR", reason: "Strong momentum and an insider-selling cluster flagged this week." },
];

// ── Trading / investing ideas ────────────────────────────────────────────────


// ── News impact ──────────────────────────────────────────────────────────────

export const news: NewsItem[] = [
  {
    id: "n1",
    headline: "Hyperscaler raises FY data-center capex guidance",
    source: "Market Wire",
    time: "2h ago",
    region: "US",
    sentiment: "positive",
    summary:
      "A major cloud provider lifted its full-year capital spending outlook, citing accelerating demand for AI training and inference capacity.",
    direct: [
      { ticker: "NVDA", note: "Primary beneficiary of incremental accelerator demand", dir: "up" },
      { ticker: "AMD", note: "Secondary accelerator supplier in the same buildout", dir: "up" },
    ],
    peers: [
      { ticker: "ORCL", note: "Cloud capacity peer with similar capex posture", dir: "up" },
      { ticker: "MSFT", note: "Read-through to broader hyperscaler spend", dir: "flat" },
    ],
    sector: { name: "Semiconductors", note: "Capex upgrades tend to lift the whole accelerator supply chain." },
    etfs: [
      { ticker: "SMH", note: "Concentrated semiconductor exposure", dir: "up" },
      { ticker: "SOXX", note: "Broad semi basket", dir: "up" },
    ],
    whyAffected:
      "Higher cloud capex flows directly into orders for AI accelerators, memory and networking, lifting suppliers and the ETFs that hold them.",
    whatToWatch: [
      "Whether other hyperscalers echo the higher capex on their calls",
      "Supplier lead-time and backlog commentary",
      "Any margin commentary that offsets the revenue tailwind",
    ],
  },
  {
    id: "n2",
    headline: "Regulator opens review of AI vendor-financing arrangements",
    source: "The Ledger",
    time: "5h ago",
    region: "Global",
    sentiment: "mixed",
    summary:
      "Officials signaled scrutiny of circular financing structures where suppliers fund customers who then buy the supplier's products.",
    direct: [
      { ticker: "NVDA", note: "Named in commentary on supplier-led financing", dir: "down" },
    ],
    peers: [
      { ticker: "AMD", note: "Read-through to other accelerator vendors", dir: "down" },
      { ticker: "ORCL", note: "Capacity-financing structures in focus", dir: "flat" },
    ],
    sector: { name: "Semiconductors", note: "Questions about demand durability can weigh on sentiment broadly." },
    etfs: [{ ticker: "SMH", note: "Sentiment read-through to the basket", dir: "down" }],
    whyAffected:
      "If demand is partly funded by the vendors themselves, investors may question how much is organic — a narrative risk more than an earnings one for now.",
    whatToWatch: [
      "Scope and timeline of any formal review",
      "Disclosure of financing arrangements in filings",
      "Whether order backlogs hold up independent of financing",
    ],
  },
  {
    id: "n3",
    headline: "India IT majors guide to improving deal pipeline",
    source: "Dalal Street Daily",
    time: "1d ago",
    region: "India",
    sentiment: "positive",
    summary:
      "Commentary from large Indian IT services firms pointed to a firmer discretionary-spend environment heading into the next fiscal year.",
    direct: [
      { ticker: "TCS.NS", note: "Bellwether for the services cycle", dir: "up" },
      { ticker: "INFY.NS", note: "Direct read-through on deal momentum", dir: "up" },
    ],
    peers: [{ ticker: "RELIANCE.NS", note: "Broad India large-cap sentiment", dir: "flat" }],
    sector: { name: "IT Services", note: "Pipeline commentary often re-rates the whole services group." },
    etfs: [],
    whyAffected:
      "Services revenue tracks client discretionary budgets; a firmer pipeline supports growth expectations across the group.",
    whatToWatch: [
      "Book-to-bill and large-deal TCV in upcoming results",
      "Commentary on pricing and utilization",
      "Currency moves that affect reported revenue",
    ],
  },
  {
    id: "n4",
    headline: "Launch provider wins multi-mission government contract",
    source: "Orbital Times",
    time: "1d ago",
    region: "US",
    sentiment: "positive",
    summary:
      "A small-launch company secured a multi-mission award, adding visibility to its near-term manifest.",
    direct: [{ ticker: "RKLB", note: "Direct recipient of the award", dir: "up" }],
    peers: [{ ticker: "ASTS", note: "Sentiment read-through across space names", dir: "up" }],
    sector: { name: "Aerospace", note: "Contract awards improve revenue visibility for the cohort." },
    etfs: [],
    whyAffected:
      "Backlog and manifest visibility are key for pre-profit space names; a multi-mission award reduces near-term demand uncertainty.",
    whatToWatch: [
      "Cadence of launches against the new manifest",
      "Any margin disclosure on government work",
      "Follow-on awards or options exercised",
    ],
  },
  {
    id: "n5",
    headline: "EV demand commentary turns cautious into year-end",
    source: "Auto Brief",
    time: "2d ago",
    region: "US",
    sentiment: "negative",
    summary:
      "Several outlets flagged softer near-term electric-vehicle demand signals and pricing pressure.",
    direct: [{ ticker: "TSLA", note: "Most exposed to the demand narrative", dir: "down" }],
    peers: [{ ticker: "NVDA", note: "Minor read-through via autonomy compute", dir: "flat" }],
    sector: { name: "Autos", note: "Pricing pressure can compress margins across the group." },
    etfs: [{ ticker: "QQQ", note: "Large-cap index with notable single-name weight", dir: "flat" }],
    whyAffected:
      "Softer demand and discounting pressure unit economics; for index ETFs the effect is diluted by diversification.",
    whatToWatch: [
      "Delivery and inventory updates",
      "Pricing actions and their margin impact",
      "Any shift in the autonomy timeline",
    ],
  },
];

// ── Insider activity ─────────────────────────────────────────────────────────

export const insiderTypes: InsiderType[] = [
  "Insider Buying",
  "Insider Selling",
  "Promoter Stake Change",
  "Pledge Created",
  "Pledge Released",
  "Large Transaction",
  "Repeated Selling",
  "Unusual Activity",
];

export const insiderEvents: InsiderEvent[] = [
  { id: "i1", ticker: "PLTR", company: "Palantir Technologies", person: "S. Director", role: "Board Member", type: "Insider Selling", value: "$12.4M", shares: "150,000", date: "2d ago", note: "Sale under a pre-arranged trading plan." },
  { id: "i2", ticker: "PLTR", company: "Palantir Technologies", person: "Exec Officer", role: "C-Suite", type: "Repeated Selling", value: "$8.1M", shares: "98,000", date: "6d ago", note: "Third disposal logged this quarter." },
  { id: "i3", ticker: "NVDA", company: "NVIDIA Corp.", person: "Officer", role: "VP", type: "Large Transaction", value: "$22.0M", shares: "126,000", date: "3d ago", note: "Sizable transaction relative to recent filings." },
  { id: "i4", ticker: "AMD", company: "Advanced Micro Devices", person: "Insider", role: "Director", type: "Insider Buying", value: "$1.9M", shares: "11,200", date: "4d ago", note: "Open-market purchase." },
  { id: "i5", ticker: "RELIANCE.NS", company: "Reliance Industries", person: "Promoter Group", role: "Promoter", type: "Promoter Stake Change", value: "₹640Cr", shares: "—", date: "1w ago", note: "Reported change in promoter holding." },
  { id: "i6", ticker: "TCS.NS", company: "Tata Consultancy Services", person: "Promoter Group", role: "Promoter", type: "Pledge Released", value: "—", shares: "—", date: "1w ago", note: "Previously pledged shares released." },
  { id: "i7", ticker: "INFY.NS", company: "Infosys Ltd.", person: "Founder Family", role: "Promoter", type: "Pledge Created", value: "—", shares: "—", date: "2w ago", note: "New pledge reported against holdings." },
  { id: "i8", ticker: "RKLB", company: "Rocket Lab", person: "Insider", role: "Officer", type: "Unusual Activity", value: "$0.6M", shares: "19,000", date: "5d ago", note: "Pattern differs from prior filing history." },
  { id: "i9", ticker: "ORCL", company: "Oracle Corp.", person: "Director", role: "Board Member", type: "Insider Buying", value: "$3.4M", shares: "17,000", date: "1w ago", note: "Open-market purchase after results." },
];

// ── Famous takes ─────────────────────────────────────────────────────────────

export const famousTakes: FamousTake[] = [
  {
    id: "burry-ai-bubble",
    author: "Michael Burry",
    role: "Investor, The Big Short",
    lens: "AI Bubble Lens",
    stance: "Skeptical",
    thesis:
      "A widely-discussed skeptical view argues that AI-related valuations and demand may be running ahead of durable, organic fundamentals — echoing historical bubble dynamics. Presented here as a narrative to study, not as a prediction.",
    affectedStocks: ["NVDA", "AMD", "PLTR", "ORCL"],
    affectedEtfs: ["SMH", "SOXX", "QQQ"],
    risk:
      "If AI demand proves less durable than priced, high-multiple names could de-rate sharply and drag the ETFs that hold them.",
    monitor: [
      "Whether hyperscaler capex translates into sustained end-demand",
      "Inventory and order-backlog trends across the supply chain",
      "Multiple compression in the most richly-valued names",
      "Breadth — is strength concentrated in a few names?",
    ],
  },
  {
    id: "circular-ai-money",
    author: "Market Commentators",
    role: "Various analysts",
    lens: "Vendor Financing / Circular AI Money Loop",
    stance: "Cautious",
    thesis:
      "A growing commentary thread highlights 'circular' arrangements where a supplier invests in or finances a customer that then buys the supplier's products. The concern is that some reported demand may be self-funded rather than fully organic. Shared as an analytical lens to research independently.",
    affectedStocks: ["NVDA", "ORCL", "AMD"],
    affectedEtfs: ["SMH", "QQQ"],
    risk:
      "If a meaningful share of demand is vendor-financed, revenue quality and durability come into question, raising narrative and re-rating risk.",
    monitor: [
      "Disclosure of investments in, or financing of, customers",
      "Related-party and off-balance-sheet arrangements in filings",
      "Whether backlog holds without supplier financing",
      "Regulatory or auditor commentary on the structures",
    ],
  },
];

// ── Stock analysis (demo selected stock) ─────────────────────────────────────

export interface ValuationMetric {
  label: string;
  value: string;
  context: string;
}

export interface StockAnalysisData {
  ticker: string;
  name: string;
  exchange: string;
  sector: string;
  price: number;
  changePct: number;
  marketCap: string;
  overview: string;
  highlights: { label: string; value: string }[];
  valuation: ValuationMetric[];
  newsIds: string[];
  insiderIds: string[];
  risks: string[];
  whatToWatch: string[];
}

export const stockAnalysis: StockAnalysisData = {
  ticker: "NVDA",
  name: "NVIDIA Corp.",
  exchange: "NASDAQ",
  sector: "Semiconductors",
  price: 174.32,
  changePct: 2.41,
  marketCap: "$4.2T",
  overview:
    "NVIDIA designs accelerated-computing hardware and software central to the current AI buildout — a useful example of how a single name connects to news, insiders, peers and risk lenses across Quantifi.",
  highlights: [
    { label: "Day change", value: "+2.41%" },
    { label: "30-day trend", value: "Higher" },
    { label: "Sector", value: "Semiconductors" },
    { label: "In your portfolio", value: "Largest weight" },
  ],
  valuation: [
    { label: "P/E (demo)", value: "48.2x", context: "Above the 5-yr average on demo data" },
    { label: "Fwd P/E (demo)", value: "33.6x", context: "Reflects high expected growth" },
    { label: "P/S (demo)", value: "26.1x", context: "Premium to the sector" },
    { label: "PEG (demo)", value: "1.4x", context: "Growth-adjusted, mid-range" },
    { label: "EV/EBITDA (demo)", value: "41.0x", context: "Elevated vs peers" },
    { label: "Div. yield (demo)", value: "0.03%", context: "Minimal — reinvests for growth" },
  ],
  newsIds: ["n1", "n2"],
  insiderIds: ["i3"],
  risks: [
    "Valuation is rich — sentiment shifts can drive outsized moves.",
    "Demand durability is debated (see the AI Bubble and vendor-financing lenses).",
    "Customer concentration among a handful of large buyers.",
    "Policy and export-control headlines can affect addressable demand.",
  ],
  whatToWatch: [
    "Hyperscaler capex guidance on upcoming calls",
    "Order backlog and supplier lead times",
    "Any disclosure on customer financing arrangements",
    "Gross-margin trajectory as the product mix shifts",
  ],
};

// ── Watchlist ────────────────────────────────────────────────────────────────

export const watchlist = {
  savedStocks: ["NVDA", "TSLA", "ASTS", "INFY.NS", "AMD"],
  savedThemes: [
    { id: "ai-infra", label: "AI Infrastructure Buildout" },
    { id: "space-economy", label: "Space Economy" },
    { id: "cyber", label: "Cybersecurity" },
  ],
  savedTakes: [
    { id: "burry-ai-bubble", label: "Michael Burry — AI Bubble Lens" },
    { id: "circular-ai-money", label: "Vendor Financing / Circular AI Money Loop" },
  ],
  alerts: [
    { id: "a1", ticker: "NVDA", text: "Flag if a new vendor-financing disclosure appears", type: "News lens" as const, active: true },
    { id: "a2", ticker: "TSLA", text: "Watch for delivery/inventory updates", type: "Event" as const, active: true },
    { id: "a3", ticker: "ASTS", text: "Watch for direct-to-device connectivity milestones", type: "Event" as const, active: false },
    { id: "a4", ticker: "PLTR", text: "Notify on further insider-selling filings", type: "Insider" as const, active: true },
  ],
};

// ── Quantifi Score + Fair Value (Simply Wall St-inspired, original model) ────
// Five fundamental axes, each scored 0–6 from a checklist. Educational only.

export type ScoreAxisKey = "value" | "growth" | "past" | "health" | "dividends";

export const SCORE_AXES: {
  key: ScoreAxisKey;
  label: string;
  short: string; // radar / compact label
  question: string; // the main thesis question for this axis
}[] = [
  { key: "value", label: "Valuation Comfort", short: "Valuation", question: "Can earnings grow fast enough to justify the multiple?" },
  { key: "growth", label: "Growth Durability", short: "Growth", question: "Is the growth durable, or is it already slowing?" },
  { key: "past", label: "Profitability Quality", short: "Quality", question: "Does the business earn high-quality, durable profits?" },
  { key: "health", label: "Balance Sheet Strength", short: "Balance", question: "Could the balance sheet absorb a downturn?" },
  { key: "dividends", label: "Capital Allocation", short: "Capital", question: "Is capital returned to shareholders, and is it sustainable?" },
];

// A qualitative read for an axis score (0–6) — so the scorecard reads like
// analysis ("Demanding", "Durable") rather than a binary tick.
export function axisLabel(key: ScoreAxisKey, score: number): string {
  const band = score >= 5 ? 3 : score >= 3 ? 2 : score >= 1 ? 1 : 0;
  const M: Record<ScoreAxisKey, [string, string, string, string]> = {
    value: ["Priced for perfection", "Demanding", "Fair", "Attractive"],
    growth: ["Unproven", "Soft", "Slowing", "Durable"],
    past: ["Unprofitable", "Weak", "Mixed", "Strong"],
    health: ["Fragile", "Stretched", "Manageable", "Strong"],
    dividends: ["No payout", "Light", "Mixed", "Shareholder-friendly"],
  };
  return M[key][band];
}

export interface ScoreCheck {
  label: string;
  pass: boolean;
}

export interface ScoreAxis {
  score: number; // 0–6
  checks: ScoreCheck[];
}

export interface CompanyAnalytics {
  ticker: string;
  scores: Record<ScoreAxisKey, ScoreAxis>;
  fairValue: { estimate: number; method: string; note: string };
  // Optional 2-stage discounted-cash-flow intrinsic value per share.
  cashflowValue?: { estimate: number; note: string };
  rewards: string[];
  riskFlags: string[];
}

const ax = (score: number, checks: ScoreCheck[]): ScoreAxis => ({ score, checks });
const c = (label: string, pass: boolean): ScoreCheck => ({ label, pass });

export const companyAnalytics: Record<string, CompanyAnalytics> = {
  NVDA: {
    ticker: "NVDA",
    scores: {
      value: ax(2, [
        c("Trading below estimated fair value", false),
        c("Price-to-earnings below sector", false),
        c("PEG suggests growth is partly priced in", true),
      ]),
      growth: ax(6, [
        c("Earnings forecast to grow strongly", true),
        c("Revenue growth above market", true),
        c("Return on equity forecast high", true),
      ]),
      past: ax(6, [
        c("Earnings grew over the past year", true),
        c("Earnings grew over the past 5 years", true),
        c("Margins expanding", true),
      ]),
      health: ax(5, [
        c("Short-term assets cover liabilities", true),
        c("Debt well covered by cash flow", true),
        c("More cash than total debt", true),
      ]),
      dividends: ax(1, [
        c("Pays a dividend", true),
        c("Yield above market", false),
        c("Dividend covered by earnings", true),
      ]),
    },
    fairValue: { estimate: 158.0, method: "DCF (demo)", note: "Estimate vs current price — research input, not a target." },
    rewards: [
      "Earnings are forecast to grow faster than the market (demo).",
      "Strong balance sheet with more cash than debt (demo).",
      "Leadership position in accelerated computing.",
    ],
    riskFlags: [
      "Trades above the demo fair-value estimate.",
      "High customer concentration among a few large buyers.",
      "Sentiment-driven — outsized moves on narrative shifts.",
    ],
  },
  MSFT: {
    ticker: "MSFT",
    scores: {
      value: ax(2, [c("Below fair value", false), c("P/E vs sector", false), c("Reasonable PEG", true)]),
      growth: ax(4, [c("Earnings forecast to grow", true), c("Revenue above market", true), c("ROE high", false)]),
      past: ax(5, [c("5-yr earnings growth", true), c("Stable margins", true), c("Quality earnings", true)]),
      health: ax(6, [c("Assets cover liabilities", true), c("Debt covered by cash flow", true), c("Strong interest cover", true)]),
      dividends: ax(4, [c("Pays a dividend", true), c("Growing dividend", true), c("Well covered", true)]),
    },
    fairValue: { estimate: 455.0, method: "DCF (demo)", note: "Near demo fair value." },
    rewards: ["Diversified cloud + software earnings (demo).", "Consistent dividend growth (demo)."],
    riskFlags: ["Premium valuation leaves little margin of safety (demo)."],
  },
  GOOGL: {
    ticker: "GOOGL",
    scores: {
      value: ax(4, [c("Below fair value", true), c("P/E below sector", true), c("Reasonable PEG", true)]),
      growth: ax(3, [c("Earnings forecast to grow", true), c("Revenue above market", false), c("ROE high", true)]),
      past: ax(5, [c("5-yr earnings growth", true), c("Margins stable", true), c("Quality earnings", true)]),
      health: ax(6, [c("Assets cover liabilities", true), c("Low debt", true), c("More cash than debt", true)]),
      dividends: ax(1, [c("Pays a dividend", true), c("Yield above market", false), c("Covered", true)]),
    },
    fairValue: { estimate: 224.0, method: "DCF (demo)", note: "Below demo fair value." },
    rewards: ["Screens cheaper than peers on demo data.", "Very strong balance sheet (demo)."],
    riskFlags: ["Regulatory and ad-market cyclicality (demo)."],
  },
  AMD: {
    ticker: "AMD",
    scores: {
      value: ax(2, [c("Below fair value", false), c("P/E vs sector", false), c("PEG", true)]),
      growth: ax(6, [c("Strong earnings growth forecast", true), c("Revenue above market", true), c("ROE improving", true)]),
      past: ax(3, [c("Earnings grew", true), c("Margins improving", true), c("5-yr volatile", false)]),
      health: ax(5, [c("Assets cover liabilities", true), c("Low debt", true), c("Cash position", true)]),
      dividends: ax(0, [c("Pays a dividend", false), c("Yield", false), c("Covered", false)]),
    },
    fairValue: { estimate: 150.0, method: "DCF (demo)", note: "Above demo fair value." },
    rewards: ["High forecast growth in AI/data-center (demo)."],
    riskFlags: ["No dividend.", "Trades above demo fair value.", "Competitive intensity in GPUs (demo)."],
  },
  TSLA: {
    ticker: "TSLA",
    scores: {
      value: ax(1, [c("Below fair value", false), c("P/E vs sector", false), c("PEG", false)]),
      growth: ax(4, [c("Earnings forecast to grow", true), c("Revenue above market", true), c("ROE", false)]),
      past: ax(3, [c("Earnings grew", true), c("Margins compressing", false), c("Volatile", false)]),
      health: ax(5, [c("Assets cover liabilities", true), c("Low debt", true), c("Cash strong", true)]),
      dividends: ax(0, [c("Pays a dividend", false), c("Yield", false), c("Covered", false)]),
    },
    fairValue: { estimate: 300.0, method: "DCF (demo)", note: "Well above demo fair value." },
    rewards: ["Strong cash position (demo).", "Optionality across energy + autonomy (demo)."],
    riskFlags: ["Rich valuation vs demo fair value.", "Margin pressure from pricing (demo).", "No dividend."],
  },
  PLTR: {
    ticker: "PLTR",
    scores: {
      value: ax(1, [c("Below fair value", false), c("P/E vs sector", false), c("PEG", false)]),
      growth: ax(6, [c("Strong earnings growth forecast", true), c("Revenue above market", true), c("ROE high", true)]),
      past: ax(4, [c("Earnings grew", true), c("Turned profitable", true), c("Margins improving", true)]),
      health: ax(6, [c("Assets cover liabilities", true), c("No meaningful debt", true), c("Cash rich", true)]),
      dividends: ax(0, [c("Pays a dividend", false), c("Yield", false), c("Covered", false)]),
    },
    fairValue: { estimate: 60.0, method: "DCF (demo)", note: "Well above demo fair value." },
    rewards: ["Accelerating commercial growth (demo).", "Debt-free balance sheet (demo)."],
    riskFlags: ["Valuation stretched vs demo fair value.", "Insider-selling cluster flagged (demo)."],
  },
  ORCL: {
    ticker: "ORCL",
    scores: {
      value: ax(3, [c("Below fair value", true), c("P/E vs sector", false), c("PEG", true)]),
      growth: ax(4, [c("Earnings forecast to grow", true), c("Cloud backlog rising", true), c("ROE", false)]),
      past: ax(4, [c("Earnings grew", true), c("Margins stable", true), c("Consistent", true)]),
      health: ax(2, [c("Assets cover liabilities", false), c("High debt load", false), c("Cash flow covers debt", true)]),
      dividends: ax(4, [c("Pays a dividend", true), c("Growing", true), c("Covered", true)]),
    },
    fairValue: { estimate: 205.0, method: "DCF (demo)", note: "Near demo fair value." },
    rewards: ["Large cloud backlog (demo).", "Reliable dividend (demo)."],
    riskFlags: ["Elevated debt load (demo)."],
  },
  "INFY.NS": {
    ticker: "INFY.NS",
    scores: {
      value: ax(4, [c("Below fair value", true), c("P/E below sector", true), c("PEG reasonable", true)]),
      growth: ax(3, [c("Earnings forecast to grow", true), c("Revenue modest", false), c("ROE high", true)]),
      past: ax(5, [c("5-yr earnings growth", true), c("Stable margins", true), c("Quality earnings", true)]),
      health: ax(6, [c("Assets cover liabilities", true), c("Debt-free", true), c("Cash rich", true)]),
      dividends: ax(5, [c("Pays a dividend", true), c("Above market yield", true), c("Well covered", true)]),
    },
    fairValue: { estimate: 1980.0, method: "DCF (demo)", note: "Below demo fair value." },
    rewards: ["Debt-free with healthy dividend (demo).", "Screens below demo fair value."],
    riskFlags: ["Discretionary IT-spend slowdown risk (demo)."],
  },
  "TCS.NS": {
    ticker: "TCS.NS",
    scores: {
      value: ax(3, [c("Below fair value", true), c("P/E vs sector", false), c("PEG", true)]),
      growth: ax(3, [c("Earnings forecast to grow", true), c("Revenue modest", false), c("ROE very high", true)]),
      past: ax(6, [c("5-yr earnings growth", true), c("Margins strong", true), c("Quality earnings", true)]),
      health: ax(6, [c("Assets cover liabilities", true), c("Debt-free", true), c("Cash rich", true)]),
      dividends: ax(5, [c("Pays a dividend", true), c("Above market yield", true), c("Well covered", true)]),
    },
    fairValue: { estimate: 4250.0, method: "DCF (demo)", note: "Near/below demo fair value." },
    rewards: ["Very high return on equity (demo).", "Strong, well-covered dividend (demo)."],
    riskFlags: ["Discretionary IT-spend slowdown risk (demo)."],
  },
};

export const overallScore = (a: CompanyAnalytics): number =>
  SCORE_AXES.reduce((sum, axis) => sum + a.scores[axis.key].score, 0); // 0–30

export const valuationGapPct = (ticker: string): number | null => {
  const a = companyAnalytics[ticker];
  const s = stockByTicker[ticker];
  if (!a || !s) return null;
  return ((a.fairValue.estimate - s.price) / s.price) * 100;
};

// ── Formatting helpers ───────────────────────────────────────────────────────

export const fmtPrice = (n: number) =>
  n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

export const fmtCompact = (n: number) => {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
};

export const dirOf = (n: number): Direction => (n > 0 ? "up" : n < 0 ? "down" : "flat");
