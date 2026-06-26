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

// The thematic research library now lives in ./ideas (richer model). Re-export
// so existing `@/data/demo` imports keep working.
export type { TradingIdea } from "./ideas";
export { ideaCategories, tradingIdeas } from "./ideas";

export type ImpactLevel = "Low" | "Medium" | "High";

export interface AffectedStock {
  ticker: string;
  note: string; // why this name is affected
  dir: Direction;
  role?: string; // what this name represents in the chain (e.g. "AI cloud infrastructure")
  watch?: string; // the specific metric to watch on this name
  impact?: ImpactLevel; // strength of the read-through to this name
}

export interface LinkedTheme {
  id: string; // matches a Quantifi Idea/theme id (deep-links to /ideas?theme=id)
  label: string;
}

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  time: string;
  region: MarketRegion;
  sentiment: "positive" | "negative" | "mixed";
  summary: string;
  // ── Analytical layer (the "impact map") ──
  whatChanged: string; // one or two sentences: what actually changed
  impact: ImpactLevel; // overall market impact of the item
  confidence: number; // 0–100: how confident the read-through is
  impactMap: string[]; // ordered causal chain, rendered vertically
  signalType: string; // e.g. "Sentiment / Narrative", "Fundamental", "Event-driven"
  thesisRelevance: ImpactLevel; // does this move a thesis, or is it noise?
  timeHorizon: string; // e.g. "Short-term, unless confirmed by filings"
  linkedThemes: LinkedTheme[]; // related Quantifi research themes
  // ── Read-through detail ──
  direct: AffectedStock[];
  peers: AffectedStock[];
  sector: { name: string; note: string };
  etfs: AffectedStock[];
  whyAffected: string;
  whatToWatch: string[];
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
    whatChanged:
      "A top hyperscaler raised its full-year capex guide — a hard budget number, not a forecast — signalling more spend on AI compute over the next several quarters.",
    impact: "High",
    confidence: 78,
    impactMap: [
      "Hyperscaler lifts FY data-centre capex guide",
      "More dollars committed to AI compute & networking",
      "Order pipeline strengthens for accelerator suppliers",
      "NVDA / AMD and the semi ETFs re-rate on demand visibility",
    ],
    signalType: "Fundamental",
    thesisRelevance: "High",
    timeHorizon: "Multi-quarter — a guided budget tends to convert into orders",
    linkedThemes: [
      { id: "ai-power-bottleneck", label: "AI Power Bottleneck" },
      { id: "sovereign-ai-stacks", label: "Sovereign AI Stacks" },
      { id: "global-industrial-rebuild", label: "Global Industrial Rebuild" },
    ],
    direct: [
      { ticker: "NVDA", note: "Primary beneficiary of incremental accelerator demand", dir: "up", role: "AI accelerator supplier", watch: "Data-centre revenue, backlog, lead times", impact: "High" },
      { ticker: "AMD", note: "Secondary accelerator supplier in the same buildout", dir: "up", role: "Challenger accelerator supplier", watch: "MI-series ramp, hyperscaler design wins", impact: "Medium" },
    ],
    peers: [
      { ticker: "ORCL", note: "Cloud capacity peer with similar capex posture", dir: "up", role: "AI cloud capacity peer", watch: "RPO / backlog, capex guide", impact: "Medium" },
      { ticker: "MSFT", note: "Read-through to broader hyperscaler spend", dir: "flat", role: "Hyperscaler peer", watch: "Own capex commentary next call", impact: "Low" },
    ],
    sector: { name: "Semiconductors", note: "Capex upgrades tend to lift the whole accelerator supply chain." },
    etfs: [
      { ticker: "SMH", note: "Concentrated semiconductor exposure", dir: "up" },
      { ticker: "SOXX", note: "Broad semi basket", dir: "up" },
    ],
    whyAffected:
      "Higher cloud capex flows directly into orders for AI accelerators, memory and networking, lifting suppliers and the ETFs that hold them. Because it is a guided budget rather than a single quarter's result, the read-through is more durable than a typical headline.",
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
    whatChanged:
      "A regulator flagged scrutiny of circular AI financing — where a chip supplier funds a customer that then buys its chips. Nothing in the numbers changed yet; what changed is the question being asked about demand quality.",
    impact: "Medium",
    confidence: 58,
    impactMap: [
      "Regulator signals review of vendor-financing structures",
      "Investors question how much AI demand is self-funded",
      "Demand-durability narrative around accelerators softens",
      "NVDA / AMD sentiment wobbles ahead of any hard finding",
    ],
    signalType: "Sentiment / Narrative",
    thesisRelevance: "Medium",
    timeHorizon: "Short-term, unless a formal finding or disclosure follows",
    linkedThemes: [
      { id: "great-company-dangerous-price", label: "Great Company, Dangerous Price" },
      { id: "ai-power-bottleneck", label: "AI Power Bottleneck" },
      { id: "market-toll-booths", label: "Market Toll Booths" },
    ],
    direct: [
      { ticker: "NVDA", note: "Named in commentary on supplier-led financing", dir: "down", role: "Accelerator supplier under scrutiny", watch: "Vendor-financing disclosure in filings", impact: "Medium" },
    ],
    peers: [
      { ticker: "AMD", note: "Read-through to other accelerator vendors", dir: "down", role: "Peer accelerator vendor", watch: "Customer-financing exposure", impact: "Low" },
      { ticker: "ORCL", note: "Capacity-financing structures in focus", dir: "flat", role: "Capacity buyer/financier", watch: "Disclosed financing terms", impact: "Low" },
    ],
    sector: { name: "Semiconductors", note: "Questions about demand durability can weigh on sentiment broadly." },
    etfs: [{ ticker: "SMH", note: "Sentiment read-through to the basket", dir: "down" }],
    whyAffected:
      "If demand is partly funded by the vendors themselves, investors may question how much is organic — a narrative risk more than an earnings one for now. Treat it as a sentiment signal until a filing or formal finding makes it fundamental.",
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
    whatChanged:
      "Management commentary — not yet booked revenue — pointed to a firmer discretionary-spend pipeline into the next fiscal year, the first up-beat tone after several soft quarters.",
    impact: "Medium",
    confidence: 64,
    impactMap: [
      "IT majors flag a firmer deal pipeline",
      "Discretionary client budgets look to be thawing",
      "Growth expectations for the services group lift",
      "TCS / INFY re-rate, pending confirmation in book-to-bill",
    ],
    signalType: "Guidance / Outlook",
    thesisRelevance: "Medium",
    timeHorizon: "Next 1–2 results — confirmed only by booked TCV",
    linkedThemes: [
      { id: "market-toll-booths", label: "Market Toll Booths" },
      { id: "internet-2-0", label: "Internet 2.0: Agents & Superapps" },
    ],
    direct: [
      { ticker: "TCS.NS", note: "Bellwether for the services cycle", dir: "up", role: "Services-cycle bellwether", watch: "Book-to-bill, large-deal TCV", impact: "Medium" },
      { ticker: "INFY.NS", note: "Direct read-through on deal momentum", dir: "up", role: "Large-cap services peer", watch: "Deal TCV, FY guidance revision", impact: "Medium" },
    ],
    peers: [{ ticker: "RELIANCE.NS", note: "Broad India large-cap sentiment", dir: "flat", role: "India large-cap sentiment proxy", watch: "Nifty IT relative strength", impact: "Low" }],
    sector: { name: "IT Services", note: "Pipeline commentary often re-rates the whole services group." },
    etfs: [],
    whyAffected:
      "Services revenue tracks client discretionary budgets; a firmer pipeline supports growth expectations across the group. Commentary is a leading indicator — it only becomes fundamental once it shows up in booked deal value.",
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
    whatChanged:
      "A signed multi-mission government award lands on the books — concrete backlog, not a press-release intent — extending revenue visibility for a pre-profit launch name.",
    impact: "Medium",
    confidence: 70,
    impactMap: [
      "Launch provider wins a multi-mission award",
      "Backlog and manifest visibility improve",
      "Near-term demand uncertainty falls for the name",
      "RKLB re-rates; sentiment spills to other space names",
    ],
    signalType: "Event-driven",
    thesisRelevance: "Medium",
    timeHorizon: "Plays out as launches are executed against the manifest",
    linkedThemes: [
      { id: "spacex-orbital-internet", label: "SpaceX & Orbital Internet" },
      { id: "global-defence-rearmament", label: "Global Defence Re-Armament" },
    ],
    direct: [{ ticker: "RKLB", note: "Direct recipient of the award", dir: "up", role: "Award recipient (launch)", watch: "Launch cadence vs manifest, margin on gov work", impact: "High" }],
    peers: [{ ticker: "ASTS", note: "Sentiment read-through across space names", dir: "up", role: "Space-economy peer", watch: "Own milestone / contract flow", impact: "Low" }],
    sector: { name: "Aerospace", note: "Contract awards improve revenue visibility for the cohort." },
    etfs: [],
    whyAffected:
      "Backlog and manifest visibility are key for pre-profit space names; a multi-mission award reduces near-term demand uncertainty. The value depends on execution — it converts to revenue only as launches actually fly.",
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
    whatChanged:
      "The tone on near-term EV demand turned cautious, with fresh mentions of pricing pressure — sentiment and channel chatter rather than a confirmed delivery miss.",
    impact: "Medium",
    confidence: 55,
    impactMap: [
      "Commentary flags softer EV demand + discounting",
      "Unit-economics / margin worries resurface",
      "TSLA most exposed to the demand narrative",
      "Index ETFs barely move — effect diluted by diversification",
    ],
    signalType: "Sentiment / Narrative",
    thesisRelevance: "Medium",
    timeHorizon: "Short-term, until delivery and pricing data confirm",
    linkedThemes: [
      { id: "china-ev-shockwave", label: "China EV Shockwave" },
      { id: "battery-storage-beyond-evs", label: "Battery Storage Beyond EVs" },
    ],
    direct: [{ ticker: "TSLA", note: "Most exposed to the demand narrative", dir: "down", role: "Most-exposed EV maker", watch: "Deliveries, inventory days, pricing actions", impact: "Medium" }],
    peers: [{ ticker: "NVDA", note: "Minor read-through via autonomy compute", dir: "flat", role: "Autonomy-compute supplier", watch: "Auto/robotaxi compute commentary", impact: "Low" }],
    sector: { name: "Autos", note: "Pricing pressure can compress margins across the group." },
    etfs: [{ ticker: "QQQ", note: "Large-cap index with notable single-name weight", dir: "flat" }],
    whyAffected:
      "Softer demand and discounting pressure unit economics; for index ETFs the effect is diluted by diversification. Until deliveries or pricing actions confirm it, treat this as narrative rather than a fundamental reset.",
    whatToWatch: [
      "Delivery and inventory updates",
      "Pricing actions and their margin impact",
      "Any shift in the autonomy timeline",
    ],
  },
];

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
