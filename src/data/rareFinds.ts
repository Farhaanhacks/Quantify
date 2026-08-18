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
    ticker: "ZETA",
    name: "Zeta Global Holdings",
    tag: "AI marketing cloud",
    conviction: "Speculative",
    signal: "Fast-growing AI marketing cloud; free-cash-flow positive, GAAP lossmaking",
    thesis:
      "An AI-driven marketing and data cloud: it pairs a large proprietary identity dataset with machine-learning models to target, personalise and measure omnichannel campaigns. Revenue is compounding quickly and free cash flow is positive, even though heavy stock-based compensation keeps GAAP results in the red.",
    risk: "GAAP-lossmaking with high stock-based comp diluting holders; a 2024 short-seller report questioned its data sourcing and revenue quality; ad budgets are cyclical and soften in a downturn.",
    reasons: [
      "Rapid, durable revenue growth as marketers consolidate onto AI-driven data platforms.",
      "Already free-cash-flow positive; uncommon for a company still growing this fast.",
      "Proprietary identity data plus AI models is a hard-to-replicate moat in ad-tech.",
    ],
    scenarios: {
      downside: { pct: -55, note: "Ad-spend downturn or renewed accounting scrutiny re-rates it sharply lower." },
      base: { pct: 30, note: "Growth keeps compounding and GAAP losses narrow toward profitability." },
      upside: { pct: 140, note: "Scales into sustained GAAP profitability and re-rates as an AI-platform winner." },
    },
  },
  {
    ticker: "DOC",
    name: "Healthpeak Properties",
    tag: "Defensive value",
    conviction: "Medium",
    signal: "~40% below fair value, ~7% dividend yield (Morningstar, 2026)",
    thesis:
      "Medical-office and lab REIT; the most undervalued sector by Morningstar's read. Defensive cash flows and a fat yield make it ballast if growth multiples compress.",
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
      "A boring, cash-generative telecom on a high yield; the kind of name that holds value when the market sells the froth and rotates to safety.",
    risk: "Heavy debt, fierce price competition, and little growth; total return leans on the dividend.",
    reasons: [
      "High, cash-covered dividend yield; paid while you wait.",
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
      "A leveraged bet on the mortgage cycle; if rates ease, refinancing and origination volumes can snap back hard off a low base.",
    risk: "Highly rate-dependent and cyclical; a 'higher for longer' rate path keeps the core business under pressure.",
    reasons: [
      "Dominant mortgage originator with huge operating leverage to a rate-cut cycle.",
      "Starting from a deeply depressed origination base; big snap-back potential.",
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
      "Largest US natural-gas producer; a physical AI-power beneficiary.",
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
    signal: "Silver/gold miner; leverage to metal prices",
    thesis:
      "Precious-metals miners tend to catch a bid when equities wobble and macro uncertainty rises. A small ballast sleeve here can offset a growth-heavy book if the AI trade unwinds.",
    risk: "Miners are high-beta on the metal price; operational misses and costs can erase the hedge.",
    reasons: [
      "Leverage to silver/gold; a non-correlated hedge to a growth-heavy book.",
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
      "A gold miner with production growth; geared to a strong gold backdrop and a hedge against an equity drawdown or a weaker dollar.",
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
    ticker: "SOFI",
    name: "SoFi Technologies",
    tag: "Insider-backed fintech",
    conviction: "Medium",
    signal: "Turned GAAP-profitable; CEO is a repeat open-market buyer",
    thesis:
      "A digital-first 'one-stop' financial app that has crossed into sustained GAAP profitability, with a bank charter giving it cheaper deposit funding. The engine is member growth and cross-selling more products per member; the bull case is it becomes a primary bank for a generation.",
    risk: "Consumer-credit sensitive; a recession and rising loan charge-offs would hit its lending book; still richly valued for a lender.",
    reasons: [
      "Crossed into sustained GAAP profitability, with a bank charter funding cheaper deposits.",
      "Fast member growth and rising products-per-member (cross-sell flywheel).",
      "Strong insider conviction; the CEO has repeatedly bought shares on the open market.",
    ],
    insiderLive: true,
    insiderNote:
      "SoFi CEO Anthony Noto has been a consistent, large open-market buyer of the stock over the years; an unusually direct insider vote of confidence. The figure shown is pulled live from SEC Form 4 filings.",
    scenarios: {
      downside: { pct: -40, note: "Recession spikes loan charge-offs and credit losses." },
      base: { pct: 30, note: "Steady member growth; profitability compounds." },
      upside: { pct: 120, note: "Becomes a primary-bank platform and re-rates as a fintech winner." },
    },
  },
  {
    ticker: "IRDM",
    name: "Iridium Communications",
    tag: "Space · satellite connectivity",
    conviction: "Medium",
    signal: "Profitable, cash-generative satellite network; rare for a space name",
    thesis:
      "Owns a global, already-built low-earth-orbit satellite constellation, and is profitable and free-cash-flow generative; unusual for a space company. A defensive, contracted government + IoT revenue base, with direct-to-device connectivity as growth optionality on top.",
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
    signal: "GTA VI launch cycle; potentially the biggest entertainment release ever",
    thesis:
      "Owns Grand Theft Auto. GTA VI is set up to be one of the largest entertainment launches in history, but trailing cash flows look weak because the catalyst isn't in the financials yet; a classic case of backward-looking numbers hiding the forward story.",
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
    ticker: "TEAM",
    name: "Atlassian",
    tag: "Quality SaaS compounder",
    conviction: "Medium",
    signal: "Durable double-digit growth; free-cash-flow generative developer-software platform",
    thesis:
      "Owns the tools software teams run on. Jira, Confluence and a growing cloud portfolio; with a low-touch, land-and-expand model and very high retention. Strongly free-cash-flow generative even while GAAP results carry heavy stock-based compensation, and it's layering AI (Rovo) on top of a huge installed base rather than betting the company on a single AI narrative.",
    risk: "Premium valuation leaves little room for error; a seat-based model is exposed if AI-driven productivity slows headcount growth at its customers, and stock-based comp dilutes holders.",
    reasons: [
      "Mission-critical developer/collaboration software with very high retention and pricing power.",
      "Highly free-cash-flow generative with a long cloud-migration and upsell runway.",
      "Adding AI (Rovo) across a large installed base; monetising AI from strength, not hype.",
    ],
    scenarios: {
      downside: { pct: -35, note: "A software-spend slowdown compresses a rich multiple." },
      base: { pct: 30, note: "Steady cloud growth plus AI upsell across the base." },
      upside: { pct: 90, note: "Cloud migration and AI attach reaccelerate growth and the multiple re-rates." },
    },
  },
  {
    ticker: "PATH",
    name: "UiPath",
    tag: "Beaten-down automation · AI optionality",
    conviction: "Speculative",
    signal: "Down heavily from its IPO highs; net cash, free-cash-flow positive automation leader",
    thesis:
      "The leader in robotic process automation, sold off hard since its 2021 IPO on decelerating growth. What's left is a company with a large net-cash balance sheet, positive free cash flow and a real, sticky enterprise customer base; now pivoting from rules-based bots toward agentic AI automation. A contrarian bet that the market has over-punished the growth slowdown and under-priced the AI-agent optionality.",
    risk: "Growth has slowed sharply and could stall further; large tech and AI-agent start-ups are crowding into automation, and a botched agentic transition would leave it a shrinking legacy vendor.",
    reasons: [
      "Deeply out of favour and far below IPO highs; expectations are low.",
      "Strong net-cash balance sheet and positive free cash flow give it staying power.",
      "Agentic-AI pivot gives real optionality on top of a sticky RPA install base.",
    ],
    scenarios: {
      downside: { pct: -50, note: "Growth stalls further and AI-agent rivals erode the RPA franchise." },
      base: { pct: 35, note: "Growth stabilises; cash generation and buybacks support the floor." },
      upside: { pct: 130, note: "The agentic-AI transition reignites growth and the market re-rates it." },
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
      "Skip the overhyped mega-cap AI names. Pair the physical-world inputs the AI build-out actually needs (power) plus a reasonably-valued AI software grower, with a sleeve of cheap defensive value. You stay exposed to the theme without betting the book on lofty mega-cap multiples holding.",
    bubbleAngle:
      "If the AI trade corrects (analysts model 20–50% drawdowns in the mega-cap leaders), the value sleeve cushions you; and gives you dry powder to add on the way down.",
    watch: "Hyperscaler capex guidance, datacenter power demand, and whether AI revenue actually scales with the spend.",
    risk: "If the bubble keeps inflating, the defensive sleeve lags and you underperform a melt-up.",
    tickers: ["EXE", "ZETA", "DOC", "VZ"],
  },
  {
    id: "power",
    title: "Powering the AI Build-Out",
    horizon: "2–3 years",
    thesis:
      "Own the physical inputs AI can't run without; electricity, gas, grid and efficiency. Datacenter capex is projected past $500B in 2026, and all of it needs power.",
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
      "A deliberate ballast sleeve; precious-metals miners and cheap value; sized to offset a growth-heavy portfolio if sentiment turns.",
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
      "Wide-moat compounders trading below fair value for company-specific reasons; not because of the AI cycle. Lower correlation to a tech-led drawdown.",
    bubbleAngle:
      "These names can keep working even if AI multiples compress, because their stories (brand turnaround, mortgage cycle, pricing power) are their own.",
    watch: "Margin recovery, free-cash-flow trends, and whether the discount to fair value is closing.",
    risk: "'Cheap for a reason' is real; turnarounds can stay broken longer than you can stay patient.",
    tickers: ["RKT", "DOC"],
  },
];
