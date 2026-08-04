// The "Undervalued Finds" scanner universe — a hand-picked spread across sectors
// where price-target gaps often show up. It's grouped BY SECTOR (not a flat
// list) so the scanner can explain, sector by sector, how each group tends to
// behave if the 2026 AI-bubble debate resolves to the downside. The order is
// deliberate: precious-metals miners first (the classic safe haven), then the
// AI/tech names most exposed to a bubble, then defensive healthcare, then the
// rest. EDUCATIONAL RESEARCH ONLY — not advice. Every "upside" the scanner shows
// is just the analyst price-target gap, a research starting point.

export interface CandidateSector {
  id: string;
  name: string;
  // A short, plain-English framing of how this sector tends to behave — and its
  // key risk — in the context of the AI-bubble debate. Educational, not advice.
  blurb: string;
  tickers: string[];
}

export const CANDIDATE_SECTORS: CandidateSector[] = [
  {
    id: "precious-metals",
    name: "Precious metals & mining",
    blurb:
      "Gold — and the miners geared to it — is the classic safe-haven trade, which is exactly why it sits first here. The full logic: today's market is unusually concentrated in a handful of expensive AI and mega-cap tech names. If that trade unwinds (analysts model 20–50% drawdowns in the AI leaders), the money doesn't vanish — it rotates. In a risk-off panic investors sell speculative growth and crowd into things that hold value when everything else falls: cash, government bonds and, above all, gold. Gold has no earnings to disappoint and no valuation multiple to compress, so it tends to hold or rise precisely when equities are being dumped. Gold *miners* add leverage on top — their mining costs are broadly fixed, so when the gold price rises their profits rise faster, and a higher gold price drops almost straight to the bottom line. That's why a small sleeve of gold miners can act as portfolio insurance: if the AI-led market keeps climbing they may lag, but if it cracks, safe-haven demand can send gold — and the miners leveraged to it — sharply higher just as the rest of a growth-heavy book is falling. Risk: miners are volatile and high-beta to the metal price; operational or cost missteps can erase the hedge, and in a calm melt-up market this sleeve is a drag. (One name here, Freeport, is copper-led with gold as a by-product — copper is a pro-cyclical industrial metal, not a safe haven, so treat it differently from the pure gold miners.)",
    tickers: ["NEM", "GOLD", "IAG", "FCX"],
  },
  {
    id: "tech-ai",
    name: "Technology & AI",
    blurb:
      "This is the eye of the storm. Heading into 2026 an AI-driven valuation crash is the single most-cited market risk — roughly half to a majority of surveyed fund managers now call AI the market's biggest tail risk. Enormous capital is being poured into AI infrastructure on the assumption that AI revenue will eventually justify it; if that revenue disappoints, or hyperscalers pause the spend, the whole complex — chips, software and anything priced for perfection — can re-rate lower together. These names are here because they screen as reasonably valued *relative* to that froth (memory and analog chips, marketing and automation software), not because they're immune. Own them understanding that if the AI trade corrects they will likely fall with it — the thesis is only that they're cheaper, more grounded in real earnings, and better placed to survive and compound than the hyped mega-cap leaders. Risk: a broad AI-capex pullback or multiple compression hits the entire sector at once, and today's leaders can become tomorrow's laggards fast.",
    tickers: ["MU", "ON", "ZETA", "TEAM", "PATH"],
  },
  {
    id: "quantum",
    name: "Quantum computing",
    blurb:
      "Pure-play quantum computing — these companies do essentially nothing except build quantum machines, so this is a binary, long-dated bet. If quantum crosses the chasm from lab science into commercial viability, the winners could compound exponentially off a tiny base; if it stays a research project, they burn cash and dilute holders. They're in a deep R&D phase, so expect extreme volatility and a real risk of permanent loss — size this as speculative money only. It's largely uncorrelated to the AI-software bubble on the way up, but it is NOT a safe haven: in a risk-off crash, unprofitable frontier tech usually falls hardest. The names here — IonQ (IONQ), the first pure-play hardware maker to go public, using trapped-ion tech natively integrated across AWS, Azure and Google Cloud with strong commercial-booking momentum; D-Wave (QBTS), focused on quantum annealing for optimization problems like logistics and finance; and Rigetti (RGTI), building modular superconducting chips — the latter two being small-cap, highly speculative SPAC alumni. IBM is the structured enterprise play: a fully transparent public roadmap, the dominant open-source quantum software network (Qiskit) and globally deployed systems like its 133-qubit Heron chip — plus a dividend to collect while the technology matures. (Quantinuum — the Honeywell / Cambridge Quantum pure-play with some of the industry's highest operational fidelities and a Microsoft logical-qubit partnership — is not yet publicly traded; only an IPO has been signalled, so it can't be scanned here. Honeywell (HON) offers partial indirect exposure.) Risk: most of these are pre-profit and cash-burning, technical timelines routinely slip, and a single setback or capital raise can halve a stock overnight.",
    tickers: ["IONQ", "IBM", "QBTS", "RGTI"],
  },
  {
    id: "healthcare",
    name: "Healthcare",
    blurb:
      "Healthcare is a classic defensive safe haven: people need medicine and care regardless of the economic cycle or what the stock market is doing, so revenues and dividends here are far less sensitive to a recession or an AI-driven sell-off. Many large-cap pharma and health names also trade on modest valuations with healthy dividend yields — less multiple to compress if growth stocks de-rate. In an uncertain, late-cycle market that makes them useful ballast, tending to hold up better than speculative growth when sentiment turns. Risk: drug-pricing politics, patent cliffs (blockbusters losing exclusivity), pipeline and clinical-trial disappointments, and for the insurers/pharmacies, margin and regulatory pressure. Defensive is not risk-free.",
    tickers: ["PFE", "BMY", "GILD", "CVS", "VTRS"],
  },
  {
    id: "energy",
    name: "Energy & power",
    blurb:
      "Energy is the physical fuel of the AI build-out — datacenters need enormous, reliable power, and natural gas plus the pipelines, grid and efficiency projects that move and save it are direct beneficiaries. That gives this sector a genuine link to the AI theme that doesn't depend on software multiples holding up, and it doubles as a partial inflation and geopolitical hedge. Risk: these are commodity businesses — a warm winter, weak gas or oil prices, or an eventual AI-capex slowdown feeding through to power demand can gut earnings, and cash flows are cyclical and volatile.",
    tickers: ["EXE", "DVN", "OXY", "KMI", "CTRA", "AMRC"],
  },
  {
    id: "financials",
    name: "Financials & fintech",
    blurb:
      "A mixed sleeve — an exchange operator whose fee income actually rises with volatility, plus consumer lenders and a digital-first fintech. The exchange is relatively defensive and can even benefit from turbulent, high-volume markets; the consumer lenders are the opposite, geared to the credit cycle, so a recession that lifts loan losses would hit them. Risk: for the lenders, rising charge-offs and credit deterioration in a downturn; more broadly, sensitivity to interest rates and the health of the consumer.",
    tickers: ["ICE", "SOFI", "COF", "ALLY"],
  },
  {
    id: "materials-ag",
    name: "Materials & agriculture",
    blurb:
      "Fertilizer and crop-nutrient producers — a bet on food security and the agricultural cycle rather than the tech tape, which leaves them fairly uncorrelated to an AI-led sell-off. Pricing is driven by crop prices, planting demand and global supply (including disruptions abroad). Risk: these are cyclical commodity businesses — nutrient prices swing hard, and a bumper supply year or weak crop prices compresses margins quickly.",
    tickers: ["MOS", "CF"],
  },
  {
    id: "media",
    name: "Media & communications",
    blurb:
      "Legacy media caught mid-transition — shifting from cable and linear TV to streaming, carrying heavy debt, with consolidation speculation swirling. These are turnaround / special-situation names: cheap on the numbers, but cheap for reasons. Risk: cord-cutting keeps shrinking the legacy cash cow faster than streaming can replace it, debt loads are high, and any takeover thesis may not materialise — value can stay trapped for a long time.",
    tickers: ["WBD", "PARA"],
  },
  {
    id: "space",
    name: "Space & frontier tech",
    blurb:
      "The highest-risk, highest-variance sleeve — satellite imagery, rocket launch and space-based connectivity. Genuinely disruptive addressable markets, but mostly pre-profit and cash-burning, so they lean on execution and continued access to capital. They behave like long-dated options: they can multiply or halve on a single milestone. Risk: dilution, technical and launch failures, and extreme volatility — size them as speculative, not core.",
    tickers: ["PL", "RKLB", "ASTS"],
  },
  {
    id: "other",
    name: "Other & special situations",
    blurb:
      "Names that don't fit a single clean bucket — judge each on its own merits using the live analyst data and the full analysis page. As always, a large gap to the analyst target is a starting point for research, not a recommendation.",
    tickers: ["BOBS"],
  },
];

// Flattened list kept for the scanner's fetch loop and progress count.
export const UNDERVALUED_CANDIDATES: string[] = CANDIDATE_SECTORS.flatMap((s) => s.tickers);
