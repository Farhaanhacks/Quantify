// Global thematic research library — "Ideas worth watching". Each idea is a
// study framework, not a recommendation: a core thesis, why it matters now,
// the names grouped by their role in the theme, a best/base/worst scenario map,
// a research checklist, a Quantifi scorecard and a source trail.
//
// Authored as research education. Nothing here is advice.

export interface IdeaName {
  symbol: string;
  role: string; // one-line "why this name is in the theme"
  why?: string; // mini-card: why it matters
  risk?: string; // mini-card: main risk
  watch?: string; // mini-card: what to watch
  tag?: "Direct" | "Indirect" | "Commodity-linked" | "Early-stage"; // exposure type
}

export interface NameGroup {
  label: string; // e.g. "Maturing post-hype survivors"
  note?: string; // optional one-liner about the bucket
  names: IdeaName[];
}

export interface Scenario {
  kind: "Best case" | "Base case" | "Worst case";
  what: string; // what happens
  wins: string; // what tends to win in that scenario
  redFlag?: string; // the warning sign for that scenario
}

export interface ThemeMapLink {
  layer: string; // a value-chain layer
  symbols: string[];
}

export interface ChecklistItem {
  question: string;
  why: string;
}

// A thesis test reads like a research signal, not a to-do checkbox: it carries a
// live read (signal), how much it matters (importance), the metric to track and
// the condition that would break the thesis.
export interface ThesisTest {
  test: string;
  signal:
    | "Strengthening"
    | "Mixed"
    | "Weakening"
    | "Early"
    | "Unproven"
    | "Critical test"
    | "Rising risk"
    | "Watch closely";
  importance: "Low" | "Medium" | "High" | "Very high";
  why: string;
  metric: string;
  breaksIf: string;
}

export interface SourceItem {
  type: string; // e.g. "Earnings calls"
  checks: string; // what that source verifies
}

export interface IdeaScore {
  label: string;
  score: number; // 0–10, higher is better (more attractive / lower risk)
}

export interface TradingIdea {
  id: string;
  title: string;
  category: string;
  tagline: string;
  description: string; // core thesis
  whyNow: string;
  regions: string[];
  timeHorizon: string;
  maturity: string;
  valuationRisk: string;
  bullCase: string;
  bearCase: string;
  watch: string[];
  bestFor?: string;
  riskTag: string;
  groups: NameGroup[];
  scenarios: Scenario[];
  checklist: ChecklistItem[];
  scores: IdeaScore[];
  verdict: string; // research framing, never "buy"
  sources?: string[];
  // Dashboard layer — the one-line hook, a value-chain map, the bull/bear causal
  // chain, the prove/break test and a quick "theme weather" status.
  question?: string;
  themeWeather?: string;
  swingFactor?: string;
  themeMap?: ThemeMapLink[];
  bullRoad?: string[];
  bearRoad?: string[];
  proves?: string[];
  breaks?: string[];
  thesisTests?: ThesisTest[];
  sourcePack?: SourceItem[];
  // Derived for back-compatibility with other surfaces.
  names: IdeaName[];
  tickers: string[];
  riskLens: string;
  signal: string;
}

// Tabs shown above the grid. Each idea belongs to exactly one.
export const ideaCategories = [
  "AI & Power",
  "Space",
  "China",
  "India",
  "Defence",
  "Healthcare",
  "Valuation",
  "Post-IPO",
  "Financialisation",
  "Hard Tech",
] as const;

type RawIdea = Omit<TradingIdea, "names" | "tickers" | "riskLens" | "signal">;

const RAW: RawIdea[] = [
  {
    id: "ai-power-bottleneck",
    title: "AI Power Bottleneck",
    category: "AI & Power",
    tagline: "The electricity, cooling and grid trade behind artificial intelligence",
    description:
      "AI is no longer just a GPU story. The next constraint is physical: electricity, cooling, transformers, backup power and data-centre capacity. The basket spans compute, the power chain that feeds it and the real estate that houses it.",
    whyNow:
      "The IEA projects data-centre electricity consumption to more than double to around 945 TWh by 2030, with the US and China driving most of the increase. Power, not silicon, is becoming the gating factor.",
    regions: ["US", "China", "India"],
    timeHorizon: "3–7 years",
    maturity: "Early-mid",
    valuationRisk: "High",
    bullCase:
      "AI capex keeps rising, power becomes scarce, and grid, cooling and data-centre names re-rate as the second-order AI trade.",
    bearCase:
      "AI monetisation disappoints, hyperscalers cut capex, and expensive infrastructure names de-rate quickly.",
    watch: ["Hyperscaler capex guidance", "Order backlog at power & cooling names", "Gross margins and inventory", "Grid interconnection queues"],
    bestFor: "Thematic investors, not low-risk investors",
    riskTag: "High capex dependency · High valuation sensitivity",
    groups: [
      {
        label: "Compute & silicon",
        names: [
          { symbol: "NVDA", role: "AI compute & systems leader", why: "Captures spend across GPUs, networking and full-stack AI systems", risk: "Customer concentration + hyperscaler capex cuts", watch: "Data-centre revenue, gross margin, Blackwell/Rubin cycle" },
          { symbol: "AVGO", role: "Custom AI silicon & networking", why: "Custom accelerators and networking ASICs for hyperscalers", risk: "Lumpy custom-silicon orders", watch: "AI revenue mix, custom-silicon wins" },
        ],
      },
      {
        label: "Networking & data centres",
        names: [
          { symbol: "ANET", role: "Data-centre switching", why: "High-speed switching for AI back-end networks", risk: "Cloud-customer concentration", watch: "Cloud-titan capex, 800G ramp" },
          { symbol: "EQIX", role: "Data-centre REIT" },
          { symbol: "DLR", role: "Data-centre REIT" },
        ],
      },
      {
        label: "Power & cooling",
        names: [
          { symbol: "VRT", role: "Power & cooling infrastructure", why: "Thermal and power systems are now the data-centre bottleneck", risk: "Cyclical orders", watch: "Order backlog, book-to-bill" },
          { symbol: "ETN", role: "Electrical power management" },
          { symbol: "GEV", role: "Grid equipment & power generation" },
        ],
      },
      {
        label: "India grid & power",
        names: [
          { symbol: "ABB.NS", role: "Electrification & automation (India)" },
          { symbol: "SIEMENS.NS", role: "Grid & industrial (India)" },
          { symbol: "TATAPOWER.NS", role: "Power utility & generation (India)" },
          { symbol: "POWERGRID.NS", role: "Transmission grid backbone (India)" },
        ],
      },
    ],
    scenarios: [
      { kind: "Best case", what: "AI capex keeps rising and power/cooling go scarce; grid, cooling and data-centre names re-rate.", wins: "VRT · ETN · GEV · EQIX · India grid" },
      { kind: "Base case", what: "Compute leads, the power chain follows with a lag; returns are uneven and name-specific.", wins: "NVDA · AVGO; selective power names" },
      { kind: "Worst case", what: "AI ROI disappoints and hyperscalers cut capex; the whole infrastructure basket de-rates.", wins: "Defensives; the basket de-rates" },
    ],
    checklist: [
      { question: "Is hyperscaler capex guidance still rising?", why: "It's the demand driver for the entire chain." },
      { question: "Is the order backlog growing at power & cooling names?", why: "Backlog is forward revenue." },
      { question: "Are gross margins holding as volumes scale?", why: "Tests pricing power vs commoditisation." },
      { question: "Are grid-interconnection queues easing or tightening?", why: "Defines how fast capacity can actually grow." },
      { question: "Is the multiple pricing perfection?", why: "Rich entry multiples amplify any disappointment." },
    ],
    scores: [
      { label: "Demand visibility", score: 7 },
      { label: "Valuation comfort", score: 4 },
      { label: "Backlog momentum", score: 8 },
      { label: "Balance-sheet strength", score: 6 },
      { label: "Cycle resilience", score: 3 },
    ],
    verdict: "Attractive structural theme, expensive basket. Research starting point only.",
    sources: ["IEA — Electricity 2024 / data-centre demand outlook", "Hyperscaler quarterly earnings calls & capex guidance", "Company investor presentations & 10-Ks"],
  },
  {
    id: "spacex-orbital-internet",
    title: "SpaceX & Orbital Internet",
    category: "Space",
    tagline: "Launch, Starlink, satellites, defence-space and orbital infrastructure",
    description:
      "With SpaceX now public, space becomes a flagship theme: launch cadence, satellite broadband, earth observation, defence-space and the Indian space-industrial base scaling together.",
    whyNow:
      "Reuters reported SpaceX priced a record IPO in June 2026 and moved quickly into index-inclusion discussions — so SPCX is still a fresh listing to judge, anchoring a broader orbital-infrastructure basket.",
    regions: ["US", "China", "India"],
    timeHorizon: "3–10 years",
    maturity: "Early",
    valuationRisk: "High",
    bullCase:
      "Space becomes mainstream infrastructure — launch, broadband, defence, earth observation and satellite services scale together.",
    bearCase:
      "Space stays capital-intensive; launch delays, weak Starlink margins or stretched valuations hurt the basket.",
    watch: ["Launch cadence", "Starlink subscriber & margin trend", "Defence-space contract awards", "Indian space-policy & ISRO commercial orders"],
    bestFor: "Long-horizon thematic investors",
    riskTag: "Long timelines · Mission risk · High valuation",
    groups: [
      {
        label: "Launch & broadband leaders",
        names: [
          { symbol: "SPCX", role: "Launch + Starlink leader (fresh IPO)", why: "Dominant launch cadence and the largest satellite-broadband network", risk: "Newly public — valuation and public-market discipline still untested", watch: "Launch rate, Starlink subs & ARPU, lock-ups" },
          { symbol: "RKLB", role: "Small-launch & space systems", why: "Vertically integrating from launch into space systems", risk: "Neutron timeline, cash burn", watch: "Neutron progress, space-systems backlog" },
          { symbol: "ASTS", role: "Direct-to-cell satellites", why: "Space-based cellular broadband to standard phones", risk: "Capex and deployment timeline", watch: "Satellite launches, carrier deals" },
        ],
      },
      {
        label: "Satellite services & data",
        names: [
          { symbol: "IRDM", role: "Satellite communications" },
          { symbol: "PL", role: "Earth-observation data" },
        ],
      },
      {
        label: "Defence-space primes",
        names: [
          { symbol: "LHX", role: "Defence & space electronics" },
          { symbol: "NOC", role: "Defence / space prime" },
          { symbol: "LMT", role: "Defence / space prime" },
        ],
      },
      {
        label: "India space-industrial base",
        names: [
          { symbol: "HAL.NS", role: "Aerospace & space (India)" },
          { symbol: "BEL.NS", role: "Defence & space electronics (India)" },
          { symbol: "DATAPATTNS.NS", role: "Defence-electronics (India)" },
          { symbol: "MTARTECH.NS", role: "Precision space/defence parts (India)" },
          { symbol: "PARAS.NS", role: "Defence optics & space (India)" },
        ],
      },
    ],
    scenarios: [
      { kind: "Best case", what: "Space becomes mainstream infrastructure — launch, broadband, defence and observation scale together.", wins: "SPCX · RKLB · ASTS · defence-space" },
      { kind: "Base case", what: "Leaders progress but timelines slip; the basket is volatile and execution-driven.", wins: "Diversified, stock-specific winners" },
      { kind: "Worst case", what: "Launch delays, weak Starlink margins or stretched valuations hit the basket.", wins: "Few; capital-intensive names de-rate" },
    ],
    checklist: [
      { question: "Is launch cadence rising on schedule?", why: "Cadence underpins the whole economics." },
      { question: "Are Starlink subscribers and ARPU growing profitably?", why: "Broadband margin is the swing factor." },
      { question: "Are defence-space contract awards growing?", why: "Government demand de-risks revenue." },
      { question: "Is cash burn funded through to milestones?", why: "Space is capital-intensive; funding gaps hurt." },
      { question: "Has valuation run ahead of delivery?", why: "Scarcity premiums can unwind fast." },
    ],
    scores: [
      { label: "Revenue visibility", score: 5 },
      { label: "Valuation comfort", score: 3 },
      { label: "Momentum", score: 8 },
      { label: "Balance-sheet strength", score: 5 },
      { label: "Execution certainty", score: 4 },
    ],
    verdict: "High-conviction long-term theme, early and richly priced. Study, don't chase.",
    sources: ["Reuters — SpaceX IPO & Russell addition coverage", "SEC — SpaceX S-1/A filings", "Company filings & defence budget documents"],
  },
  {
    id: "sovereign-ai-stacks",
    title: "Sovereign AI Stacks",
    category: "AI & Power",
    tagline: "Every major country wants its own AI infrastructure",
    description:
      "AI is becoming a matter of national strategy: the US protects its lead, China pursues domestic substitution, and India builds sovereign compute, local-language models and digital infrastructure.",
    whyNow:
      "Government AI funding, export controls and domestic-compute mandates are reshaping who can buy what — turning AI into a geopolitical capex cycle, not just a corporate one.",
    regions: ["US", "China", "India"],
    timeHorizon: "3–7 years",
    maturity: "Early-mid",
    valuationRisk: "High",
    bullCase: "Governments keep funding domestic AI, cloud, chips and data-centre capacity across regions.",
    bearCase: "Export controls, regulation, weak ROI and chip constraints slow the buildout.",
    watch: ["Export-control policy", "National AI funding programmes", "Domestic-foundry progress (China)", "India sovereign-compute tenders"],
    bestFor: "Macro & geopolitics-aware investors",
    riskTag: "Policy dependency · Geopolitical risk",
    groups: [
      {
        label: "US compute & cloud",
        names: [
          { symbol: "NVDA", role: "Global AI compute supplier" },
          { symbol: "AMD", role: "Accelerator challenger" },
          { symbol: "MSFT", role: "Hyperscale AI cloud" },
          { symbol: "GOOGL", role: "AI cloud + own silicon (TPU)" },
          { symbol: "ORCL", role: "Contracted AI cloud capacity", why: "Large contracted cloud demand for AI workloads", risk: "Debt / capex intensity", watch: "Remaining performance obligations, capex, FCF" },
          { symbol: "AMZN", role: "Hyperscale AI cloud + silicon" },
        ],
      },
      {
        label: "China domestic stack",
        names: [
          { symbol: "BABA", role: "China cloud & models" },
          { symbol: "BIDU", role: "China AI / search / models" },
          { symbol: "TCEHY", role: "China cloud & platform AI" },
          { symbol: "SMICY", role: "China domestic foundry proxy" },
        ],
      },
      {
        label: "India sovereign compute",
        names: [
          { symbol: "RELIANCE.NS", role: "India compute / Jio AI ambitions" },
          { symbol: "BHARTIARTL.NS", role: "India connectivity backbone" },
          { symbol: "TATACOMM.NS", role: "India data infrastructure" },
        ],
      },
    ],
    scenarios: [
      { kind: "Best case", what: "Governments keep funding domestic AI, cloud, chips and data centres across regions.", wins: "NVDA · cloud majors · domestic-stack names" },
      { kind: "Base case", what: "Funding continues but unevenly; export controls reshape who can buy what.", wins: "Region-specific leaders" },
      { kind: "Worst case", what: "Export controls, regulation, weak ROI and chip constraints slow the buildout.", wins: "Few; capex names de-rate" },
    ],
    checklist: [
      { question: "Is national AI funding still expanding?", why: "Policy is the demand driver here." },
      { question: "How exposed is the name to export controls?", why: "Controls can cut addressable market overnight." },
      { question: "Is domestic-foundry / sovereign-compute progress real?", why: "The substitution thesis depends on it." },
      { question: "Is AI ROI showing up in customer results?", why: "Weak ROI eventually slows capex." },
      { question: "Is the valuation pricing uninterrupted policy support?", why: "Policy can reverse." },
    ],
    scores: [
      { label: "Demand visibility", score: 6 },
      { label: "Valuation comfort", score: 4 },
      { label: "Policy tailwind", score: 7 },
      { label: "Balance-sheet strength", score: 7 },
      { label: "Policy-risk resilience", score: 3 },
    ],
    verdict: "Durable multi-region theme; outcomes hinge on policy as much as technology.",
    sources: ["Government AI strategy papers (US/China/India)", "Export-control announcements", "Company earnings calls"],
  },
  {
    id: "china-ev-shockwave",
    title: "China EV Shockwave",
    category: "China",
    tagline: "China is exporting the EV supply chain to the world",
    description:
      "Not just 'EVs' — this is China's manufacturing scale, battery dominance, domestic price war and export power, set against legacy automakers and the Indian auto-component chain.",
    whyNow:
      "The IEA estimates China accounted for ~70% of electric-car production and over 80% of battery-cell production in 2025. That scale is now being exported.",
    regions: ["China", "US", "India"],
    timeHorizon: "2–5 years",
    maturity: "Mid",
    valuationRisk: "Medium",
    bullCase: "China's EV and battery scale keeps lowering costs and pressuring global legacy automakers.",
    bearCase: "Tariffs, overcapacity and a domestic price war destroy margins across the chain.",
    watch: ["Tariff & trade policy", "Battery-cell pricing", "Domestic price-war intensity", "India EV-component demand"],
    bestFor: "Investors comfortable with cyclicality & policy risk",
    riskTag: "Overcapacity · Trade-policy risk",
    groups: [
      {
        label: "China EV & battery champions",
        names: [
          { symbol: "BYDDF", role: "Vertically integrated EV + battery leader" },
          { symbol: "1211.HK", role: "BYD (HK listing)" },
          { symbol: "300750.SZ", role: "CATL — battery-cell dominance" },
          { symbol: "LI", role: "China premium EV (range-extender)" },
          { symbol: "NIO", role: "China premium EV / battery-swap" },
          { symbol: "XPEV", role: "China EV / ADAS" },
        ],
      },
      {
        label: "Global incumbents under pressure",
        names: [
          { symbol: "TSLA", role: "Global EV benchmark" },
          { symbol: "GM", role: "Legacy automaker in transition" },
          { symbol: "F", role: "Legacy automaker in transition" },
        ],
      },
      {
        label: "India auto & components",
        names: [
          { symbol: "TATAMOTORS.NS", role: "India EV + JLR exposure" },
          { symbol: "M&M.NS", role: "India SUV & EV maker" },
          { symbol: "SONACOMS.NS", role: "India EV components" },
          { symbol: "EXIDEIND.NS", role: "India batteries / storage" },
          { symbol: "AMARAJABAT.NS", role: "India batteries / storage" },
        ],
      },
    ],
    scenarios: [
      { kind: "Best case", what: "China's EV and battery scale keeps lowering costs and pressuring legacy automakers globally.", wins: "BYDDF · 300750.SZ · India component makers" },
      { kind: "Base case", what: "Scale grows but a price war compresses margins; volume ≠ profit.", wins: "Lowest-cost, vertically-integrated players" },
      { kind: "Worst case", what: "Tariffs, overcapacity and the price war destroy margins across the chain.", wins: "Few; marginal players shake out" },
    ],
    checklist: [
      { question: "Is volume growth translating into profit?", why: "A price war can make volume worthless." },
      { question: "How intense is the domestic price war?", why: "It sets the margin floor for everyone." },
      { question: "What's the tariff / trade-policy exposure?", why: "Tariffs can close key export markets." },
      { question: "Is battery-cell pricing stabilising?", why: "Cell cost drives the whole chain's economics." },
      { question: "Are India component makers winning real content?", why: "Tests the India localisation angle." },
    ],
    scores: [
      { label: "Scale advantage", score: 8 },
      { label: "Valuation comfort", score: 6 },
      { label: "Margin trend", score: 4 },
      { label: "Balance-sheet strength", score: 6 },
      { label: "Trade-policy resilience", score: 4 },
    ],
    verdict: "Structural scale story with cyclical, policy-driven swings. Watch margins, not just volume.",
    sources: ["IEA — Global EV Outlook", "Company filings", "Trade-policy / tariff announcements"],
  },
  {
    id: "global-defence-rearmament",
    title: "Global Defence Re-Armament",
    category: "Defence",
    tagline: "The new military capex cycle",
    description:
      "Defence is a multi-year global capex theme: missiles, drones, shipbuilding, radar, space-defence, cyber and AI-enabled warfare — across US primes and India's defence-industrial base.",
    whyNow:
      "SIPRI reported world military expenditure reached ~$2.9 trillion in 2025, an 11th consecutive year of growth. Order books are lengthening.",
    regions: ["US", "China", "India", "Europe"],
    timeHorizon: "3–7 years",
    maturity: "Mid",
    valuationRisk: "Medium-high",
    bullCase: "Budgets stay elevated, order books expand, and defence-electronics, missile and drone names gain operating leverage.",
    bearCase: "Valuations run ahead of execution; receivables, program delays and margin pressure disappoint.",
    watch: ["Defence budget trends", "Order backlog & book-to-bill", "Execution / delivery delays", "Receivables & working capital (India)"],
    bestFor: "Investors seeking macro-resilient, policy-backed demand",
    riskTag: "Execution risk · Valuation has run",
    groups: [
      {
        label: "US primes & defence tech",
        names: [
          { symbol: "LMT", role: "US prime — missiles & aircraft" },
          { symbol: "RTX", role: "US prime — missiles & defence systems" },
          { symbol: "NOC", role: "US prime — space & strategic" },
          { symbol: "GD", role: "US prime — shipbuilding & land" },
          { symbol: "PLTR", role: "Defence/AI software & targeting" },
          { symbol: "AVAV", role: "Drones & unmanned systems" },
        ],
      },
      {
        label: "India defence-industrial base",
        names: [
          { symbol: "HAL.NS", role: "India aircraft & engines" },
          { symbol: "BEL.NS", role: "India defence electronics" },
          { symbol: "BDL.NS", role: "India missiles" },
          { symbol: "MAZDOCK.NS", role: "India shipbuilding" },
          { symbol: "COCHINSHIP.NS", role: "India shipbuilding" },
          { symbol: "ZENTEC.NS", role: "India defence electronics / simulation" },
        ],
      },
    ],
    scenarios: [
      { kind: "Best case", what: "Budgets stay elevated, order books expand and electronics/missile/drone names gain operating leverage.", wins: "India DPSUs · US primes · drones" },
      { kind: "Base case", what: "Budgets hold but execution and delivery lag the order book.", wins: "Best executors; cash-generative primes" },
      { kind: "Worst case", what: "Valuations run ahead of execution; receivables, delays and margins disappoint.", wins: "Few; richly-priced names correct" },
    ],
    checklist: [
      { question: "Are defence budgets still rising?", why: "Top-down demand driver." },
      { question: "Is the order backlog converting to revenue on time?", why: "Backlog only matters if it ships." },
      { question: "Are receivables and working capital healthy (India)?", why: "Cash conversion is the weak spot for DPSUs." },
      { question: "Is book-to-bill above 1?", why: "Shows demand outpacing deliveries." },
      { question: "Has the multiple already priced the cycle?", why: "Defence has re-rated a lot." },
    ],
    scores: [
      { label: "Order visibility", score: 8 },
      { label: "Valuation comfort", score: 4 },
      { label: "Momentum", score: 7 },
      { label: "Balance-sheet strength", score: 6 },
      { label: "Execution certainty", score: 5 },
    ],
    verdict: "Strong order-book visibility, but Indian names especially price in a lot. Mind execution.",
    sources: ["SIPRI — Trends in World Military Expenditure", "Government defence budgets", "Company order-book disclosures"],
  },
  {
    id: "physical-ai-robotics",
    title: "Physical AI & Robotics",
    category: "Hard Tech",
    tagline: "AI moving from screens into machines",
    description:
      "Bigger than self-driving cars: robotaxis, humanoid robots, warehouse automation, industrial robotics, surgical robots, drones and AI-enabled machines across the US, China, Japan and India.",
    whyNow:
      "Foundation-model progress is spilling into the physical world — robotics, automation and autonomy are where the next capability step is being demonstrated.",
    regions: ["US", "China", "Japan", "India"],
    timeHorizon: "3–10 years",
    maturity: "Early",
    valuationRisk: "High",
    bullCase: "AI moves into the physical world: factories, logistics, surgery, robotaxis and defence drones.",
    bearCase: "Hardware is harder than software; costs stay high, regulation delays adoption, and margins disappoint.",
    watch: ["Humanoid / robotaxi milestones", "Automation order trends", "Unit-economics of robots", "Regulatory approvals"],
    bestFor: "Long-horizon, high-risk thematic investors",
    riskTag: "Early-stage · High valuation · Execution risk",
    groups: [
      {
        label: "AI robotics platforms (US)",
        names: [
          { symbol: "TSLA", role: "Robotaxi + humanoid (Optimus)" },
          { symbol: "NVDA", role: "Robotics compute & simulation" },
          { symbol: "ISRG", role: "Surgical robotics leader" },
          { symbol: "SYM", role: "Warehouse automation" },
        ],
      },
      {
        label: "Industrial robotics (global)",
        names: [
          { symbol: "ABBNY", role: "Industrial robotics & automation" },
          { symbol: "FANUY", role: "Factory robotics (Japan)" },
          { symbol: "6861.T", role: "Sensors & factory automation (Keyence)" },
          { symbol: "6954.T", role: "Industrial robots (Fanuc, Japan)" },
        ],
      },
      {
        label: "China robotics & scale",
        names: [
          { symbol: "BYDDF", role: "EV + automation scale (China)" },
          { symbol: "1810.HK", role: "Xiaomi — robotics & EV (China)" },
        ],
      },
      {
        label: "India automation",
        names: [
          { symbol: "ABB.NS", role: "Automation & robotics (India)" },
          { symbol: "SIEMENS.NS", role: "Industrial automation (India)" },
          { symbol: "LT.NS", role: "Engineering & automation (India)" },
        ],
      },
    ],
    scenarios: [
      { kind: "Best case", what: "AI moves into the physical world — factories, logistics, surgery, robotaxis and drones.", wins: "NVDA · ISRG · automation leaders" },
      { kind: "Base case", what: "Adoption is real but slow; industrial automation compounds, humanoids stay early.", wins: "Proven industrial-robotics names" },
      { kind: "Worst case", what: "Hardware is hard; costs stay high, regulation delays adoption, margins disappoint.", wins: "Few; speculative names de-rate" },
    ],
    checklist: [
      { question: "Are humanoid / robotaxi milestones being hit?", why: "Tests the futuristic optionality." },
      { question: "Are automation orders growing?", why: "The near-term, real revenue line." },
      { question: "Do the robot unit economics work?", why: "Adoption needs payback to make sense." },
      { question: "Are regulators enabling or blocking deployment?", why: "Autonomy lives or dies on approval." },
      { question: "Is the valuation paying for hope or delivery?", why: "Early themes over-discount the future." },
    ],
    scores: [
      { label: "Revenue visibility", score: 4 },
      { label: "Valuation comfort", score: 3 },
      { label: "Momentum", score: 7 },
      { label: "Balance-sheet strength", score: 6 },
      { label: "Adoption certainty", score: 4 },
    ],
    verdict: "Big, futuristic, early. Treat as optionality, not core. Research starting point only.",
    sources: ["Company R&D disclosures & demos", "Industrial-automation order data", "Robotics market research"],
  },
  {
    id: "global-industrial-rebuild",
    title: "Global Industrial Rebuild",
    category: "Hard Tech",
    tagline: "Factories, grids, semicap, railways and hard assets are back",
    description:
      "Reindustrialisation, supply-chain localisation, grid capex, semiconductor equipment, defence manufacturing and India's capex cycle — the physical economy re-rating.",
    whyNow:
      "Localisation, energy transition and AI-driven grid demand are converging into a sustained capex up-cycle across developed and emerging markets.",
    regions: ["US", "China", "India"],
    timeHorizon: "3–7 years",
    maturity: "Mid",
    valuationRisk: "Medium-high",
    bullCase: "The world keeps spending on factories, grid upgrades, defence, semiconductor supply chains and infrastructure.",
    bearCase: "A global slowdown hits capex orders and high-expectation industrial names correct.",
    watch: ["Capex / order intake", "Grid & electrification spend", "Semicap bookings", "India infrastructure outlay"],
    bestFor: "Macro-cycle investors",
    riskTag: "Cyclical · Order-driven",
    groups: [
      {
        label: "Machinery & equipment",
        names: [
          { symbol: "CAT", role: "Construction & mining equipment" },
          { symbol: "DE", role: "Agriculture & construction machinery" },
          { symbol: "ETN", role: "Electrical & power management" },
          { symbol: "GEV", role: "Grid & power generation" },
        ],
      },
      {
        label: "Semiconductor equipment",
        names: [
          { symbol: "AMAT", role: "Semiconductor equipment" },
          { symbol: "LRCX", role: "Semiconductor equipment" },
        ],
      },
      {
        label: "Electrification (global)",
        names: [
          { symbol: "ABBNY", role: "Electrification & automation" },
          { symbol: "SIEGY", role: "Industrial & grid (Siemens)" },
        ],
      },
      {
        label: "India capex cycle",
        names: [
          { symbol: "LT.NS", role: "India engineering & infra leader" },
          { symbol: "CUMMINSIND.NS", role: "Power & industrial (India)" },
          { symbol: "CGPOWER.NS", role: "Electrical equipment (India)" },
          { symbol: "THERMAX.NS", role: "Energy & environment (India)" },
          { symbol: "BHEL.NS", role: "Power equipment (India)" },
        ],
      },
    ],
    scenarios: [
      { kind: "Best case", what: "The world keeps spending on factories, grids, defence and semiconductor supply chains.", wins: "ETN · GEV · semicap · India capex" },
      { kind: "Base case", what: "Capex grows but unevenly across regions and end-markets.", wins: "Diversified, well-run industrials" },
      { kind: "Worst case", what: "A global slowdown hits capex orders and high-expectation names correct.", wins: "Few; cyclicals de-rate" },
    ],
    checklist: [
      { question: "Is order intake / capex still growing?", why: "The cycle's pulse." },
      { question: "Is grid & electrification spend accelerating?", why: "Structural, AI-linked demand." },
      { question: "Are semicap bookings rising?", why: "Leading indicator for the chip build." },
      { question: "Is India's infrastructure outlay being delivered?", why: "India capex is a key leg." },
      { question: "Is the entry multiple cycle-aware?", why: "Industrials are cyclical; multiples matter." },
    ],
    scores: [
      { label: "Order visibility", score: 6 },
      { label: "Valuation comfort", score: 5 },
      { label: "Momentum", score: 6 },
      { label: "Balance-sheet strength", score: 7 },
      { label: "Cycle resilience", score: 4 },
    ],
    verdict: "Serious macro-equity theme; returns track the capex cycle. Mind the entry multiple.",
    sources: ["Company order-book data", "Government infrastructure budgets", "Semicap bookings data"],
  },
  {
    id: "battery-storage-beyond-evs",
    title: "Battery Storage Beyond EVs",
    category: "AI & Power",
    tagline: "The next battery boom may come from grids and AI data centres",
    description:
      "EV demand is only one part of the battery story. Grid storage, renewable balancing and AI/data-centre backup power are becoming major demand drivers in their own right.",
    whyNow:
      "Reuters has reported lithium producers increasingly betting on stationary battery-storage demand beyond EVs — a second growth curve for cells.",
    regions: ["China", "US", "India"],
    timeHorizon: "3–7 years",
    maturity: "Early-mid",
    valuationRisk: "Medium",
    bullCase: "Grid-storage demand offsets EV cyclicality and creates a second battery growth curve.",
    bearCase: "Battery oversupply, lithium-price weakness and poor project economics hurt returns.",
    watch: ["Grid-storage deployments", "Lithium & cell pricing", "Project IRRs", "Data-centre backup demand"],
    bestFor: "Energy-transition investors",
    riskTag: "Commodity · Oversupply risk",
    groups: [
      {
        label: "Storage integrators & inverters",
        names: [
          { symbol: "TSLA", role: "Megapack grid storage + EV" },
          { symbol: "FLNC", role: "Grid-scale storage integrator" },
          { symbol: "ENPH", role: "Residential storage & solar" },
          { symbol: "SEDG", role: "Solar + storage inverters" },
        ],
      },
      {
        label: "Cells & lithium",
        names: [
          { symbol: "ALB", role: "Lithium producer" },
          { symbol: "BYDDF", role: "Battery + EV scale (China)" },
          { symbol: "300750.SZ", role: "CATL — cells for EV & storage" },
        ],
      },
      {
        label: "India power & batteries",
        names: [
          { symbol: "TATAPOWER.NS", role: "India renewables & storage" },
          { symbol: "JSWENERGY.NS", role: "India power & storage" },
          { symbol: "EXIDEIND.NS", role: "India batteries / cell ambitions" },
          { symbol: "AMARAJABAT.NS", role: "India batteries / storage" },
        ],
      },
    ],
    scenarios: [
      { kind: "Best case", what: "Grid-storage demand offsets EV cyclicality and creates a second battery growth curve.", wins: "FLNC · TSLA storage · cell makers" },
      { kind: "Base case", what: "Storage grows steadily but project economics vary; selectivity matters.", wins: "Lowest-cost integrators" },
      { kind: "Worst case", what: "Battery oversupply, weak lithium prices and poor project IRRs hurt returns.", wins: "Few; lithium names de-rate" },
    ],
    checklist: [
      { question: "Are grid-storage deployments accelerating?", why: "The new demand driver beyond EVs." },
      { question: "What are project IRRs at current prices?", why: "Storage only scales if it pays." },
      { question: "Is cell / lithium pricing stabilising?", why: "Commodity swings drive the basket." },
      { question: "Is data-centre backup demand emerging?", why: "A potential new pull on storage." },
      { question: "Is there oversupply risk in cells?", why: "Oversupply crushes margins." },
    ],
    scores: [
      { label: "Demand visibility", score: 5 },
      { label: "Valuation comfort", score: 5 },
      { label: "Momentum", score: 5 },
      { label: "Balance-sheet strength", score: 5 },
      { label: "Commodity resilience", score: 4 },
    ],
    verdict: "More nuanced than 'EV stocks' — a real second demand curve, but commodity-exposed.",
    sources: ["Reuters — lithium / storage demand coverage", "IEA storage data", "Company project pipelines"],
  },
  {
    id: "glp1-health-repricing",
    title: "GLP-1 Health Repricing",
    category: "Healthcare",
    tagline: "Weight-loss drugs are changing healthcare, food, fitness and insurance",
    description:
      "GLP-1 adoption ripples across pharma, medtech, diagnostics, food, insurers, hospitals and consumer behaviour — a rare theme that reprices multiple sectors at once.",
    whyNow:
      "Obesity/diabetes treatment is scaling into one of the largest drug markets ever, with second-order effects only beginning to be priced across adjacent industries.",
    regions: ["US", "Europe", "China", "India"],
    timeHorizon: "3–7 years",
    maturity: "Mid",
    valuationRisk: "Medium-high",
    bullCase: "GLP-1 adoption expands globally and creates a long-term obesity/diabetes treatment market.",
    bearCase: "Pricing pressure, competition, side-effects or supply constraints reduce expected profits.",
    watch: ["Trial readouts & approvals", "Manufacturing/supply capacity", "Pricing & reimbursement", "Generic & biosimilar competition (India)"],
    bestFor: "Healthcare & cross-sector investors",
    riskTag: "Pricing · Competition risk",
    groups: [
      {
        label: "GLP-1 leaders",
        names: [
          { symbol: "LLY", role: "GLP-1 leader (tirzepatide)" },
          { symbol: "NVO", role: "GLP-1 leader (semaglutide)" },
        ],
      },
      {
        label: "Devices & diagnostics",
        names: [
          { symbol: "ABT", role: "Diagnostics & devices" },
          { symbol: "DXCM", role: "Continuous glucose monitoring" },
          { symbol: "ISRG", role: "Surgical robotics (procedure-mix shift)" },
        ],
      },
      {
        label: "Distribution & diversified pharma",
        names: [
          { symbol: "MCK", role: "Drug distribution" },
          { symbol: "AZN", role: "Diversified pharma + obesity pipeline" },
        ],
      },
      {
        label: "India pharma & CDMO",
        names: [
          { symbol: "SUNPHARMA.NS", role: "India pharma major" },
          { symbol: "DRREDDY.NS", role: "India generics & biosimilars" },
          { symbol: "CIPLA.NS", role: "India pharma" },
          { symbol: "BIOCON.NS", role: "India biosimilars" },
          { symbol: "SYNGENE.NS", role: "India CRO/CDMO" },
          { symbol: "DIVISLAB.NS", role: "India API / CDMO" },
        ],
      },
    ],
    scenarios: [
      { kind: "Best case", what: "GLP-1 adoption expands globally; a durable obesity/diabetes market reprices adjacent sectors.", wins: "LLY · NVO · diagnostics · India CDMO" },
      { kind: "Base case", what: "Adoption grows but competition and pricing pressure cap profits; adjacencies mixed.", wins: "Cost leaders; picks-and-shovels" },
      { kind: "Worst case", what: "Pricing pressure, side-effects or competition reduce expected profits.", wins: "Few; leaders de-rate from high bars" },
    ],
    checklist: [
      { question: "Are trial readouts / approvals expanding the market?", why: "New indications grow the TAM." },
      { question: "Is manufacturing capacity keeping up?", why: "Supply has been the constraint." },
      { question: "How is pricing / reimbursement trending?", why: "Sets the profit ceiling." },
      { question: "Is competition (incl. oral GLP-1s) intensifying?", why: "Erodes leader economics." },
      { question: "Are India CDMOs / generics winning share?", why: "The India angle on the theme." },
    ],
    scores: [
      { label: "Revenue visibility", score: 7 },
      { label: "Valuation comfort", score: 4 },
      { label: "Momentum", score: 6 },
      { label: "Balance-sheet strength", score: 7 },
      { label: "Competitive durability", score: 6 },
    ],
    verdict: "Fresh, global, multi-sector. The leaders are priced for success; adjacencies less so.",
    sources: ["Company trial data & FDA filings", "Sell-side obesity market models", "Healthcare earnings calls"],
  },
  {
    id: "market-toll-booths",
    title: "Market Toll Booths",
    category: "Financialisation",
    tagline: "Global exchanges, data, depositories and payment rails — plus India's financialisation",
    description:
      "Toll-booth businesses: exchanges, depositories, index providers, rating agencies, payment networks and asset managers that earn recurring fees as activity grows. Includes India's financialisation sub-theme — households shifting from cash, gold and property into funds, equities and insurance.",
    whyNow:
      "More trading, more ETFs, more SIPs and more data usage compound recurring revenue — a quieter, higher-quality way to play financialisation, with India adding a long structural growth leg.",
    regions: ["US", "China/HK", "India"],
    timeHorizon: "3–10 years",
    maturity: "Mature",
    valuationRisk: "Medium-high",
    bullCase: "More trading, ETFs, SIPs, insurance and data usage increase recurring revenue at high incremental margins.",
    bearCase: "Regulation, fee compression, market downturns and lower trading activity hurt growth.",
    watch: ["Volumes & data subscriptions", "Fee/regulatory pressure", "SIP, demat & insurance growth (India)", "Index/ratings demand"],
    bestFor: "Quality-compounder investors",
    riskTag: "Fee-compression · Regulatory risk",
    groups: [
      {
        label: "US financial infrastructure",
        names: [
          { symbol: "CME", role: "Derivatives exchange", tag: "Direct" },
          { symbol: "ICE", role: "Exchanges & data", tag: "Direct" },
          { symbol: "NDAQ", role: "Exchange & market tech", tag: "Direct" },
          { symbol: "BLK", role: "Asset manager (ETF/iShares scale)", tag: "Indirect" },
          { symbol: "SCHW", role: "Brokerage & custody", tag: "Indirect" },
        ],
      },
      {
        label: "Data, index & rating agencies",
        names: [
          { symbol: "MSCI", role: "Index & analytics", tag: "Direct" },
          { symbol: "SPGI", role: "Ratings, indices & data", tag: "Direct" },
          { symbol: "MCO", role: "Credit ratings & analytics", tag: "Direct" },
        ],
      },
      {
        label: "Payment networks",
        names: [
          { symbol: "V", role: "Payment network", tag: "Direct" },
          { symbol: "MA", role: "Payment network", tag: "Direct" },
        ],
      },
      {
        label: "Asia / HK access",
        names: [{ symbol: "HKXCY", role: "HK exchange (China access)", tag: "Direct" }],
      },
      {
        label: "India financialisation",
        note: "Households moving from cash, gold and property into financial assets.",
        names: [
          { symbol: "BSE.NS", role: "India exchange", tag: "Direct" },
          { symbol: "CDSL.NS", role: "India depository", tag: "Direct" },
          { symbol: "CAMS.NS", role: "India MF registrar / RTA", tag: "Direct" },
          { symbol: "KFINTECH.NS", role: "India registrar / RTA", tag: "Direct" },
          { symbol: "HDFCAMC.NS", role: "India asset manager", tag: "Direct" },
          { symbol: "NAM-INDIA.NS", role: "India asset manager", tag: "Direct" },
          { symbol: "ANGELONE.NS", role: "India discount broker", tag: "Indirect" },
          { symbol: "ICICIGI.NS", role: "India general insurer", tag: "Indirect" },
          { symbol: "SBILIFE.NS", role: "India life insurer", tag: "Indirect" },
          { symbol: "HDFCLIFE.NS", role: "India life insurer", tag: "Indirect" },
        ],
      },
    ],
    scenarios: [
      { kind: "Best case", what: "More trading, ETFs, SIPs, insurance and data usage compound recurring, high-margin revenue.", wins: "MSCI · SPGI · V/MA · India RTAs & AMCs" },
      { kind: "Base case", what: "Steady recurring growth, occasional fee pressure; quality compounds quietly.", wins: "Diversified data, index & plumbing names" },
      { kind: "Worst case", what: "Regulation, fee compression and a downturn cut volumes and growth.", wins: "Few; high-multiple names de-rate" },
    ],
    checklist: [
      { question: "Are volumes & data subscriptions growing?", why: "The recurring-revenue engine." },
      { question: "Is there fee-compression or regulatory pressure?", why: "The main structural risk." },
      { question: "Are SIP / demat counts still rising (India)?", why: "India financialisation tailwind." },
      { question: "How cyclical is the revenue mix?", why: "Some toll-booths are volume-cyclical." },
      { question: "Is the quality already fully priced?", why: "Great businesses, rarely cheap." },
    ],
    scores: [
      { label: "Revenue durability", score: 8 },
      { label: "Valuation comfort", score: 4 },
      { label: "Momentum", score: 6 },
      { label: "Balance-sheet strength", score: 8 },
      { label: "Regulatory resilience", score: 6 },
    ],
    verdict: "High-quality 'boring compounders' — recurring and defensive, but rarely cheap.",
    sources: ["Exchange volume disclosures", "Company annual reports", "Regulatory fee filings"],
  },
  {
    id: "great-company-dangerous-price",
    title: "Great Company, Dangerous Price",
    category: "Valuation",
    tagline: "When the business is excellent but the valuation may already know it",
    description:
      "A study of wonderful businesses whose valuations may already price perfection — the difference between a great company and a great investment.",
    whyNow:
      "After a strong run in quality and AI winners, several best-in-class businesses trade at multiples that leave little room for disappointment.",
    regions: ["US", "China", "India"],
    timeHorizon: "1–3 years",
    maturity: "Mature",
    valuationRisk: "Very high",
    bullCase: "The company keeps compounding fast enough to grow into — and justify — the valuation.",
    bearCase: "The business performs well, but the stock disappoints because expectations were already too high.",
    watch: ["Forward multiple vs growth", "Estimate revisions", "Margin trajectory", "What's priced in vs delivered"],
    bestFor: "Valuation-disciplined investors",
    riskTag: "High valuation · Expectations risk",
    groups: [
      {
        label: "US quality at a price",
        names: [
          { symbol: "NVDA", role: "AI leader, priced for dominance" },
          { symbol: "COST", role: "Best-in-class retail, premium multiple" },
          { symbol: "LLY", role: "GLP-1 leader, priced for success" },
          { symbol: "TSLA", role: "Auto + AI optionality at a high multiple" },
        ],
      },
      {
        label: "China quality, policy overhang",
        names: [
          { symbol: "BYDDF", role: "EV scale leader, cyclicality risk" },
          { symbol: "TCEHY", role: "China platform quality, policy overhang" },
        ],
      },
      {
        label: "India premium compounders",
        names: [
          { symbol: "TRENT.NS", role: "India retail compounder, rich multiple" },
          { symbol: "TITAN.NS", role: "India consumer quality, premium price" },
          { symbol: "HAL.NS", role: "India defence, valuation has run" },
          { symbol: "ETERNAL.NS", role: "India internet (Eternal/Zomato), profitability inflection priced" },
          { symbol: "DIXON.NS", role: "India EMS, very high multiple" },
        ],
      },
    ],
    scenarios: [
      { kind: "Best case", what: "The company compounds fast enough to grow into — and justify — the valuation.", wins: "The genuine super-compounders" },
      { kind: "Base case", what: "Solid results, but the multiple slowly de-rates; returns lag the business.", wins: "Patience; reinvestment compounding" },
      { kind: "Worst case", what: "Good business, disappointing stock as too-high expectations reset.", wins: "Few; the most-priced names fall hardest" },
    ],
    checklist: [
      { question: "Is the forward multiple justified by durable growth?", why: "Price must be earned by growth." },
      { question: "Are estimates being revised up or down?", why: "Momentum in expectations matters." },
      { question: "How much is already priced in?", why: "The core question of the theme." },
      { question: "Is the margin trajectory still improving?", why: "Supports a premium multiple." },
      { question: "What return do you get if growth merely meets expectations?", why: "Tests the margin of safety." },
    ],
    scores: [
      { label: "Business quality", score: 8 },
      { label: "Valuation comfort", score: 2 },
      { label: "Momentum", score: 7 },
      { label: "Balance-sheet strength", score: 7 },
      { label: "Expectations safety", score: 4 },
    ],
    verdict: "Excellent businesses, demanding prices. A lesson in not confusing the two.",
    sources: ["Forward estimates vs valuation", "Company filings", "Historical multiple bands"],
  },
  {
    id: "post-hype-ipo-survivors",
    title: "Post-Hype IPO Survivors",
    category: "Post-IPO",
    tagline: "Which IPO stories became real businesses after the hype faded?",
    description:
      "Many IPOs from the 2020–2026 cycle were priced on narrative, growth and scarcity value. Now the market is separating companies that are converting scale into cash flow from those still relying on dilution, hype or future optionality.",
    whyNow:
      "After the IPO boom de-rated, investors are revisiting former high-growth listings with colder eyes. Some have improved margins and free cash flow, while others still burn cash or dilute shareholders. New mega-IPOs like SpaceX also reset the question: is the public market buying real economics or just scarcity and narrative?",
    regions: ["US", "China", "India"],
    timeHorizon: "1–3 years",
    maturity: "Mid",
    valuationRisk: "Medium-high",
    bullCase:
      "The market overreacted after the hype faded. A few names are now maturing into cash-generative businesses, and valuation resets create room for fundamental upside.",
    bearCase:
      "Revenue growth slows, dilution continues, insiders sell, and the IPO story never becomes durable earnings.",
    watch: [
      "Free cash flow after capex",
      "Share-count dilution",
      "Stock-based compensation",
      "Gross-margin improvement",
      "Insider selling and lock-up expiry",
      "Path to durable profitability",
      "Whether valuation has actually reset enough",
    ],
    bestFor: "Bottom-up, contrarian investors",
    riskTag: "Dilution · Cash-burn · Narrative valuation · Re-rating risk",
    groups: [
      {
        label: "Fresh IPO / still too early",
        note: "Newly public — public-market discipline not yet tested.",
        names: [
          { symbol: "SPCX", role: "Space leader, newly public", why: "Dominant launch + Starlink franchise", risk: "Valuation and public-market discipline still untested", watch: "Lock-ups, Starlink margins, cadence" },
          { symbol: "ARM", role: "Chip-IP leader, premium valuation", why: "Royalty model with broad reach", risk: "Expectations are high", watch: "Royalty growth, AI/datacentre design wins" },
          { symbol: "RDDT", role: "Social platform + AI-data licensing optionality", why: "Monetisation and data-licensing upside", risk: "Profitability inflection still to prove", watch: "ARPU, ad load, data-licensing deals" },
          { symbol: "CART", role: "Grocery delivery (Instacart)", why: "Profitable advertising layer on delivery", risk: "Growth durability + competition", watch: "Order growth, ad revenue, margins" },
        ],
      },
      {
        label: "Maturing post-hype survivors",
        note: "Hype faded, economics now improving.",
        names: [
          { symbol: "HOOD", role: "Brokerage & financial platform", why: "Now more mature and profitable", risk: "Cyclically tied to trading activity", watch: "ARPU, funded accounts, product mix" },
          { symbol: "COIN", role: "Crypto exchange", why: "Highly profitable in strong cycles", risk: "Earnings quality is crypto-cycle dependent", watch: "Volumes, take-rate, subscription revenue" },
          { symbol: "ETERNAL.NS", role: "India food delivery + quick commerce (Eternal/Zomato)", why: "Now about Blinkit economics, not the old Zomato IPO story", risk: "Quick-commerce burn vs path to profit", watch: "Blinkit margins, GOV growth" },
          { symbol: "POLICYBZR.NS", role: "India insurance marketplace", why: "Operating leverage improving", risk: "Renewal economics + take-rate", watch: "Operating leverage, renewal mix" },
        ],
      },
      {
        label: "Still in prove-it stage",
        note: "Business model not yet self-funding.",
        names: [
          { symbol: "RIVN", role: "EV maker", why: "Scale and product are real", risk: "Cash burn, gross margin, balance sheet", watch: "Gross margin, cash runway, volume" },
          { symbol: "PAYTM.NS", role: "India fintech turnaround", why: "Large user base, monetisation re-set", risk: "Regulation + profitability quality", watch: "Take-rate, regulatory clarity, EBITDA" },
          { symbol: "NYKAA.NS", role: "India beauty/commerce platform", why: "Brand + commerce franchise", risk: "Growth vs margin pressure", watch: "GMV growth, contribution margin" },
          { symbol: "DELHIVERY.NS", role: "India logistics platform", why: "Network scale in logistics", risk: "Operating leverage + cash conversion", watch: "Volume, unit economics, FCF" },
        ],
      },
      {
        label: "Valuation discipline cases",
        note: "Quality businesses, but the debate is price, not survival.",
        names: [
          { symbol: "CAVA", role: "Restaurant growth story — quality IPO, valuation-discipline case", why: "Strong unit economics and growth", risk: "Valuation, not survival, is the question", watch: "Unit growth, same-store sales, multiple" },
          { symbol: "ARM", role: "Chip-IP leader — premium multiple" },
          { symbol: "RDDT", role: "Social platform — profitability inflection priced in" },
        ],
      },
    ],
    scenarios: [
      { kind: "Best case", what: "The market overreacted after hype faded. Margins improve, free cash flow turns positive and multiples stabilise.", wins: "HOOD · ETERNAL.NS · POLICYBZR.NS · profitable platforms" },
      { kind: "Base case", what: "Only a few names mature; others stay volatile and need more proof.", wins: "Stock-picking over theme exposure" },
      { kind: "Worst case", what: "Growth slows, dilution continues, insiders sell, and the IPO story never becomes durable earnings.", wins: "Cash-burning names de-rate further" },
    ],
    checklist: [
      { question: "Is revenue still growing after the IPO hype faded?", why: "Proves demand is durable." },
      { question: "Is gross margin improving?", why: "Shows real scale economics." },
      { question: "Is operating cash flow positive?", why: "Separates businesses from stories." },
      { question: "Is free cash flow positive after capex?", why: "Shows it can self-fund." },
      { question: "Is the share count rising?", why: "Dilution can quietly destroy returns." },
      { question: "Is stock-based compensation high?", why: "Hidden dilution risk." },
      { question: "Are insiders selling post-lock-up?", why: "Useful signal on conviction." },
      { question: "Has the valuation reset enough?", why: "A good business can still be a bad price." },
    ],
    scores: [
      { label: "Business-model proof", score: 6 },
      { label: "Profitability quality", score: 5 },
      { label: "Free-cash-flow visibility", score: 5 },
      { label: "Dilution discipline", score: 6 },
      { label: "Valuation reset", score: 7 },
    ],
    verdict:
      "A survivorship screen, not a momentum chase. The goal is to identify which IPOs moved from story to self-funding business — and which are still surviving on narrative, dilution or market cycles.",
    sources: [
      "IPO prospectuses and S-1 filings",
      "Quarterly filings and shareholder letters",
      "Cash-flow statements",
      "Share-count history",
      "Stock-based compensation disclosures",
      "Insider and lock-up data",
      "Segment-level margin trends",
    ],
  },
  {
    id: "critical-minerals",
    title: "Critical Minerals & Resource Security",
    category: "Hard Tech",
    tagline: "Copper, uranium, lithium, rare earths and the new supply-chain race",
    description:
      "The hard-asset backbone of AI power, EVs, defence and batteries — and the geopolitics of reducing China dependency across critical minerals.",
    whyNow:
      "Electrification, defence and data-centre buildouts are lifting demand for scarce resources at the same time supply chains are being re-shored.",
    regions: ["US", "China", "India", "Canada/Australia"],
    timeHorizon: "3–10 years",
    maturity: "Early-mid",
    valuationRisk: "Medium",
    bullCase: "Electrification, defence and data-centre buildouts increase demand for scarce resources.",
    bearCase: "Commodity prices fall, China overcapacity pressures margins, or global growth slows.",
    watch: ["Copper / uranium / lithium prices", "China supply policy", "New mine timelines", "Strategic-stockpiling policy"],
    bestFor: "Hard-asset & macro investors",
    riskTag: "Commodity-price · Geopolitical risk",
    groups: [
      {
        label: "Copper & diversified miners",
        names: [
          { symbol: "FCX", role: "Copper major" },
          { symbol: "SCCO", role: "Copper producer" },
          { symbol: "TECK", role: "Diversified metals" },
          { symbol: "BHP", role: "Diversified mining major" },
          { symbol: "RIO", role: "Diversified mining major" },
        ],
      },
      {
        label: "Lithium & rare earths",
        names: [
          { symbol: "ALB", role: "Lithium producer" },
          { symbol: "SQM", role: "Lithium producer" },
          { symbol: "MP", role: "Rare earths (US)" },
        ],
      },
      {
        label: "Uranium",
        names: [
          { symbol: "CCJ", role: "Uranium producer" },
          { symbol: "NXE", role: "Uranium developer" },
        ],
      },
      {
        label: "India minerals",
        names: [
          { symbol: "HINDCOPPER.NS", role: "India copper" },
          { symbol: "NMDC.NS", role: "India iron ore / minerals" },
          { symbol: "GMDC.NS", role: "India minerals" },
        ],
      },
    ],
    scenarios: [
      { kind: "Best case", what: "Electrification, defence and data-centre buildouts lift demand for scarce resources.", wins: "Copper majors · uranium · rare earths" },
      { kind: "Base case", what: "Demand grows but commodity prices swing; selectivity and cost curve matter.", wins: "Low-cost producers" },
      { kind: "Worst case", what: "Commodity prices fall, China overcapacity pressures margins, growth slows.", wins: "Few; high-cost producers squeezed" },
    ],
    checklist: [
      { question: "Is end-demand (grid, EV, defence) accelerating?", why: "The structural pull." },
      { question: "Where is the producer on the cost curve?", why: "Low-cost survives downturns." },
      { question: "What's the China supply / overcapacity risk?", why: "China dominates several minerals." },
      { question: "Are new mine timelines realistic?", why: "Supply response shapes prices." },
      { question: "Is the commodity price near peak or trough?", why: "Entry point drives returns." },
    ],
    scores: [
      { label: "Demand visibility", score: 5 },
      { label: "Valuation comfort", score: 6 },
      { label: "Momentum", score: 5 },
      { label: "Balance-sheet strength", score: 6 },
      { label: "Commodity resilience", score: 4 },
    ],
    verdict: "Hard-asset / geopolitics angle on the AI-and-electrification build. Commodity-cyclical.",
    sources: ["Commodity price data", "Company production reports", "Government critical-minerals strategies"],
  },
  {
    id: "internet-2-0",
    title: "Internet 2.0: Agents, Superapps & Quick Commerce",
    category: "India",
    tagline: "AI agents, superapps, quick commerce and embedded finance",
    description:
      "Connects US platforms, Chinese superapps and Indian consumer internet as AI improves ads, commerce conversion, logistics, personalisation and embedded finance.",
    whyNow:
      "AI agents and quick commerce are reshaping how consumers transact, while Indian internet names cross into durable profitability.",
    regions: ["US", "China", "India"],
    timeHorizon: "2–5 years",
    maturity: "Mid",
    valuationRisk: "High",
    bullCase: "AI improves productivity, ads, commerce conversion, logistics and personalisation across platforms.",
    bearCase: "Competition, regulation, high customer-acquisition costs and margin pressure weaken the model.",
    watch: ["Take-rate & ad pricing", "Quick-commerce unit economics", "Regulation", "AI-agent monetisation"],
    bestFor: "Consumer-internet investors",
    riskTag: "Competition · Regulation risk",
    groups: [
      {
        label: "US platforms & agents",
        names: [
          { symbol: "META", role: "Ads + AI agents" },
          { symbol: "GOOGL", role: "Search, ads, AI" },
          { symbol: "AMZN", role: "Commerce + cloud + ads" },
          { symbol: "SHOP", role: "Commerce platform" },
          { symbol: "UBER", role: "Mobility + delivery" },
          { symbol: "DASH", role: "Local delivery" },
        ],
      },
      {
        label: "China superapps & commerce",
        names: [
          { symbol: "BABA", role: "China commerce & cloud" },
          { symbol: "TCEHY", role: "China superapp & gaming" },
          { symbol: "PDD", role: "China discount commerce" },
          { symbol: "JD", role: "China commerce & logistics" },
          { symbol: "3690.HK", role: "Meituan — China local services" },
        ],
      },
      {
        label: "India consumer internet",
        names: [
          { symbol: "ETERNAL.NS", role: "India food + quick commerce (Eternal/Zomato)" },
          { symbol: "SWIGGY.NS", role: "India food + quick commerce" },
          { symbol: "PAYTM.NS", role: "India fintech / payments" },
          { symbol: "NYKAA.NS", role: "India beauty commerce" },
          { symbol: "POLICYBZR.NS", role: "India insurance marketplace" },
          { symbol: "NAUKRI.NS", role: "India internet classifieds (Info Edge)" },
        ],
      },
    ],
    scenarios: [
      { kind: "Best case", what: "AI lifts ads, commerce conversion, logistics and personalisation across platforms.", wins: "META · GOOGL · quick-commerce winners" },
      { kind: "Base case", what: "Growth continues but competition and CAC pressure margins unevenly.", wins: "Scale platforms with pricing power" },
      { kind: "Worst case", what: "Competition, regulation and high acquisition costs weaken the model.", wins: "Few; unprofitable names de-rate" },
    ],
    checklist: [
      { question: "Is take-rate / ad pricing holding?", why: "Core monetisation lever." },
      { question: "Do quick-commerce unit economics work?", why: "The swing factor for India internet." },
      { question: "How heavy is regulatory exposure?", why: "Platforms face rising regulation." },
      { question: "Is AI-agent monetisation real yet?", why: "Tests the 'Internet 2.0' premise." },
      { question: "Is customer-acquisition cost rising?", why: "CAC erodes platform margins." },
    ],
    scores: [
      { label: "Revenue visibility", score: 6 },
      { label: "Valuation comfort", score: 4 },
      { label: "Momentum", score: 7 },
      { label: "Balance-sheet strength", score: 6 },
      { label: "Regulation resilience", score: 5 },
    ],
    verdict: "Broad consumer-internet + AI theme; quick-commerce economics are the swing factor.",
    sources: ["Platform earnings calls", "Quick-commerce unit-economics disclosures", "Company filings"],
  },
];

// Dashboard layer — keyed by idea id so the rich research-note objects above stay
// readable. The map below merges these in. redFlags are [best, base, worst].
interface DashboardExtra {
  question: string;
  themeWeather: string;
  swingFactor: string;
  themeMap: ThemeMapLink[];
  bullRoad: string[];
  bearRoad: string[];
  proves: string[];
  breaks: string[];
  redFlags: [string, string, string];
}

const DASHBOARD: Record<string, DashboardExtra> = {
  "ai-power-bottleneck": {
    question: "Can the power, cooling and grid chain keep up with — and get paid for — AI's electricity demand?",
    themeWeather: "Hot — capex-driven, priced for growth",
    swingFactor: "Whether power becomes scarce enough to give the grid & cooling chain real pricing power.",
    themeMap: [
      { layer: "AI demand layer", symbols: ["NVDA", "AVGO"] },
      { layer: "Data-centre network layer", symbols: ["ANET", "EQIX", "DLR"] },
      { layer: "Physical bottleneck layer", symbols: ["VRT", "ETN", "GEV"] },
      { layer: "India grid / power layer", symbols: ["ABB.NS", "SIEMENS.NS", "TATAPOWER.NS", "POWERGRID.NS"] },
    ],
    bullRoad: ["AI capex keeps rising", "power & cooling go scarce", "backlogs & pricing firm", "margins expand", "infra names re-rate"],
    bearRoad: ["AI ROI disappoints", "hyperscalers cut capex", "orders slow", "margins compress", "the basket de-rates"],
    proves: ["Capex guidance keeps rising", "Power/cooling backlogs grow", "Gross margins hold as they scale", "Grid bottlenecks lift pricing", "Data-centre vacancy stays tight"],
    breaks: ["Hyperscalers cut capex guidance", "Backlogs stall or cancel", "Margins compress on competition", "Cheaper/efficient compute cuts power need", "Rates re-rate long-duration infra down"],
    redFlags: ["Orders grow but margins fail to expand", "Margin slippage as volumes scale", "Capex-guidance cuts / order cancellations"],
  },
  "spacex-orbital-internet": {
    question: "Is space becoming real infrastructure, or still a capital-hungry promise?",
    themeWeather: "Early & speculative — scarcity premium",
    swingFactor: "Whether Starlink margins and launch cadence scale before the cash runs.",
    themeMap: [
      { layer: "Launch", symbols: ["SPCX", "RKLB"] },
      { layer: "Broadband & comms", symbols: ["SPCX", "ASTS", "IRDM"] },
      { layer: "Observation & data", symbols: ["PL"] },
      { layer: "Defence-space primes", symbols: ["LHX", "NOC", "LMT"] },
      { layer: "India space-industrial", symbols: ["HAL.NS", "BEL.NS", "MTARTECH.NS"] },
    ],
    bullRoad: ["Launch cadence rises", "Starlink subs & margins scale", "defence-space orders grow", "cash flow turns", "the basket re-rates"],
    bearRoad: ["Launch delays mount", "Starlink margins stay thin", "cash burn persists", "dilution / funding rounds", "valuations de-rate"],
    proves: ["Launch cadence rises on schedule", "Starlink subs & ARPU grow profitably", "Defence-space awards expand", "Cash burn funded to milestones", "Indian space orders scale"],
    breaks: ["Repeated launch delays", "Starlink margins disappoint", "Funding gaps force dilution", "Valuation runs ahead of delivery", "Mission failures hit confidence"],
    redFlags: ["Launch cadence rises but Starlink margins don't improve", "Timeline slippage on key vehicles", "Funding gaps / mission failures"],
  },
  "sovereign-ai-stacks": {
    question: "Will governments keep funding domestic AI fast enough to matter — despite export controls?",
    themeWeather: "Warm — policy-fuelled, uneven",
    swingFactor: "Whether AI ROI shows up before policy or chip constraints bite.",
    themeMap: [
      { layer: "Chips & foundry", symbols: ["NVDA", "AMD", "SMICY"] },
      { layer: "Cloud capacity", symbols: ["MSFT", "GOOGL", "ORCL", "AMZN", "BABA", "TCEHY"] },
      { layer: "Models & platforms", symbols: ["GOOGL", "BIDU", "BABA"] },
      { layer: "India sovereign stack", symbols: ["RELIANCE.NS", "BHARTIARTL.NS", "TATACOMM.NS"] },
    ],
    bullRoad: ["Governments fund domestic AI", "cloud & chip demand rises", "domestic stacks scale", "ROI improves", "leaders re-rate"],
    bearRoad: ["Export controls tighten", "chip access narrows", "ROI disappoints", "funding slows", "capex names de-rate"],
    proves: ["National AI funding expands", "Domestic-compute progress is real", "AI ROI shows in customer results", "Cloud capacity stays sold out", "India sovereign tenders land"],
    breaks: ["Export controls cut addressable market", "Weak ROI slows capex", "Regulation stalls deployment", "Chip constraints bind", "Policy support reverses"],
    redFlags: ["Funding continues but AI ROI stays unproven", "Patchy ROI across regions", "Export-control escalation / funding cuts"],
  },
  "china-ev-shockwave": {
    question: "Can China's EV scale turn into profit, or does the price war eat the margin?",
    themeWeather: "Cooling — scale up, margins down",
    swingFactor: "Whether scale lowers cost faster than the price war destroys margin.",
    themeMap: [
      { layer: "Batteries & cells", symbols: ["300750.SZ", "BYDDF"] },
      { layer: "China EV makers", symbols: ["BYDDF", "LI", "NIO", "XPEV", "TSLA"] },
      { layer: "Legacy incumbents", symbols: ["GM", "F"] },
      { layer: "India auto & components", symbols: ["TATAMOTORS.NS", "M&M.NS", "SONACOMS.NS", "EXIDEIND.NS"] },
    ],
    bullRoad: ["China scale lowers cost", "exports expand", "legacy autos lose share", "winners take volume", "leaders re-rate"],
    bearRoad: ["price war intensifies", "margins compress", "tariffs hit exports", "overcapacity builds", "the basket de-rates"],
    proves: ["Volume growth turns into profit", "Cell costs keep falling", "Export share keeps rising", "Legacy autos cede ground", "India content wins scale"],
    breaks: ["Price war erases margins", "Tariffs close export markets", "Overcapacity floods the market", "Battery prices spike", "Demand growth stalls"],
    redFlags: ["Share keeps rising but only through deeper discounts", "Rising marketing & discounting", "Tariffs / margin collapse"],
  },
  "global-defence-rearmament": {
    question: "Is the global re-armament cycle durable enough to justify the re-rating?",
    themeWeather: "Hot — re-rated on strong order books",
    swingFactor: "Whether order books convert to delivered, paid-for revenue.",
    themeMap: [
      { layer: "US primes", symbols: ["LMT", "RTX", "NOC", "GD"] },
      { layer: "Drones & defence-AI", symbols: ["PLTR", "AVAV"] },
      { layer: "India DPSUs", symbols: ["HAL.NS", "BEL.NS", "BDL.NS"] },
      { layer: "India shipbuilding", symbols: ["MAZDOCK.NS", "COCHINSHIP.NS", "ZENTEC.NS"] },
    ],
    bullRoad: ["budgets stay elevated", "order books expand", "deliveries scale", "operating leverage kicks in", "names compound"],
    bearRoad: ["budgets plateau", "execution slips", "receivables build", "margins disappoint", "rich names correct"],
    proves: ["Defence budgets keep rising", "Backlog converts on time", "Book-to-bill stays above 1", "India receivables stay healthy", "Margins show operating leverage"],
    breaks: ["Budget plateaus or cuts", "Program delays mount", "Receivables balloon (India)", "Valuations outrun execution", "Peace/policy reduces urgency"],
    redFlags: ["Backlog grows but deliveries keep slipping", "Delivery delays creeping in", "Receivable build / margin miss"],
  },
  "physical-ai-robotics": {
    question: "Can AI move from screens into machines at an economic unit cost?",
    themeWeather: "Early — hype ahead of economics",
    swingFactor: "Whether robot unit economics reach payback at scale.",
    themeMap: [
      { layer: "Brains & compute", symbols: ["NVDA", "TSLA"] },
      { layer: "Industrial robots", symbols: ["ABBNY", "FANUY", "6861.T", "6954.T"] },
      { layer: "Applied robotics", symbols: ["ISRG", "SYM"] },
      { layer: "China & India", symbols: ["BYDDF", "1810.HK", "ABB.NS", "LT.NS"] },
    ],
    bullRoad: ["models reach the physical world", "robot costs fall", "payback improves", "deployments scale", "the theme re-rates"],
    bearRoad: ["hardware stays hard", "costs stay high", "regulation delays", "payback fails", "speculative names de-rate"],
    proves: ["Humanoid/robotaxi milestones hit", "Automation orders grow", "Robot unit economics reach payback", "Regulators enable deployment", "Surgical/warehouse adoption widens"],
    breaks: ["Costs stay prohibitive", "Regulation blocks autonomy", "Payback never arrives", "Hardware reliability disappoints", "Funding for early names dries up"],
    redFlags: ["Milestones land in demos but not in paying deployments", "Adoption slower than hype", "Cost/regulation stalls deployment"],
  },
  "global-industrial-rebuild": {
    question: "Is the reindustrialisation capex cycle long enough to reward today's multiples?",
    themeWeather: "Warm — late-cycle capex",
    swingFactor: "Whether the capex cycle outlasts the current multiples.",
    themeMap: [
      { layer: "Machinery", symbols: ["CAT", "DE"] },
      { layer: "Electrical & grid", symbols: ["ETN", "GEV", "ABBNY", "SIEGY"] },
      { layer: "Semicap", symbols: ["AMAT", "LRCX"] },
      { layer: "India capex", symbols: ["LT.NS", "CUMMINSIND.NS", "CGPOWER.NS", "BHEL.NS"] },
    ],
    bullRoad: ["localisation & grid spend rise", "order intake grows", "backlogs build", "margins expand", "industrials re-rate"],
    bearRoad: ["global growth slows", "capex orders soften", "backlogs shrink", "margins fade", "cyclicals correct"],
    proves: ["Order intake keeps growing", "Grid & electrification spend accelerates", "Semicap bookings rise", "India infra outlay is delivered", "Margins expand on volume"],
    breaks: ["A global slowdown hits orders", "Capex is deferred", "Semicap bookings roll over", "India delivery slips", "Multiples re-rate down"],
    redFlags: ["Order intake holds but pricing and margins soften", "Order intake flattening", "Booking declines / guidance cuts"],
  },
  "battery-storage-beyond-evs": {
    question: "Will grid and data-centre storage become a second demand curve beyond EVs?",
    themeWeather: "Mixed — demand up, prices soft",
    swingFactor: "Whether project IRRs hold as cell supply expands.",
    themeMap: [
      { layer: "Cells & lithium", symbols: ["300750.SZ", "BYDDF", "ALB"] },
      { layer: "Integrators & inverters", symbols: ["TSLA", "FLNC", "ENPH", "SEDG"] },
      { layer: "India power & batteries", symbols: ["TATAPOWER.NS", "JSWENERGY.NS", "EXIDEIND.NS"] },
    ],
    bullRoad: ["grid storage scales", "data-centre backup adds demand", "project IRRs hold", "cell makers run hot", "the basket re-rates"],
    bearRoad: ["cell oversupply builds", "lithium prices weaken", "project IRRs fall", "deployments slow", "names de-rate"],
    proves: ["Grid-storage deployments accelerate", "Project IRRs stay attractive", "Data-centre backup demand emerges", "Cell pricing stabilises", "Integrator backlogs grow"],
    breaks: ["Cell oversupply crushes prices", "Project economics turn negative", "Lithium weakness hits producers", "Subsidy/policy support fades", "Deployment timelines slip"],
    redFlags: ["Deployments rise but project IRRs thin out", "IRR compression on soft pricing", "Oversupply / negative project economics"],
  },
  "glp1-health-repricing": {
    question: "How far do weight-loss drugs reprice healthcare — and who beyond the makers wins?",
    themeWeather: "Hot — priced for success",
    swingFactor: "Whether pricing holds as competition and oral GLP-1s arrive.",
    themeMap: [
      { layer: "Drug makers", symbols: ["LLY", "NVO", "AZN"] },
      { layer: "Devices & diagnostics", symbols: ["ABT", "DXCM", "ISRG"] },
      { layer: "Distribution", symbols: ["MCK"] },
      { layer: "India pharma & CDMO", symbols: ["SUNPHARMA.NS", "DRREDDY.NS", "BIOCON.NS", "SYNGENE.NS"] },
    ],
    bullRoad: ["adoption expands globally", "new indications land", "supply scales", "adjacent sectors reprice", "leaders & suppliers win"],
    bearRoad: ["competition intensifies", "pricing pressure builds", "orals undercut", "profits compress", "leaders de-rate"],
    proves: ["New indications expand the market", "Supply capacity keeps up", "Pricing & reimbursement hold", "Adjacent sectors visibly reprice", "India CDMOs win share"],
    breaks: ["Oral GLP-1s undercut pricing", "Reimbursement tightens", "Side-effect data disappoints", "Supply gluts the market", "Competition erodes leaders"],
    redFlags: ["Demand stays strong but pricing starts to crack", "Competition entering the market", "Pricing pressure / reimbursement cuts"],
  },
  "market-toll-booths": {
    question: "Will rising trading, ETFs, SIPs and insurance keep compounding recurring fee revenue — in the US and India?",
    themeWeather: "Steady — quality, fully valued",
    swingFactor: "Whether fee compression offsets volume, data and India flow growth.",
    themeMap: [
      { layer: "Exchanges", symbols: ["CME", "ICE", "NDAQ", "HKXCY", "BSE.NS"] },
      { layer: "Data, index & ratings", symbols: ["MSCI", "SPGI", "MCO"] },
      { layer: "Payment rails", symbols: ["V", "MA"] },
      { layer: "India financialisation", symbols: ["CDSL.NS", "CAMS.NS", "KFINTECH.NS", "HDFCAMC.NS", "ANGELONE.NS"] },
      { layer: "India insurance", symbols: ["ICICIGI.NS", "SBILIFE.NS", "HDFCLIFE.NS"] },
    ],
    bullRoad: ["trading & ETFs grow", "data demand rises", "SIPs compound (India)", "recurring revenue scales", "quality re-rates"],
    bearRoad: ["fee compression bites", "a downturn cuts volumes", "regulation caps fees", "growth slows", "high multiples de-rate"],
    proves: ["Volumes & data subs keep growing", "SIP / demat counts rise (India)", "Pricing power holds", "Recurring mix increases", "Margins stay high"],
    breaks: ["Fee compression accelerates", "Regulation caps fees", "A market downturn cuts volumes", "Index/ratings demand softens", "Competition undercuts pricing"],
    redFlags: ["Volumes grow but fee pressure offsets them", "Early fee pressure", "Fee caps / volume collapse"],
  },
  "great-company-dangerous-price": {
    question: "Is the business great enough to justify a price that already assumes greatness?",
    themeWeather: "Overheated — perfection priced in",
    swingFactor: "Whether growth compounds fast enough to grow into the multiple.",
    themeMap: [
      { layer: "US quality at a price", symbols: ["NVDA", "COST", "LLY", "TSLA"] },
      { layer: "China quality, policy overhang", symbols: ["BYDDF", "TCEHY"] },
      { layer: "India premium compounders", symbols: ["TRENT.NS", "TITAN.NS", "ETERNAL.NS", "DIXON.NS"] },
    ],
    bullRoad: ["growth stays elevated", "margins keep rising", "estimates revise up", "the multiple is earned", "compounding continues"],
    bearRoad: ["growth merely meets bars", "estimates plateau", "the multiple de-rates", "returns lag the business", "the stock disappoints"],
    proves: ["Growth justifies the forward multiple", "Estimates keep revising up", "Margins keep improving", "Reinvestment runway is long", "It compounds through cycles"],
    breaks: ["Growth merely meets expectations", "Estimates roll over", "The multiple de-rates", "A single miss resets sentiment", "Reinvestment returns fade"],
    redFlags: ["Even good results may not be enough", "Estimate momentum fading", "Any miss vs a priced-for-perfection bar"],
  },
  "post-hype-ipo-survivors": {
    question: "Which IPO stories became real, self-funding businesses after the hype faded?",
    themeWeather: "Thawing — survivors emerging",
    swingFactor: "Whether the business turns self-funding before dilution and cycles bite.",
    themeMap: [
      { layer: "Fresh IPO / too early", symbols: ["SPCX", "ARM", "RDDT", "CART"] },
      { layer: "Maturing survivors", symbols: ["HOOD", "COIN", "ETERNAL.NS", "POLICYBZR.NS"] },
      { layer: "Still proving it", symbols: ["RIVN", "PAYTM.NS", "NYKAA.NS", "DELHIVERY.NS"] },
      { layer: "Valuation-discipline cases", symbols: ["CAVA", "ARM", "RDDT"] },
    ],
    bullRoad: ["hype-fade overshoots", "margins improve", "free cash flow turns positive", "dilution stops", "survivors re-rate"],
    bearRoad: ["growth slows", "losses persist", "dilution continues", "insiders sell", "the story never becomes earnings"],
    proves: ["Revenue still grows post-hype", "Gross margin improves", "Operating cash flow turns positive", "Free cash flow covers capex", "Share count stops rising"],
    breaks: ["Growth slows sharply", "Cash burn continues", "Dilution / heavy SBC persists", "Insiders sell post-lock-up", "Valuation never resets enough"],
    redFlags: ["Revenue grows but cash burn and dilution persist", "Rising marketing spend / slowing growth", "Falling cash / continued dilution"],
  },
  "critical-minerals": {
    question: "Does the AI-and-electrification build create durable demand for scarce resources?",
    themeWeather: "Cyclical — commodity-led",
    swingFactor: "Whether demand growth outpaces China supply and new mine capacity.",
    themeMap: [
      { layer: "Copper & diversified", symbols: ["FCX", "SCCO", "TECK", "BHP", "RIO"] },
      { layer: "Lithium & rare earths", symbols: ["ALB", "SQM", "MP"] },
      { layer: "Uranium", symbols: ["CCJ", "NXE"] },
      { layer: "India minerals", symbols: ["HINDCOPPER.NS", "NMDC.NS", "GMDC.NS"] },
    ],
    bullRoad: ["electrification & AI lift demand", "supply stays tight", "prices firm", "low-cost producers earn", "the basket re-rates"],
    bearRoad: ["growth slows", "China overcapacity floods supply", "prices fall", "high-cost producers squeezed", "names de-rate"],
    proves: ["End-demand (grid/EV/defence) accelerates", "Supply stays constrained", "Prices hold above cost curve", "Strategic stockpiling grows", "New mines stay delayed"],
    breaks: ["Commodity prices fall", "China overcapacity floods supply", "Global growth slows", "Substitution reduces demand", "New supply arrives early"],
    redFlags: ["Demand builds but prices lag the cost curve", "Price softness vs cost curve", "China supply glut / demand slowdown"],
  },
  "internet-2-0": {
    question: "Can AI improve commerce, ads, logistics and finance enough to expand platform margins?",
    themeWeather: "Overheated but improving",
    swingFactor: "Whether AI improves platform economics or simply increases competition.",
    themeMap: [
      { layer: "Ads / search / social", symbols: ["META", "GOOGL", "TCEHY", "BIDU", "NAUKRI.NS"] },
      { layer: "Commerce", symbols: ["AMZN", "SHOP", "BABA", "PDD", "JD", "NYKAA.NS"] },
      { layer: "Local & quick commerce", symbols: ["UBER", "DASH", "3690.HK", "ETERNAL.NS", "SWIGGY.NS"] },
      { layer: "Payments & embedded finance", symbols: ["PAYTM.NS", "POLICYBZR.NS"] },
    ],
    bullRoad: ["AI improves recommendations", "conversion & ad pricing rise", "logistics density improves", "margins expand", "platforms re-rate"],
    bearRoad: ["AI increases competition", "CAC rises", "take rates fall", "regulation tightens", "platforms de-rate"],
    proves: ["AI lifts ad conversion & pricing", "Quick-commerce losses shrink without killing growth", "Take rates stay stable or rise", "CAC doesn't outrun revenue", "Platforms show operating leverage"],
    breaks: ["AI agents reduce platform take rates", "Customer-acquisition costs rise", "Regulation caps fees or commissions", "Quick commerce stays structurally low-margin", "India internet names keep diluting"],
    redFlags: ["AI raises engagement but CAC still rises", "Rising marketing spend / CAC", "Falling take rates / rising losses"],
  },
};

// Thesis tests & source pack — the "signals that decide whether the theme is
// working" view (replaces the to-do-style checklist) and a typed source trail.
const TESTS: Record<string, { thesisTests: ThesisTest[]; sourcePack: SourceItem[] }> = {
  "ai-power-bottleneck": {
    thesisTests: [
      { test: "Hyperscaler capex guidance", signal: "Strengthening", importance: "Very high", why: "It's the demand driver for the entire chain.", metric: "Aggregate hyperscaler capex guidance, data-centre spend", breaksIf: "Two or more hyperscalers cut capex guidance" },
      { test: "Power & cooling backlog", signal: "Strengthening", importance: "High", why: "Backlog is forward revenue for the bottleneck names.", metric: "Order backlog, book-to-bill", breaksIf: "Backlog stalls or orders get cancelled" },
      { test: "Margin durability", signal: "Mixed", importance: "High", why: "Tests pricing power vs commoditisation as they scale.", metric: "Gross margin, inventory days", breaksIf: "Margins compress while revenue still grows" },
      { test: "Grid & interconnection", signal: "Watch closely", importance: "Medium", why: "Defines how fast new capacity can actually come online.", metric: "Interconnection queues, power-availability lead times", breaksIf: "Power scarcity caps deployment instead of lifting pricing" },
      { test: "Valuation cushion", signal: "Rising risk", importance: "High", why: "Rich multiples amplify any disappointment.", metric: "Forward EV/EBITDA vs growth", breaksIf: "Multiples re-rate down on a single guidance miss" },
    ],
    sourcePack: [
      { type: "Earnings calls", checks: "Hyperscaler capex guidance & data-centre commentary" },
      { type: "Company filings", checks: "Backlog, margins and inventory at power/cooling names" },
      { type: "Industry data", checks: "IEA / grid-operator power-demand projections" },
      { type: "Policy updates", checks: "Permitting, interconnection and grid-investment rules" },
    ],
  },
  "spacex-orbital-internet": {
    thesisTests: [
      { test: "Launch cadence", signal: "Strengthening", importance: "Very high", why: "Cadence underpins the whole economics.", metric: "Launches per quarter, reuse rate", breaksIf: "Cadence stalls or major vehicle slips" },
      { test: "Starlink margins", signal: "Critical test", importance: "Very high", why: "Broadband margin is the swing factor for the leader.", metric: "Subscribers, ARPU, gross margin", breaksIf: "Subs grow but margins stay thin" },
      { test: "Defence-space demand", signal: "Strengthening", importance: "High", why: "Government demand de-risks revenue.", metric: "Contract awards, backlog", breaksIf: "Award flow slows materially" },
      { test: "Funding runway", signal: "Watch closely", importance: "High", why: "Space is capital-intensive; funding gaps hurt.", metric: "Cash burn vs runway, raises", breaksIf: "A funding gap forces dilution" },
      { test: "Valuation discipline", signal: "Rising risk", importance: "High", why: "Scarcity premiums can unwind fast.", metric: "Implied valuation vs delivery", breaksIf: "Price runs far ahead of delivered milestones" },
    ],
    sourcePack: [
      { type: "SEC filings", checks: "S-1/IPO disclosures, share structure, lock-ups" },
      { type: "Company updates", checks: "Launch cadence, Starlink subscriber & ARPU data" },
      { type: "Policy / defence", checks: "Defence-space budgets and award flow" },
      { type: "Industry data", checks: "Launch-market and satellite-broadband trends" },
    ],
  },
  "sovereign-ai-stacks": {
    thesisTests: [
      { test: "National AI funding", signal: "Strengthening", importance: "Very high", why: "Policy is the demand driver here.", metric: "Government AI/compute funding programmes", breaksIf: "Major programmes are cut or stalled" },
      { test: "Export-control exposure", signal: "Rising risk", importance: "Very high", why: "Controls can cut addressable market overnight.", metric: "Restricted-market revenue share", breaksIf: "New controls close a key market" },
      { test: "Domestic-stack progress", signal: "Early", importance: "High", why: "The substitution thesis depends on it.", metric: "Domestic foundry yields, model benchmarks", breaksIf: "Local substitution keeps missing milestones" },
      { test: "AI ROI", signal: "Mixed", importance: "High", why: "Weak ROI eventually slows capex.", metric: "Customer AI revenue / productivity gains", breaksIf: "Customers cut AI budgets on poor ROI" },
      { test: "India sovereign compute", signal: "Early", importance: "Medium", why: "Tests the India leg of the theme.", metric: "Sovereign-compute tenders, data-centre builds", breaksIf: "Tenders fail to materialise" },
    ],
    sourcePack: [
      { type: "Policy updates", checks: "AI strategy papers, export controls, subsidies" },
      { type: "Earnings calls", checks: "Cloud & chip demand and capacity commentary" },
      { type: "Company filings", checks: "Capex, RPO/backlog, regional revenue mix" },
      { type: "Industry data", checks: "Foundry capacity & model-benchmark progress" },
    ],
  },
  "china-ev-shockwave": {
    thesisTests: [
      { test: "Profit vs volume", signal: "Weakening", importance: "Very high", why: "A price war can make volume worthless.", metric: "Unit economics, gross margin per vehicle", breaksIf: "Volume grows while margins go negative" },
      { test: "Price-war intensity", signal: "Rising risk", importance: "High", why: "It sets the margin floor for everyone.", metric: "Average selling prices, discounting", breaksIf: "ASPs keep falling across the sector" },
      { test: "Trade & tariff policy", signal: "Rising risk", importance: "High", why: "Tariffs can close key export markets.", metric: "Tariff actions, export volumes", breaksIf: "Major markets impose prohibitive tariffs" },
      { test: "Battery cost curve", signal: "Strengthening", importance: "High", why: "Cell cost drives the whole chain.", metric: "Cell prices, raw-material costs", breaksIf: "Cell prices spike and squeeze makers" },
      { test: "India content wins", signal: "Early", importance: "Medium", why: "Tests the India localisation angle.", metric: "Component order wins, content per vehicle", breaksIf: "India suppliers fail to win scale content" },
    ],
    sourcePack: [
      { type: "Company filings", checks: "ASPs, gross margin and unit economics" },
      { type: "Industry data", checks: "IEA EV & battery production / share data" },
      { type: "Policy updates", checks: "Tariffs, subsidies and trade actions" },
      { type: "Earnings calls", checks: "Price-war commentary and capacity plans" },
    ],
  },
  "global-defence-rearmament": {
    thesisTests: [
      { test: "Budget trajectory", signal: "Strengthening", importance: "Very high", why: "Top-down demand driver.", metric: "Defence budgets, % of GDP", breaksIf: "Budgets plateau or reverse" },
      { test: "Backlog conversion", signal: "Watch closely", importance: "Very high", why: "Backlog only matters if it ships.", metric: "Revenue vs backlog, delivery schedules", breaksIf: "Programs keep slipping deliveries" },
      { test: "India cash conversion", signal: "Mixed", importance: "High", why: "The weak spot for India DPSUs.", metric: "Receivable days, working capital", breaksIf: "Receivables balloon and cash conversion falls" },
      { test: "Book-to-bill", signal: "Strengthening", importance: "High", why: "Shows demand outpacing deliveries.", metric: "Book-to-bill ratio", breaksIf: "Book-to-bill falls below 1" },
      { test: "Valuation vs execution", signal: "Rising risk", importance: "High", why: "Defence has re-rated a lot.", metric: "Forward P/E vs delivery track record", breaksIf: "Multiples outrun delivered execution" },
    ],
    sourcePack: [
      { type: "Policy updates", checks: "SIPRI / national defence budgets" },
      { type: "Company filings", checks: "Order backlog, receivables, margins" },
      { type: "Earnings calls", checks: "Delivery cadence and program updates" },
      { type: "Industry data", checks: "Procurement and award announcements" },
    ],
  },
  "physical-ai-robotics": {
    thesisTests: [
      { test: "Flagship milestones", signal: "Early", importance: "High", why: "Tests the futuristic optionality.", metric: "Humanoid / robotaxi deployment milestones", breaksIf: "Milestones stay demos, not paying deployments" },
      { test: "Automation orders", signal: "Mixed", importance: "High", why: "The near-term, real revenue line.", metric: "Industrial-automation order intake", breaksIf: "Automation orders roll over" },
      { test: "Robot unit economics", signal: "Unproven", importance: "Very high", why: "Adoption needs payback to make sense.", metric: "Cost per robot, payback period", breaksIf: "Payback stays uneconomic at scale" },
      { test: "Regulatory path", signal: "Watch closely", importance: "High", why: "Autonomy lives or dies on approval.", metric: "Approvals for autonomy/robotics", breaksIf: "Regulation blocks or delays deployment" },
      { test: "Valuation vs delivery", signal: "Rising risk", importance: "High", why: "Early themes over-discount the future.", metric: "Valuation vs revenue realisation", breaksIf: "Price pays for hope, not delivery" },
    ],
    sourcePack: [
      { type: "Company R&D / demos", checks: "Robotics roadmaps and deployment milestones" },
      { type: "Industry data", checks: "Industrial-automation order trends" },
      { type: "Earnings calls", checks: "Automation revenue and margin commentary" },
      { type: "Policy updates", checks: "Autonomy and robotics regulation" },
    ],
  },
  "global-industrial-rebuild": {
    thesisTests: [
      { test: "Order intake", signal: "Strengthening", importance: "Very high", why: "The cycle's pulse.", metric: "Order intake, capex announcements", breaksIf: "Order intake flattens or declines" },
      { test: "Grid & electrification", signal: "Strengthening", importance: "High", why: "Structural, AI-linked demand.", metric: "Grid & electrification spend", breaksIf: "Grid capex is deferred" },
      { test: "Semicap bookings", signal: "Mixed", importance: "High", why: "Leading indicator for the chip build.", metric: "Semicap bookings, book-to-bill", breaksIf: "Bookings roll over" },
      { test: "India capex delivery", signal: "Strengthening", importance: "Medium", why: "India capex is a key leg.", metric: "Infra outlay vs delivery, execution", breaksIf: "India delivery slips materially" },
      { test: "Cycle-aware valuation", signal: "Watch closely", importance: "High", why: "Industrials are cyclical; multiples matter.", metric: "Multiple vs mid-cycle earnings", breaksIf: "Multiples price a peak that fades" },
    ],
    sourcePack: [
      { type: "Company filings", checks: "Order books, backlog and margins" },
      { type: "Industry data", checks: "Semicap bookings, PMI, capex surveys" },
      { type: "Policy updates", checks: "Infrastructure budgets and localisation incentives" },
      { type: "Earnings calls", checks: "Order-intake and pricing commentary" },
    ],
  },
  "battery-storage-beyond-evs": {
    thesisTests: [
      { test: "Grid-storage deployments", signal: "Strengthening", importance: "Very high", why: "The new demand driver beyond EVs.", metric: "Storage GWh deployed, project pipeline", breaksIf: "Deployments stall" },
      { test: "Project IRRs", signal: "Mixed", importance: "Very high", why: "Storage only scales if it pays.", metric: "Project IRRs at current prices", breaksIf: "IRRs turn uneconomic" },
      { test: "Cell & lithium pricing", signal: "Weakening", importance: "High", why: "Commodity swings drive the basket.", metric: "Cell prices, lithium spot", breaksIf: "Oversupply crushes prices" },
      { test: "Data-centre backup demand", signal: "Early", importance: "Medium", why: "A potential new pull on storage.", metric: "Backup-power / UPS storage orders", breaksIf: "Backup demand fails to materialise" },
      { test: "Supply discipline", signal: "Rising risk", importance: "High", why: "Oversupply crushes margins.", metric: "Cell capacity additions vs demand", breaksIf: "Capacity floods the market" },
    ],
    sourcePack: [
      { type: "Industry data", checks: "Storage deployment & lithium-price data" },
      { type: "Company filings", checks: "Project pipelines, backlog and margins" },
      { type: "Earnings calls", checks: "IRR and demand commentary" },
      { type: "Policy updates", checks: "Storage incentives and grid mandates" },
    ],
  },
  "glp1-health-repricing": {
    thesisTests: [
      { test: "Indication expansion", signal: "Strengthening", importance: "Very high", why: "New indications grow the market.", metric: "Trial readouts, label expansions", breaksIf: "Key readouts disappoint" },
      { test: "Supply capacity", signal: "Strengthening", importance: "High", why: "Supply has been the constraint.", metric: "Manufacturing capacity, fill rates", breaksIf: "Supply gluts and pricing falls" },
      { test: "Pricing & reimbursement", signal: "Watch closely", importance: "Very high", why: "Sets the profit ceiling.", metric: "Net pricing, payer coverage", breaksIf: "Reimbursement tightens sharply" },
      { test: "Competition (incl. orals)", signal: "Rising risk", importance: "High", why: "Erodes leader economics.", metric: "Pipeline entrants, oral GLP-1 data", breaksIf: "Orals undercut on price/convenience" },
      { test: "India CDMO / generics", signal: "Early", importance: "Medium", why: "The India angle on the theme.", metric: "CDMO contracts, biosimilar share", breaksIf: "India players fail to win share" },
    ],
    sourcePack: [
      { type: "Company filings / FDA", checks: "Trial data, approvals and supply" },
      { type: "Earnings calls", checks: "Pricing, capacity and demand commentary" },
      { type: "Industry data", checks: "Obesity-market models and prescription trends" },
      { type: "Policy updates", checks: "Reimbursement and pricing regulation" },
    ],
  },
  "market-toll-booths": {
    thesisTests: [
      { test: "Volumes & data subs", signal: "Strengthening", importance: "Very high", why: "The recurring-revenue engine.", metric: "Trading volumes, data subscriptions", breaksIf: "Volumes and subs stall" },
      { test: "Fee pressure", signal: "Rising risk", importance: "High", why: "The main structural risk.", metric: "Fee yields, take-rates", breaksIf: "Fee compression accelerates" },
      { test: "India flows", signal: "Strengthening", importance: "High", why: "India financialisation tailwind.", metric: "SIP, demat & insurance growth", breaksIf: "Flows reverse or fee caps bite" },
      { test: "Revenue cyclicality", signal: "Mixed", importance: "Medium", why: "Some toll-booths are volume-cyclical.", metric: "Recurring vs transactional mix", breaksIf: "A downturn cuts volume-linked revenue" },
      { test: "Valuation vs quality", signal: "Watch closely", importance: "High", why: "Great businesses, rarely cheap.", metric: "Forward P/E vs growth", breaksIf: "Multiples leave no margin for error" },
    ],
    sourcePack: [
      { type: "Company filings", checks: "Fee yields, recurring-revenue mix, margins" },
      { type: "Industry data", checks: "Exchange volumes, AMFI/SEBI flow data" },
      { type: "Policy updates", checks: "Fee caps and market regulation" },
      { type: "Earnings calls", checks: "Pricing power and volume commentary" },
    ],
  },
  "great-company-dangerous-price": {
    thesisTests: [
      { test: "Multiple vs growth", signal: "Rising risk", importance: "Very high", why: "Price must be earned by growth.", metric: "Forward P/E, PEG vs durable growth", breaksIf: "Growth can't justify the multiple" },
      { test: "Estimate revisions", signal: "Mixed", importance: "High", why: "Momentum in expectations matters.", metric: "EPS estimate-revision trend", breaksIf: "Estimates roll over" },
      { test: "What's priced in", signal: "Rising risk", importance: "Very high", why: "The core question of the theme.", metric: "Implied growth vs realistic growth", breaksIf: "Expectations exceed plausible delivery" },
      { test: "Margin trajectory", signal: "Strengthening", importance: "Medium", why: "Supports a premium multiple.", metric: "Operating margin trend", breaksIf: "Margins stop improving" },
      { test: "Margin of safety", signal: "Weakening", importance: "High", why: "Tests the return if growth merely meets the bar.", metric: "Return scenario at consensus growth", breaksIf: "Even meeting expectations yields poor returns" },
    ],
    sourcePack: [
      { type: "Company filings", checks: "Growth, margins and reinvestment" },
      { type: "Consensus estimates", checks: "Forward growth vs the implied multiple" },
      { type: "Historical multiples", checks: "Where the multiple sits vs its own range" },
      { type: "Earnings calls", checks: "Guidance and expectation-setting" },
    ],
  },
  "post-hype-ipo-survivors": {
    thesisTests: [
      { test: "Post-hype revenue growth", signal: "Mixed", importance: "High", why: "Proves demand is durable.", metric: "Revenue growth after the hype faded", breaksIf: "Growth slows sharply" },
      { test: "Gross-margin trend", signal: "Strengthening", importance: "High", why: "Shows real scale economics.", metric: "Gross margin trajectory", breaksIf: "Margins stop improving" },
      { test: "Cash generation", signal: "Critical test", importance: "Very high", why: "Separates businesses from stories.", metric: "Operating & free cash flow after capex", breaksIf: "Cash burn continues" },
      { test: "Dilution & SBC", signal: "Watch closely", importance: "High", why: "Dilution can quietly destroy returns.", metric: "Share count, stock-based comp", breaksIf: "Share count keeps rising" },
      { test: "Valuation reset", signal: "Mixed", importance: "High", why: "A good business can still be a bad price.", metric: "Multiple vs cash-flow profile", breaksIf: "Valuation never resets enough" },
    ],
    sourcePack: [
      { type: "S-1 / prospectus", checks: "Original IPO promises vs reality" },
      { type: "Company filings", checks: "Revenue, margins, cash flow and dilution" },
      { type: "Share-count history", checks: "Dilution and stock-based comp" },
      { type: "Insider / lock-up data", checks: "Insider selling and lock-up expiry" },
    ],
  },
  "critical-minerals": {
    thesisTests: [
      { test: "End-demand growth", signal: "Strengthening", importance: "Very high", why: "The structural pull.", metric: "Grid / EV / defence demand", breaksIf: "Demand growth slows" },
      { test: "Cost-curve position", signal: "Mixed", importance: "High", why: "Low-cost survives downturns.", metric: "Producer cash cost vs price", breaksIf: "High-cost producers get squeezed" },
      { test: "China supply risk", signal: "Rising risk", importance: "High", why: "China dominates several minerals.", metric: "China output & export policy", breaksIf: "China overcapacity floods supply" },
      { test: "New supply timing", signal: "Watch closely", importance: "Medium", why: "Supply response shapes prices.", metric: "New mine timelines, capex", breaksIf: "New supply arrives ahead of demand" },
      { test: "Commodity entry point", signal: "Mixed", importance: "High", why: "Entry point drives returns.", metric: "Price vs historical range", breaksIf: "Buying near a cyclical peak" },
    ],
    sourcePack: [
      { type: "Commodity data", checks: "Copper / uranium / lithium prices" },
      { type: "Company production reports", checks: "Output, cost curve and grades" },
      { type: "Policy updates", checks: "Critical-minerals strategy & stockpiling" },
      { type: "Industry data", checks: "Supply-demand balances and mine pipelines" },
    ],
  },
  "internet-2-0": {
    thesisTests: [
      { test: "Take-rate / ad pricing", signal: "Mixed", importance: "High", why: "Core monetisation lever for platforms.", metric: "Take rate, ad CPM, ARPU, commission rate", breaksIf: "Take rates fall while CAC rises" },
      { test: "Quick-commerce economics", signal: "Critical test", importance: "Very high", why: "The swing factor for India internet.", metric: "Contribution margin/order, dark-store density, delivery cost", breaksIf: "Losses stay high despite order growth" },
      { test: "Regulatory exposure", signal: "Rising risk", importance: "High", why: "Platforms face fee caps, data rules and scrutiny.", metric: "Fee caps, commission rules, data/privacy regulation", breaksIf: "Regulation directly compresses take rates" },
      { test: "AI-agent monetisation", signal: "Early", importance: "Medium", why: "Tests whether AI is a revenue driver or just a cost layer.", metric: "AI ad tools, agent conversion, AI revenue disclosure", breaksIf: "AI adds capex without lifting revenue/margins" },
      { test: "Customer-acquisition cost", signal: "Watch closely", importance: "High", why: "CAC can destroy platform operating leverage.", metric: "Marketing spend/revenue, retention, paid-traffic mix", breaksIf: "CAC rises faster than revenue growth" },
    ],
    sourcePack: [
      { type: "Earnings calls", checks: "Take-rate, ad pricing and quick-commerce commentary" },
      { type: "Company filings", checks: "Revenue, contribution margin, dilution" },
      { type: "Industry data", checks: "E-commerce, ad-market and delivery trends" },
      { type: "Policy updates", checks: "Platform-fee, commission and data regulation" },
      { type: "Community research", checks: "External articles and user-submitted analysis" },
    ],
  },
};

// Flatten grouped names → a de-duplicated list (a name can appear in two groups,
// e.g. a "valuation discipline case" that is also a "fresh IPO").
function flattenNames(groups: NameGroup[]): IdeaName[] {
  const seen = new Map<string, IdeaName>();
  for (const g of groups) {
    for (const n of g.names) {
      if (!seen.has(n.symbol)) seen.set(n.symbol, n);
    }
  }
  return [...seen.values()];
}

export const tradingIdeas: TradingIdea[] = RAW.map((i) => {
  const names = flattenNames(i.groups);
  const d = DASHBOARD[i.id];
  const t = TESTS[i.id];
  // Attach the [best, base, worst] red flag to the matching scenario by order.
  const scenarios = d
    ? i.scenarios.map((s, idx) => ({ ...s, redFlag: d.redFlags[idx] }))
    : i.scenarios;
  return {
    ...i,
    ...(d
      ? {
          question: d.question,
          themeWeather: d.themeWeather,
          swingFactor: d.swingFactor,
          themeMap: d.themeMap,
          bullRoad: d.bullRoad,
          bearRoad: d.bearRoad,
          proves: d.proves,
          breaks: d.breaks,
        }
      : {}),
    ...(t ? { thesisTests: t.thesisTests, sourcePack: t.sourcePack } : {}),
    scenarios,
    names,
    tickers: names.map((n) => n.symbol),
    riskLens: i.riskTag,
    signal: i.whyNow,
  };
});
