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
}

export interface ChecklistItem {
  question: string;
  why: string;
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
    tagline: "The exchanges, data, depositories and payment rails behind global finance",
    description:
      "Toll-booth businesses: exchanges, depositories, index providers, rating agencies, payment networks and financial infrastructure that earn recurring fees as activity grows.",
    whyNow:
      "More trading, more ETFs, more SIPs and more data usage compound recurring revenue — a quieter, higher-quality way to play financialisation.",
    regions: ["US", "China/HK", "India"],
    timeHorizon: "3–10 years",
    maturity: "Mature",
    valuationRisk: "Medium-high",
    bullCase: "More trading, ETFs, SIPs and data usage increase recurring revenue at high incremental margins.",
    bearCase: "Regulation, fee compression, market downturns and lower trading activity hurt growth.",
    watch: ["Volumes & data subscriptions", "Fee/regulatory pressure", "SIP & demat growth (India)", "Index/ratings demand"],
    bestFor: "Quality-compounder investors",
    riskTag: "Fee-compression · Regulatory risk",
    groups: [
      {
        label: "Exchanges & data (US)",
        names: [
          { symbol: "CME", role: "Derivatives exchange" },
          { symbol: "ICE", role: "Exchanges & data" },
          { symbol: "NDAQ", role: "Exchange & market tech" },
          { symbol: "MSCI", role: "Index & analytics" },
          { symbol: "SPGI", role: "Ratings, indices & data" },
          { symbol: "MCO", role: "Credit ratings & analytics" },
        ],
      },
      {
        label: "Payment networks",
        names: [
          { symbol: "V", role: "Payment network" },
          { symbol: "MA", role: "Payment network" },
        ],
      },
      {
        label: "Asia / India market plumbing",
        names: [
          { symbol: "HKXCY", role: "HK exchange (China access)" },
          { symbol: "BSE.NS", role: "India exchange" },
          { symbol: "CDSL.NS", role: "India depository" },
          { symbol: "CAMS.NS", role: "India MF registrar / RTA" },
          { symbol: "KFINTECH.NS", role: "India registrar / RTA" },
        ],
      },
    ],
    scenarios: [
      { kind: "Best case", what: "More trading, ETFs, SIPs and data usage compound recurring, high-margin revenue.", wins: "MSCI · SPGI · V/MA · India RTAs" },
      { kind: "Base case", what: "Steady recurring growth, occasional fee pressure; quality compounds quietly.", wins: "Diversified data & index names" },
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
    id: "em-financialisation",
    title: "Emerging Market Financialisation",
    category: "India",
    tagline: "India saves, invests, insures and trades more",
    description:
      "India-led but globally comparable: households shifting from cash, property and gold into mutual funds, equities, insurance, pensions and wealth platforms.",
    whyNow:
      "Rising SIP flows, demat-account growth and insurance penetration are turning a demographic story into recurring financial-services revenue.",
    regions: ["India", "China", "US comparison"],
    timeHorizon: "3–10 years",
    maturity: "Early-mid",
    valuationRisk: "Medium-high",
    bullCase: "SIP flows, demat accounts, insurance penetration and wealth products keep compounding.",
    bearCase: "A market correction, fee caps, regulation or weak retail participation slows the cycle.",
    watch: ["SIP & demat growth", "Insurance penetration", "Fee/regulatory caps", "Market-cycle sensitivity"],
    bestFor: "Long-horizon EM investors",
    riskTag: "Market-cycle · Regulatory risk",
    groups: [
      {
        label: "India asset & wealth managers",
        names: [
          { symbol: "HDFCAMC.NS", role: "India asset manager" },
          { symbol: "NAM-INDIA.NS", role: "India asset manager" },
          { symbol: "ANGELONE.NS", role: "India discount broker" },
        ],
      },
      {
        label: "India market plumbing",
        names: [
          { symbol: "BSE.NS", role: "India exchange" },
          { symbol: "CDSL.NS", role: "India depository" },
          { symbol: "CAMS.NS", role: "India MF registrar / RTA" },
          { symbol: "KFINTECH.NS", role: "India registrar / RTA" },
        ],
      },
      {
        label: "India insurance",
        names: [
          { symbol: "ICICIGI.NS", role: "India general insurer" },
          { symbol: "SBILIFE.NS", role: "India life insurer" },
          { symbol: "HDFCLIFE.NS", role: "India life insurer" },
        ],
      },
      {
        label: "Global comparison",
        names: [
          { symbol: "BLK", role: "US asset manager (comparison)" },
          { symbol: "SCHW", role: "US brokerage (comparison)" },
          { symbol: "MSCI", role: "Index & data (comparison)" },
        ],
      },
    ],
    scenarios: [
      { kind: "Best case", what: "SIP flows, demat accounts, insurance penetration and wealth products keep compounding.", wins: "AMCs · RTAs · insurers" },
      { kind: "Base case", what: "Steady growth with periodic fee caps and cycle wobbles.", wins: "Diversified financial-infra names" },
      { kind: "Worst case", what: "A correction, fee caps or weak retail participation slows the cycle.", wins: "Few; high-multiple names de-rate" },
    ],
    checklist: [
      { question: "Are SIP & demat counts still growing?", why: "Core flow drivers." },
      { question: "Is insurance penetration rising?", why: "Long-runway structural leg." },
      { question: "Are fee caps / regulation a threat?", why: "Can compress unit economics." },
      { question: "How market-cycle sensitive is revenue?", why: "AMC/broker revenue tracks markets." },
      { question: "Is the structural story already in the price?", why: "Quality India financials aren't cheap." },
    ],
    scores: [
      { label: "Revenue visibility", score: 7 },
      { label: "Valuation comfort", score: 4 },
      { label: "Flow momentum", score: 7 },
      { label: "Balance-sheet strength", score: 7 },
      { label: "Cycle resilience", score: 5 },
    ],
    verdict: "Powerful structural flow story; valuations and the market cycle are the main risks.",
    sources: ["AMFI / SEBI flow data", "Company annual reports", "Insurance-penetration studies"],
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
  return {
    ...i,
    names,
    tickers: names.map((n) => n.symbol),
    riskLens: i.riskTag,
    signal: i.whyNow,
  };
});
