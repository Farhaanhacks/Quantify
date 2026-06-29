// Rare Finds: a curated, research-grounded watchlist of names that screen as
// undervalued and/or high-potential, plus 2–3 year investment "plans" framed
// around the 2026 AI-bubble debate. EDUCATIONAL RESEARCH ONLY — not advice.
// Grounded in mid-2026 reporting (Morningstar fair-value work, Deutsche Bank /
// BofA AI-bubble surveys, Vanguard 2026 outlook). Figures are approximate and
// move daily; treat every entry as a starting point for your own work.

export type Conviction = "High" | "Medium" | "Speculative";

// One leg of the illustrative scenario range (rough total return over the
// ~2–3yr horizon). These are study scenarios, NOT price targets or forecasts.
export interface FindScenario {
  pct: number; // approximate total return %, e.g. -40, +25, +120
  note: string;
}

export interface RareFind {
  ticker: string;
  name: string;
  tag: string;
  conviction: Conviction;
  signal: string; // short valuation/upside note
  thesis: string;
  risk: string;
  reasons: string[]; // why this screens as a rare find
  scenarios: { downside: FindScenario; base: FindScenario; upside: FindScenario };
  // When true, the card pulls this name's most recent insider BUY live from the
  // SEC Form 4 feed (real shares + price) instead of any hardcoded figure.
  insiderLive?: boolean;
  insiderNote?: string; // fallback / context shown alongside the live buy
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
    reasons: [
      "Wide-moat global brand trading well below its historical multiple.",
      "The driver is self-help (margins, inventory) — not the AI cycle, so low correlation to a tech-led drawdown.",
      "Screens deeply below several independent fair-value estimates.",
    ],
    scenarios: {
      downside: { pct: -15, note: "Turnaround stalls; weak consumer & China drag persist." },
      base: { pct: 35, note: "Margins and inventory normalise; multiple partly recovers." },
      upside: { pct: 80, note: "Full brand re-rate back toward historical multiples." },
    },
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
    reasons: [
      "Sits in the most undervalued sector on some 2026 fair-value reads.",
      "~7% dividend yield, covered by defensive medical-office/lab cash flows.",
      "Acts as ballast if growth multiples compress.",
    ],
    scenarios: {
      downside: { pct: -15, note: "Rates stay high; real-estate sentiment stays poor." },
      base: { pct: 25, note: "Yield collected + modest discount-to-NAV closing." },
      upside: { pct: 55, note: "Rate relief re-rates the REIT toward fair value." },
    },
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
    reasons: [
      "High, cash-covered dividend yield — paid while you wait.",
      "Cash-generative and defensive; a rotation-to-safety beneficiary.",
      "Valuation already prices in a lot of pessimism.",
    ],
    scenarios: {
      downside: { pct: -10, note: "Price competition and debt keep a lid on it." },
      base: { pct: 20, note: "Dividend plus a small valuation recovery." },
      upside: { pct: 40, note: "Debt paydown + safety bid re-rates it." },
    },
  },
  {
    ticker: "RKT",
    name: "Rocket Companies",
    tag: "Contrarian · rate cycle",
    conviction: "Speculative",
    signal: "Below Morningstar's ~$17 fair value after a weak 2026 start",
    thesis:
      "A leveraged bet on the mortgage cycle — if rates ease, refinancing and origination volumes can snap back hard off a low base.",
    risk: "Highly rate-dependent and cyclical; a 'higher for longer' rate path keeps the core business under pressure.",
    reasons: [
      "Dominant mortgage originator with huge operating leverage to a rate-cut cycle.",
      "Starting from a deeply depressed origination base — big snap-back potential.",
      "Trades below independent fair-value estimates after a weak start.",
    ],
    scenarios: {
      downside: { pct: -45, note: "'Higher for longer' keeps mortgage volumes depressed." },
      base: { pct: 30, note: "Gradual rate relief lifts originations off the bottom." },
      upside: { pct: 160, note: "A real rate-cut cycle reignites refi volumes." },
    },
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
    reasons: [
      "Largest US natural-gas producer — a physical AI-power beneficiary.",
      "Exposure to the AI build-out that doesn't rely on software multiples holding.",
      "Geared to rising datacenter electricity and LNG demand.",
    ],
    scenarios: {
      downside: { pct: -30, note: "Warm winter / weak gas prices gut earnings." },
      base: { pct: 35, note: "Steady gas demand + datacenter power tailwind." },
      upside: { pct: 110, note: "Tight gas market + datacenter power contracts re-rate it." },
    },
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
    reasons: [
      "Picks-and-shovels exposure to electrification and grid upgrades.",
      "Direct beneficiary of surging utility/datacenter power demand.",
      "Project backlog gives forward revenue visibility.",
    ],
    scenarios: {
      downside: { pct: -45, note: "Project delays, leverage and rate sensitivity bite." },
      base: { pct: 40, note: "Backlog converts; grid-demand tailwind plays out." },
      upside: { pct: 130, note: "Power crunch accelerates project wins and margins." },
    },
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
    reasons: [
      "Leverage to silver/gold — a non-correlated hedge to a growth-heavy book.",
      "Tends to firm up during equity drawdowns and macro stress.",
      "High-beta to the metal price, so a little goes a long way as ballast.",
    ],
    scenarios: {
      downside: { pct: -40, note: "Calm markets + cost/operational misses erase the hedge." },
      base: { pct: 30, note: "Firm metal prices and steady output." },
      upside: { pct: 120, note: "Equity stress + rising metals send miners sharply higher." },
    },
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
    reasons: [
      "Production growth on top of a strong gold backdrop.",
      "Hedge against an equity drawdown or a weaker dollar.",
      "Operating leverage to a rising gold price.",
    ],
    scenarios: {
      downside: { pct: -40, note: "Mine execution/cost misses + softer gold." },
      base: { pct: 35, note: "Output ramps as planned with firm gold." },
      upside: { pct: 120, note: "Strong gold + delivery on the production ramp." },
    },
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
    reasons: [
      "Profitable AI-networking backbone — real earnings, not just a story.",
      "A 'buy the dip' candidate if an AI pullback drags it with the group.",
      "Fair-value estimates have been rising on datacenter growth.",
    ],
    scenarios: {
      downside: { pct: -45, note: "Datacenter capex slowdown or overbuild hits it hard." },
      base: { pct: 25, note: "Steady datacenter growth supports earnings." },
      upside: { pct: 80, note: "AI networking demand keeps compounding." },
    },
  },
  {
    ticker: "SOFI",
    name: "SoFi Technologies",
    tag: "Insider-backed fintech",
    conviction: "Medium",
    signal: "Turned GAAP-profitable; CEO is a repeat open-market buyer",
    thesis:
      "A digital-first 'one-stop' financial app that has crossed into sustained GAAP profitability, with a bank charter giving it cheaper deposit funding. The engine is member growth and cross-selling more products per member — the bull case is it becomes a primary bank for a generation.",
    risk: "Consumer-credit sensitive — a recession and rising loan charge-offs would hit its lending book; still richly valued for a lender.",
    reasons: [
      "Crossed into sustained GAAP profitability, with a bank charter funding cheaper deposits.",
      "Fast member growth and rising products-per-member (cross-sell flywheel).",
      "Strong insider conviction — the CEO has repeatedly bought shares on the open market.",
    ],
    insiderLive: true,
    insiderNote:
      "SoFi CEO Anthony Noto has been a consistent, large open-market buyer of the stock over the years — an unusually direct insider vote of confidence. The figure shown is pulled live from SEC Form 4 filings.",
    scenarios: {
      downside: { pct: -40, note: "Recession spikes loan charge-offs and credit losses." },
      base: { pct: 30, note: "Steady member growth; profitability compounds." },
      upside: { pct: 120, note: "Becomes a primary-bank platform and re-rates as a fintech winner." },
    },
  },
  {
    ticker: "NOW",
    name: "ServiceNow",
    tag: "Quality compounder · AI workflows",
    conviction: "Medium",
    signal: "Durable 20%+ growth; AI agents embedded across enterprise workflows",
    thesis:
      "The platform large enterprises run their IT, HR and operations workflows on — sticky, high-margin and cash-generative, now embedding AI agents (Now Assist) across those workflows. A profitable way to own enterprise-AI adoption rather than a speculative bet on it.",
    risk: "Premium valuation leaves little room for error; an enterprise IT-spend slowdown would compress the multiple even if the business stays solid.",
    reasons: [
      "Mission-critical workflow platform with very high retention and margins.",
      "Real, profitable AI monetisation (Now Assist agents) — not just a narrative.",
      "Durable ~20%+ growth backed by strong free cash flow.",
    ],
    scenarios: {
      downside: { pct: -30, note: "IT-spend slowdown compresses a rich multiple." },
      base: { pct: 25, note: "Steady growth plus AI upsell across the base." },
      upside: { pct: 70, note: "AI agents accelerate growth and the multiple re-rates higher." },
    },
  },
  {
    ticker: "IRDM",
    name: "Iridium Communications",
    tag: "Space · satellite connectivity",
    conviction: "Medium",
    signal: "Profitable, cash-generative satellite network — rare for a space name",
    thesis:
      "Owns a global, already-built low-earth-orbit satellite constellation, and is profitable and free-cash-flow generative — unusual for a space company. A defensive, contracted government + IoT revenue base, with direct-to-device connectivity as growth optionality on top.",
    risk: "Satellite-to-phone competition (Starlink, AST SpaceMobile) could pressure its niche, and capex for the next-gen constellation looms.",
    reasons: [
      "A rare profitable, FCF-positive space company with the constellation already built and paid down.",
      "Defensive, contracted government and IoT revenue base.",
      "Direct-to-device / IoT connectivity as a growth kicker.",
    ],
    scenarios: {
      downside: { pct: -25, note: "Starlink / AST competition pressures its connectivity niche." },
      base: { pct: 25, note: "Steady free cash flow plus IoT subscriber growth." },
      upside: { pct: 80, note: "Direct-to-device scales and the market re-rates the franchise." },
    },
  },
  {
    ticker: "TTWO",
    name: "Take-Two Interactive",
    tag: "Catalyst-driven · GTA VI",
    conviction: "Medium",
    signal: "GTA VI launch cycle — potentially the biggest entertainment release ever",
    thesis:
      "Owns Grand Theft Auto. GTA VI is set up to be one of the largest entertainment launches in history, but trailing cash flows look weak because the catalyst isn't in the financials yet — a classic case of backward-looking numbers hiding the forward story.",
    risk: "Another GTA VI delay, monetisation that disappoints, or expectations that are already priced in.",
    reasons: [
      "A generational, hard-to-replicate franchise (GTA) with a once-in-a-decade catalyst directly ahead.",
      "Trailing cash flows understate the business because the GTA VI release isn't in the numbers yet.",
      "Recurrent consumer spending (online/in-game) provides a durable base between releases.",
    ],
    scenarios: {
      downside: { pct: -25, note: "A further delay or a soft launch vs sky-high expectations." },
      base: { pct: 30, note: "Solid launch broadly in line with expectations." },
      upside: { pct: 90, note: "Record launch plus sustained online monetisation." },
    },
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
    reasons: [
      "Dominant launch franchise plus the Starlink connectivity business.",
      "Newly public — scarce, high-demand growth optionality.",
      "Multi-year runway on launch cadence and satellite broadband.",
    ],
    scenarios: {
      downside: { pct: -50, note: "Rich valuation + losses + lock-up unwinds drive volatility." },
      base: { pct: 30, note: "Execution on launch cadence and Starlink growth." },
      upside: { pct: 200, note: "Starlink scales and the launch moat widens further." },
    },
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
