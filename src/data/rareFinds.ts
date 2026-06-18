// Rare Finds: a curated, research-grounded watchlist of names that screen as
// undervalued and/or high-potential, plus 2–3 year investment "plans" framed
// around the 2026 AI-bubble debate. EDUCATIONAL RESEARCH ONLY — not advice.
// Grounded in mid-2026 reporting (Morningstar fair-value work, Deutsche Bank /
// BofA AI-bubble surveys, Vanguard 2026 outlook). Figures are approximate and
// move daily; treat every entry as a starting point for your own work.

export type Conviction = "High" | "Medium" | "Speculative";

export interface RareFind {
  ticker: string;
  name: string;
  tag: string;
  conviction: Conviction;
  signal: string; // short valuation/upside note
  thesis: string;
  risk: string;
}

export const rareFinds: RareFind[] = [
  {
    ticker: "NKE",
    name: "Nike",
    tag: "Quality on sale",
    conviction: "Medium",
    signal: "Screened ~50%+ below some fair-value estimates in 2026",
    thesis:
      "A wide-moat consumer brand deep in a turnaround, trading at a fraction of its peak multiple. Margin recovery and inventory normalization are the swing factors — and it's barely correlated to the AI trade.",
    risk: "Turnarounds take longer than hoped; weak consumer and China exposure can drag results for several quarters.",
  },
  {
    ticker: "DOC",
    name: "Healthpeak Properties",
    tag: "Defensive value",
    conviction: "Medium",
    signal: "~40% below fair value, ~7% dividend yield (Morningstar, 2026)",
    thesis:
      "Medical-office and lab REIT — the most undervalued sector by Morningstar's read. Defensive cash flows and a fat yield make it ballast if growth multiples compress.",
    risk: "Rate-sensitive; office/real-estate sentiment is poor and organic growth has been slow.",
  },
  {
    ticker: "VZ",
    name: "Verizon",
    tag: "Defensive value",
    conviction: "Medium",
    signal: "High single-digit yield; long-time value pick",
    thesis:
      "A boring, cash-generative telecom on a high yield — the kind of name that holds value when the market sells the froth and rotates to safety.",
    risk: "Heavy debt, fierce price competition, and little growth; total return leans on the dividend.",
  },
  {
    ticker: "RKT",
    name: "Rocket Companies",
    tag: "Contrarian",
    conviction: "Speculative",
    signal: "Below Morningstar's ~$17 fair value after a weak 2026 start",
    thesis:
      "A leveraged bet on the mortgage cycle — if rates ease, refinancing and origination volumes can snap back hard off a low base.",
    risk: "Highly rate-dependent and cyclical; a 'higher for longer' rate path keeps the core business under pressure.",
  },
  {
    ticker: "EXE",
    name: "Expand Energy",
    tag: "Energy for the AI build-out",
    conviction: "Medium",
    signal: "Largest US natural-gas producer; powering datacenter demand",
    thesis:
      "AI datacenters need enormous, reliable power, and gas is the bridge fuel. As the biggest US gas producer, it's a physical-world beneficiary of the AI boom that doesn't depend on AI software multiples holding up.",
    risk: "Commodity prices are volatile; a warm winter or weak LNG demand can gut earnings.",
  },
  {
    ticker: "AMRC",
    name: "Ameresco",
    tag: "Energy for the AI build-out",
    conviction: "Speculative",
    signal: "Energy-efficiency & grid-infrastructure play",
    thesis:
      "Builds the efficiency and grid projects utilities need as power demand surges. A 'picks and shovels' angle on electrification and the datacenter power crunch.",
    risk: "Lumpy project revenue, balance-sheet leverage, and policy/interest-rate sensitivity make it a bumpy ride.",
  },
  {
    ticker: "CDE",
    name: "Coeur Mining",
    tag: "Bubble hedge · precious metals",
    conviction: "Speculative",
    signal: "Silver/gold miner — leverage to metal prices",
    thesis:
      "Precious-metals miners tend to catch a bid when equities wobble and macro uncertainty rises. A small ballast sleeve here can offset a growth-heavy book if the AI trade unwinds.",
    risk: "Miners are high-beta on the metal price; operational misses and costs can erase the hedge.",
  },
  {
    ticker: "IAG",
    name: "IAMGOLD",
    tag: "Bubble hedge · precious metals",
    conviction: "Speculative",
    signal: "Gold producer ramping output",
    thesis:
      "A gold miner with production growth — geared to a strong gold backdrop and a hedge against an equity drawdown or a weaker dollar.",
    risk: "Execution and cost risk at its mines; gold-price swings dominate the story.",
  },
  {
    ticker: "ANET",
    name: "Arista Networks",
    tag: "AI infrastructure — buy weakness",
    conviction: "Medium",
    signal: "Fair-value estimates raised on datacenter growth, 2026",
    thesis:
      "The networking backbone of AI datacenters, with genuine earnings (unlike many AI names). The plan isn't to chase it — it's to have a price in mind and accumulate if an AI pullback drags it down with the rest.",
    risk: "Still an AI-cycle name: a datacenter capex slowdown or overbuild would hit it hard.",
  },
  {
    ticker: "SPCX",
    name: "SpaceX",
    tag: "Speculative growth",
    conviction: "Speculative",
    signal: "Newly public (June 2026); currently lossmaking",
    thesis:
      "The dominant launch + Starlink franchise, finally public. A multi-year story on launch cadence and satellite connectivity — but priced for a lot of future success.",
    risk: "Rich valuation, negative earnings, thin trading history, and lock-up dynamics make early volatility likely.",
  },
];

export interface InvestmentPlan {
  id: string;
  title: string;
  horizon: string;
  thesis: string;
  bubbleAngle: string;
  watch: string;
  risk: string;
  tickers: string[];
}

export const investmentPlans: InvestmentPlan[] = [
  {
    id: "barbell",
    title: "The Barbell",
    horizon: "2–3 years",
    thesis:
      "Pair a few quality, profitable AI-infrastructure names with a sleeve of cheap defensive value. You stay exposed to the AI build-out without betting the whole book on lofty multiples holding.",
    bubbleAngle:
      "If the AI trade corrects (analysts model 20–50% drawdowns in the mega-cap leaders), the value sleeve cushions you — and gives you dry powder to add to the AI names after they overshoot to the downside.",
    watch: "Hyperscaler capex guidance, datacenter utilization, and whether AI revenue actually scales with the spend.",
    risk: "If the bubble keeps inflating, the defensive sleeve lags and you underperform a melt-up.",
    tickers: ["ANET", "MSFT", "DOC", "VZ"],
  },
  {
    id: "power",
    title: "Powering the AI Build-Out",
    horizon: "2–3 years",
    thesis:
      "Own the physical inputs AI can't run without — electricity, gas, grid and efficiency. Datacenter capex is projected past $500B in 2026, and all of it needs power.",
    bubbleAngle:
      "Even if AI software valuations deflate, the power demand is already contracted and physical. This is the part of the AI story with the longest, least-hype-dependent runway.",
    watch: "Power-purchase agreements with hyperscalers, natural-gas demand, and grid-interconnection bottlenecks.",
    risk: "Commodity-price swings and project lumpiness; a genuine AI capex pause would eventually hit demand too.",
    tickers: ["EXE", "AMRC"],
  },
  {
    id: "hedge",
    title: "Hedge the Froth",
    horizon: "2–3 years",
    thesis:
      "A deliberate ballast sleeve — precious-metals miners and cheap value — sized to offset a growth-heavy portfolio if sentiment turns.",
    bubbleAngle:
      "With ~45–57% of surveyed managers calling AI the market's biggest tail risk, a non-correlated hedge is cheap insurance. Gold and silver historically firm up during equity drawdowns and macro stress.",
    watch: "Real interest rates, the dollar, and equity-market breadth (narrow leadership is a warning sign).",
    risk: "If markets stay calm, the hedge is a drag; miners are volatile and not a clean hedge day-to-day.",
    tickers: ["CDE", "IAG", "DOC"],
  },
  {
    id: "quality-on-sale",
    title: "Quality on Sale",
    horizon: "2–3 years",
    thesis:
      "Wide-moat compounders trading below fair value for company-specific reasons — not because of the AI cycle. Lower correlation to a tech-led drawdown.",
    bubbleAngle:
      "These names can keep working even if AI multiples compress, because their stories (brand turnaround, mortgage cycle, pricing power) are their own.",
    watch: "Margin recovery, free-cash-flow trends, and whether the discount to fair value is closing.",
    risk: "'Cheap for a reason' is real — turnarounds can stay broken longer than you can stay patient.",
    tickers: ["NKE", "RKT"],
  },
];
