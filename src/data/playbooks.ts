// Research Playbooks — curated research frameworks that decode how a big-picture
// thesis maps onto public-market investing themes. These are study frameworks,
// not recommendations. Static for now; the structure is built so more playbooks
// can be added later.

export interface PlaybookSummaryCard {
  title: string;
  summary: string;
}

export interface PlaybookLinkedIdea {
  ideaId: string; // matches a tradingIdeas id, for "Open theme →"
  title: string;
  whyLinked: string;
  names: string[];
}

export interface PlaybookThesisTest {
  test: string;
  signal: "Strengthening" | "Mixed" | "Weakening" | "Early" | "Watch closely";
  metric: string;
  breaksIf: string;
}

export interface PlaybookScenario {
  kind: "Best case" | "Base case" | "Worst case";
  what: string;
  beneficiaries: string;
  redFlag: string;
}

export interface PlaybookSource {
  title: string;
  checks: string; // " · " separated checks
  linked?: string[];
  why?: string; // the evidence / why-it-matters context
  usedIn?: string; // the thesis test this source helps decide
  href?: string; // canonical landing page (swap exact deep links later)
}

// ── Exposure model ───────────────────────────────────────────────────────────
// Tickers in a thesis are NOT all bullish holdings. We separate exposure types
// so a name is never shown as a long position when the thesis is bearish on it,
// and private companies (e.g. Anthropic) are never shown as tradable tickers.
export type AssetType = "stock" | "etf" | "private_company" | "fund" | "theme";
export type ExposureType = "long" | "short" | "private" | "proxy" | "watchlist" | "editorial";

export interface ExposureItem {
  name: string;
  ticker?: string; // omitted for private companies (not directly tradable)
  assetType: AssetType;
  exposureType: ExposureType;
  conviction?: "high" | "medium" | "low";
  isDirectExposure: boolean; // false for proxies and private companies
  explanation: string;
  sourceUrl?: string;
}

export interface ExposureGroup {
  key: "long" | "short" | "private" | "proxy" | "etf" | "watchlist";
  title: string;
  note: string; // the small explanation shown beside the group
  items: ExposureItem[];
}

export interface Playbook {
  id: string;
  title: string;
  subtitle: string;
  // Investment-memo header (preferred on the full research page).
  memoTitle?: string;
  memoSubtitle?: string;
  styleTag?: string; // e.g. "Macro / geopolitics / AI infrastructure"
  oneLineThesis?: string; // the single prominent thesis statement
  soWhat?: string; // "so what does this mean for investors?"
  tags: string[];
  detailTags: string[]; // a slightly fuller tag set for the detail header
  type: string;
  timeHorizon: string;
  riskLens: string;
  bestFor: string;
  status: string;
  lastUpdated?: string;
  updateTrigger?: string;
  coreQuestion: string;
  read: string;
  whatChanged?: string[];
  summary: PlaybookSummaryCard[];
  linkedIdeas: PlaybookLinkedIdea[];
  exposure?: ExposureGroup[];
  bullCase: string;
  bearCase: string;
  thesisTests: PlaybookThesisTest[];
  scenarios: PlaybookScenario[];
  bullRoad: string[];
  bearRoad: string[];
  sourcePack: PlaybookSource[];
}

export const playbooks: Playbook[] = [
  {
    id: "situational-awareness",
    title: "Decode: The Situational Awareness Playbook",
    subtitle: "AI timelines, compute, national security and the capital cycle",
    memoTitle: "Situational Awareness: AI as Strategic Infrastructure",
    memoSubtitle:
      "How frontier AI may reshape compute, power, chips, cloud, defence and public-market capital flows.",
    styleTag: "Macro / geopolitics / AI infrastructure",
    oneLineThesis:
      "AI capability growth may turn compute, power and national-security infrastructure into strategic assets. The winners may be the companies that control cloud, chips, power, data centres and defence infrastructure — but the most crowded AI names may face near-term de-rating risk.",
    soWhat:
      "This framework is not simply 'buy AI stocks.' The positioning is a barbell: LONG the physical enablers (data-centre power, cooling, specialized GPU cloud) and SHORT the crowded, richly-valued AI-hardware names (semis, SMH, NVDA, AVGO, AMD, ORCL) via puts. A name can be central to the theme and still be a poor entry — central to AI ≠ a good position today.",
    tags: ["AI", "Compute", "Sovereign AI", "Power", "Defence", "Semiconductors"],
    detailTags: [
      "AI",
      "Compute",
      "Sovereign AI",
      "Semiconductors",
      "Defence",
      "Power",
      "Geopolitics",
    ],
    type: "Research Playbook",
    timeHorizon: "3–10 years",
    riskLens: "Relatively Risky",
    bestFor: "Macro / geopolitics-aware investors",
    status: "Framework decode",
    lastUpdated: "26 Jun 2026",
    updateTrigger: "new hyperscaler earnings / AI policy / export-control change",
    coreQuestion:
      "Is frontier AI becoming strategic infrastructure — and what does that imply for compute, power, chips, cloud, defence and public-market capital flows?",
    read:
      "The Situational Awareness framework is not a stock tip. It is a map of how accelerating AI capability could force governments, hyperscalers and investors to treat compute, power and national-security infrastructure as strategic assets.",
    whatChanged: [
      "Hyperscaler capex is the key confirmation signal — and it is still rising.",
      "Power availability is becoming a binding constraint on the buildout.",
      "Sovereign AI is moving from policy statements to funded programmes.",
      "Crowded AI leaders (notably NVDA) carry growing near-term de-rating risk even as the long-term theme holds.",
    ],
    summary: [
      { title: "AI acceleration", summary: "Frontier models may improve fast enough to compress investment and policy timelines." },
      { title: "Compute as strategic infrastructure", summary: "Chips, cloud capacity and data centres become national assets, not just corporate capex." },
      { title: "Power becomes the bottleneck", summary: "Electricity, cooling and grid capacity become constraints on AI buildout." },
      { title: "National security enters the market", summary: "Defence, cyber, sovereign AI and export controls become part of the investment debate." },
    ],
    linkedIdeas: [
      {
        ideaId: "sovereign-ai-stacks",
        title: "Sovereign AI Stacks",
        whyLinked: "Countries may fund domestic AI infrastructure, cloud and compute capacity.",
        names: ["NVDA", "AMD", "MSFT", "GOOGL", "AMZN", "ORCL", "BABA", "BIDU", "RELIANCE.NS", "BHARTIARTL.NS", "TATACOMM.NS"],
      },
      {
        ideaId: "ai-power-bottleneck",
        title: "AI Power Bottleneck",
        whyLinked: "Compute growth creates power, cooling and grid bottlenecks.",
        names: ["VRT", "ETN", "GEV", "ANET", "EQIX", "DLR", "ABB.NS", "SIEMENS.NS", "TATAPOWER.NS", "POWERGRID.NS"],
      },
      {
        ideaId: "global-defence-rearmament",
        title: "Global Defence Re-Armament",
        whyLinked: "AI becomes part of national-security infrastructure.",
        names: ["PLTR", "LMT", "RTX", "NOC", "GD", "HAL.NS", "BEL.NS", "BDL.NS"],
      },
      {
        ideaId: "physical-ai-robotics",
        title: "Physical AI & Robotics",
        whyLinked: "Frontier AI may move into drones, robots, autonomy and industrial machines.",
        names: ["TSLA", "NVDA", "ISRG", "ABBNY", "FANUY", "ABB.NS", "SIEMENS.NS", "LT.NS"],
      },
      {
        ideaId: "global-industrial-rebuild",
        title: "Global Industrial Rebuild",
        whyLinked: "AI buildout requires factories, semicap, grids, cooling and hard assets.",
        names: ["AMAT", "LRCX", "ETN", "GEV", "CAT", "LT.NS", "CGPOWER.NS", "THERMAX.NS"],
      },
    ],
    exposure: [
      {
        key: "long",
        title: "Long Book — Data-Center Power & Specialized Compute",
        note: "The fund's ~$3.85bn equity/call book: raw data-centre power, specialized GPU cloud and digital-infrastructure proxies — the physical enablers of AI rather than the crowded chip names. Positions as disclosed; sizes are approximate and move over time. Thematic exposure, not a recommendation.",
        items: [
          { name: "Bloom Energy", ticker: "BE", assetType: "stock", exposureType: "long", conviction: "high", isDirectExposure: true, explanation: "On-site fuel-cell power for data centres — ~$879M common (6.5M shares) plus ~$55M calls. A direct play on power becoming the binding AI constraint." },
          { name: "Nebius Group", ticker: "NBIS", assetType: "stock", exposureType: "long", conviction: "high", isDirectExposure: true, explanation: "AI cloud / GPU infrastructure — a ~$2.6bn+ combined stake, the book's largest single long." },
          { name: "CoreWeave", ticker: "CRWV", assetType: "stock", exposureType: "long", conviction: "high", isDirectExposure: true, explanation: "Specialized GPU cloud for AI training and inference — a major long on rented compute capacity." },
          { name: "Sandisk", ticker: "SNDK", assetType: "stock", exposureType: "long", conviction: "medium", isDirectExposure: true, explanation: "Storage / NAND for AI data pipelines — a common-stock position above 1M shares plus new calls." },
          { name: "IREN Limited", ticker: "IREN", assetType: "stock", exposureType: "long", conviction: "medium", isDirectExposure: true, explanation: "Clean-energy data centres repurposing power capacity for AI compute." },
          { name: "Core Scientific", ticker: "CORZ", assetType: "stock", exposureType: "long", conviction: "medium", isDirectExposure: true, explanation: "Large-scale HPC / AI hosting infrastructure with contracted power." },
          { name: "Applied Digital", ticker: "APLD", assetType: "stock", exposureType: "long", conviction: "medium", isDirectExposure: true, explanation: "Next-generation data-centre hosting build-out for AI tenants." },
          { name: "Riot Platforms", ticker: "RIOT", assetType: "stock", exposureType: "long", conviction: "medium", isDirectExposure: true, explanation: "Power-grid and high-density infrastructure proxy pivoting toward AI compute." },
          { name: "CleanSpark", ticker: "CLSK", assetType: "stock", exposureType: "long", conviction: "medium", isDirectExposure: true, explanation: "Energy-led data-centre operator — a power-and-siting proxy for the buildout." },
          { name: "Lumentum", ticker: "LITE", assetType: "stock", exposureType: "long", conviction: "medium", isDirectExposure: true, explanation: "Optical-networking components for data-centre interconnect — picks-and-shovels to compute scale-out." },
        ],
      },
      {
        key: "short",
        title: "Short Book — AI-Hardware Puts / De-rating Risk",
        note: "The fund's ~$8.46bn put book, targeting the AI-hardware supply chain and over-extended semi valuations. These are put / bearish positions (de-rating risk), NOT short recommendations; notional sizes are approximate. Note — TSM and MU appear here AND in the long book: the fund holds puts AND calls on them. That is a volatility structure, not a contradiction. Long options on both sides profit from a LARGE move in EITHER direction and let the fund monetise short-term rallies while keeping a bearish directional tilt — a bet on turbulence, not simply on price going down.",
        items: [
          { name: "VanEck Semiconductor ETF", ticker: "SMH", assetType: "etf", exposureType: "short", conviction: "high", isDirectExposure: true, explanation: "~$2.0bn notional put exposure — the single largest short, a basket bet against listed chipmakers." },
          { name: "NVIDIA", ticker: "NVDA", assetType: "stock", exposureType: "short", conviction: "high", isDirectExposure: true, explanation: "~$1.6bn notional puts. Central to the AI cycle, but the view here is bearish near term: stretched valuation, capex-sustainability and customer-concentration risk." },
          { name: "Oracle", ticker: "ORCL", assetType: "stock", exposureType: "short", conviction: "high", isDirectExposure: true, explanation: "~$1.07bn notional puts — a bet that its AI-cloud capex and backlog optimism is over-extended." },
          { name: "Broadcom", ticker: "AVGO", assetType: "stock", exposureType: "short", conviction: "high", isDirectExposure: true, explanation: "~$1.0bn notional puts. Custom AI-silicon leader, but priced for continued hyperscaler spend — a de-rating candidate if capex cools." },
          { name: "Advanced Micro Devices", ticker: "AMD", assetType: "stock", exposureType: "short", conviction: "high", isDirectExposure: true, explanation: "~$970M notional puts — leverage to the buildout cuts both ways if AI-accelerator demand disappoints." },
          { name: "Taiwan Semiconductor", ticker: "TSM", assetType: "stock", exposureType: "short", conviction: "medium", isDirectExposure: true, explanation: "~$535M notional puts — but the fund ALSO holds ~$354M of TSM calls: a volatility structure, not a clean directional short (see the note above)." },
          { name: "ASML Holding", ticker: "ASML", assetType: "stock", exposureType: "short", conviction: "medium", isDirectExposure: true, explanation: "Put exposure (size undisclosed) — the lithography monopoly geared to the same capex cycle the fund is fading." },
          { name: "Micron Technology", ticker: "MU", assetType: "stock", exposureType: "short", conviction: "medium", isDirectExposure: true, explanation: "Put exposure (size undisclosed) alongside offsetting calls — again a volatility trade rather than a pure short (see the note above)." },
          { name: "Intel", ticker: "INTC", assetType: "stock", exposureType: "short", conviction: "low", isDirectExposure: true, explanation: "Put exposure (size undisclosed) — a laggard / foundry-execution short within the semis basket." },
          { name: "Corning", ticker: "GLW", assetType: "stock", exposureType: "short", conviction: "low", isDirectExposure: true, explanation: "Put exposure (size undisclosed) — optical / fibre supplier tied to the same data-centre capex." },
          { name: "Infosys", ticker: "INFY", assetType: "stock", exposureType: "short", conviction: "low", isDirectExposure: true, explanation: "Put exposure (size undisclosed) — an international macro short on IT-services demand." },
        ],
      },
      {
        key: "private",
        title: "Private AI Lab Exposure",
        note: "Central to the thesis but NOT directly tradable. Public-market exposure is only indirect, via the proxies below.",
        items: [
          { name: "Anthropic", assetType: "private_company", exposureType: "private", isDirectExposure: false, explanation: "Central private frontier-AI lab (Claude). Not directly tradable as a public stock. Public exposure is indirect, primarily via AMZN and GOOGL, who are investors and compute partners. ETFs do not hold Anthropic directly.", sourceUrl: "https://www.anthropic.com" },
          { name: "OpenAI", assetType: "private_company", exposureType: "private", isDirectExposure: false, explanation: "Frontier lab at the centre of the framework. Private — not directly tradable. Public exposure is indirect, primarily via MSFT (strategic partner / investor).", sourceUrl: "https://openai.com" },
          { name: "xAI", assetType: "private_company", exposureType: "private", isDirectExposure: false, explanation: "Frontier lab. Private — not directly tradable as a public stock; no clean listed proxy.", sourceUrl: "https://x.ai" },
          { name: "SharonAI", assetType: "private_company", exposureType: "private", isDirectExposure: false, explanation: "Newly disclosed private foundational-infrastructure position in the fund's book. Private — no direct public ticker; public-market exposure would only be indirect via listed data-centre/compute proxies in the Long Book." },
        ],
      },
      {
        key: "proxy",
        title: "Public Market Proxies",
        note: "Listed companies with investment or partnership links to the private labs. INDIRECT, thematic links — not direct ownership of OpenAI / Anthropic / xAI.",
        items: [
          { name: "Microsoft", ticker: "MSFT", assetType: "stock", exposureType: "proxy", conviction: "high", isDirectExposure: false, explanation: "Strategic partner and investor in OpenAI; exclusive-ish cloud relationship. Indirect exposure — not direct ownership.", sourceUrl: "https://www.microsoft.com/en-us/investor" },
          { name: "Amazon", ticker: "AMZN", assetType: "stock", exposureType: "proxy", conviction: "medium", isDirectExposure: false, explanation: "Lead investor in Anthropic and its AWS compute partner. Indirect exposure — not direct ownership.", sourceUrl: "https://ir.aboutamazon.com" },
          { name: "Alphabet", ticker: "GOOGL", assetType: "stock", exposureType: "proxy", conviction: "medium", isDirectExposure: false, explanation: "Investor in Anthropic (alongside its own DeepMind lab). Indirect exposure — not direct ownership." },
          { name: "NVIDIA", ticker: "NVDA", assetType: "stock", exposureType: "proxy", conviction: "medium", isDirectExposure: false, explanation: "AI-infrastructure proxy — sells compute to every major lab — but the near-term view here is bearish (see De-rating Risk). Shown as a proxy for aggregate AI-lab spend, not as a positive position." },
        ],
      },
      {
        key: "etf",
        title: "ETF / Basket Exposure",
        note: "Basket context, shown for reference. The fund's own ETF position is a SHORT — the SMH puts in the Short Book — so the semiconductor baskets below are what it is fading, not holding.",
        items: [
          { name: "iShares Semiconductor ETF", ticker: "SOXX", assetType: "etf", exposureType: "watchlist", conviction: "low", isDirectExposure: true, explanation: "Broad basket of listed chipmakers (NVDA, AVGO, AMD…) — the same names the fund is shorting via SMH puts. Shown as context, not a long." },
          { name: "Invesco QQQ Trust", ticker: "QQQ", assetType: "etf", exposureType: "watchlist", conviction: "low", isDirectExposure: true, explanation: "Mega-cap tech index incl. MSFT, GOOGL, AMZN, NVDA — a read on the crowded AI-mega-cap complex, not a position here." },
        ],
      },
    ],
    bullCase:
      "The barbell pays off. AI compute demand is real, but the value accrues to power, cooling, siting and specialized cloud — the Long Book — while the crowded, richly-valued chip names in the Short Book de-rate as capex growth slows and compute gets more efficient. The ~$8.46bn of puts also hedges the longs if the whole AI complex sells off together.",
    bearCase:
      "The chip shorts are the pain trade. If hyperscaler capex keeps compounding, NVDA / AVGO / AMD and the semis keep re-rating and the put book bleeds premium. Meanwhile several longs are unprofitable, power-hungry, crypto-adjacent infrastructure names that can fall hardest in a risk-off — so both legs can lose at once.",
    thesisTests: [
      { test: "Frontier AI progress", signal: "Watch closely", metric: "model capability jumps, benchmark gains, enterprise adoption", breaksIf: "model progress slows materially" },
      { test: "Hyperscaler capex", signal: "Strengthening", metric: "MSFT, AMZN, GOOGL, META, ORCL capex guidance", breaksIf: "capex guidance is cut across multiple hyperscalers" },
      { test: "Compute scarcity", signal: "Strengthening", metric: "GPU supply, data-centre capacity, cloud backlog", breaksIf: "compute supply becomes abundant faster than demand" },
      { test: "Power and grid constraints", signal: "Strengthening", metric: "data-centre power demand, interconnection queues, grid capex", breaksIf: "power constraints ease without pricing impact" },
      { test: "Sovereign AI funding", signal: "Mixed", metric: "US, China, India, Europe AI funding and policy announcements", breaksIf: "government funding stalls or reverses" },
      { test: "Defence AI adoption", signal: "Early", metric: "AI defence contracts, autonomy programmes, cyber/AI budgets", breaksIf: "adoption remains experimental and does not scale" },
    ],
    scenarios: [
      {
        kind: "Best case",
        what: "AI acceleration becomes a multi-year strategic infrastructure cycle.",
        beneficiaries: "compute, cloud, power, semicap, defence AI, grid, cooling",
        redFlag: "capex rises but ROI remains unclear",
      },
      {
        kind: "Base case",
        what: "AI remains important, but adoption and monetisation are uneven.",
        beneficiaries: "only the strongest platforms and infrastructure suppliers",
        redFlag: "spending continues but earnings upgrades narrow",
      },
      {
        kind: "Worst case",
        what: "AI progress or monetisation disappoints, capex gets cut, and expensive AI-infrastructure names de-rate.",
        beneficiaries: "cash-rich platforms and diversified infrastructure names",
        redFlag: "hyperscaler capex cuts, margin compression, funding slowdown",
      },
    ],
    bullRoad: [
      "AI capability rises",
      "compute scarcity grows",
      "hyperscaler capex expands",
      "power/grid bottlenecks worsen",
      "sovereign AI funding rises",
      "infrastructure names re-rate",
    ],
    bearRoad: [
      "AI ROI disappoints",
      "capex slows",
      "compute supply catches up",
      "power bottleneck weakens",
      "policy funding cools",
      "AI infrastructure basket de-rates",
    ],
    sourcePack: [
      {
        title: "Situational Awareness: The Decade Ahead",
        checks: "AI timelines · compute scaling · national-security implications · 'AI as strategic infrastructure'",
        why: "The anchor framework being decoded. Leopold Aschenbrenner's original 'Situational Awareness' argues that AI progress could rapidly become a national-security and compute-infrastructure race.",
        usedIn: "Frontier AI progress",
        href: "https://situational-awareness.ai",
      },
      {
        title: "Hyperscaler earnings calls & filings",
        checks: "AI capex guidance · cloud demand · data-centre buildout · customer commitments",
        linked: ["MSFT", "AMZN", "GOOGL", "META", "ORCL"],
        why: "Tests whether the AI-infrastructure thesis is actually showing up in spending. Microsoft's FY2025 reporting points to continued capex to support cloud growth and AI infrastructure, with FY25 Q4 quarterly capex around $24.2bn; Amazon's disclosures cover AWS capex and customer commitments for future monetisation.",
        usedIn: "Hyperscaler capex",
        href: "https://www.microsoft.com/en-us/investor",
      },
      {
        title: "Semiconductor & compute filings",
        checks: "GPU demand · custom silicon · networking · supply constraints · AI revenue mix",
        linked: ["NVDA", "AMD", "AVGO", "ANET"],
        why: "Nvidia's data-centre revenue and the Blackwell cycle are central to the compute-scarcity thesis — Blackwell is described as data-centre-scale infrastructure (GPUs, CPUs, DPUs, interconnects, switch chips, systems, networking). Broadcom covers the custom-silicon / networking leg (custom accelerators, Ethernet switching/routing, NICs, optical components, XPU racks).",
        usedIn: "Compute scarcity",
        href: "https://investor.nvidia.com",
      },
      {
        title: "Power & grid sources",
        checks: "electricity demand · data-centre load · interconnection queues · grid investment · cooling",
        linked: ["VRT", "ETN", "GEV", "ABB.NS", "SIEMENS.NS", "TATAPOWER.NS", "POWERGRID.NS"],
        why: "The IEA's 'Energy and AI' report projects global data-centre electricity consumption to more than double to around 945 TWh by 2030, with the US the largest share of the increase and China following. Vertiv's disclosures cover high-density cooling and advanced power / thermal management for hyperscale and AI data centres.",
        usedIn: "Power and grid constraints",
        href: "https://www.iea.org/reports/energy-and-ai",
      },
      {
        title: "Defence & policy sources",
        checks: "sovereign AI funding · export controls · defence AI · national-security framing",
        linked: ["PLTR", "LMT", "RTX", "NOC", "HAL.NS", "BEL.NS"],
        why: "US policy supports the national-security angle: the US AI Action Plan centres on accelerating innovation, building AI infrastructure and international AI diplomacy/security; BIS export-control guidance links advanced AI chips to military and national-security concerns. India's IndiaAI Mission gives sovereign-compute context, and the US DoD AI Adoption Strategy frames AI entering defence operations.",
        usedIn: "Sovereign AI funding · Defence AI adoption",
        href: "https://www.google.com/search?q=US+AI+Action+Plan+BIS+export+controls+IndiaAI+Mission",
      },
    ],
  },
];

export function getPlaybook(id: string): Playbook | undefined {
  return playbooks.find((p) => p.id === id);
}
