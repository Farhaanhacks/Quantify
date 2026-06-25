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
  checks: string;
  linked?: string[];
  href?: string;
}

export interface Playbook {
  id: string;
  title: string;
  subtitle: string;
  tags: string[];
  detailTags: string[]; // a slightly fuller tag set for the detail header
  type: string;
  timeHorizon: string;
  riskLens: string;
  bestFor: string;
  status: string;
  coreQuestion: string;
  read: string;
  summary: PlaybookSummaryCard[];
  linkedIdeas: PlaybookLinkedIdea[];
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
    riskLens: "High uncertainty",
    bestFor: "Macro / geopolitics-aware investors",
    status: "Framework decode",
    coreQuestion:
      "Is frontier AI becoming strategic infrastructure — and what does that imply for compute, power, chips, cloud, defence and public-market capital flows?",
    read:
      "The Situational Awareness framework is not a stock tip. It is a map of how accelerating AI capability could force governments, hyperscalers and investors to treat compute, power and national-security infrastructure as strategic assets.",
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
    bullCase:
      "The playbook is directionally right. AI capability keeps accelerating, compute demand rises, governments fund sovereign AI, hyperscalers continue capex, and power/grid bottlenecks create second-order beneficiaries.",
    bearCase:
      "The playbook is too aggressive. AI progress slows, monetisation disappoints, compute becomes more efficient, regulation delays deployment, or investors reject long-duration AI capex stories.",
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
      { title: "Situational Awareness / AI acceleration framework", checks: "AI timelines, compute, national security, policy implications" },
      { title: "Hyperscaler earnings calls", checks: "capex guidance, cloud AI demand, data-centre buildout", linked: ["MSFT", "AMZN", "GOOGL", "META", "ORCL"] },
      { title: "Semiconductor & compute filings", checks: "GPU demand, networking, custom silicon, supply constraints", linked: ["NVDA", "AMD", "AVGO", "ANET"] },
      { title: "Power & grid sources", checks: "electricity demand, interconnection queues, grid investment", linked: ["VRT", "ETN", "GEV", "ABB.NS", "SIEMENS.NS"] },
      { title: "Defence & policy sources", checks: "sovereign AI, export controls, defence AI, national-security funding", linked: ["PLTR", "LMT", "RTX", "NOC", "HAL.NS", "BEL.NS"] },
    ],
  },
];

export function getPlaybook(id: string): Playbook | undefined {
  return playbooks.find((p) => p.id === id);
}
