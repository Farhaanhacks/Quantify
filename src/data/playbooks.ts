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
