// ─────────────────────────────────────────────────────────────────────────────
// News → impact map
// A keyless, client-safe intelligence layer that turns a *live* news article
// (headline + summary + detected tickers) into a structured Quantifi impact
// map: what changed, why it matters, a causal chain, affected-name cards,
// linked research themes, what to watch and a signal classification.
//
// This generates fields on the fly from the text — it does NOT depend on any
// curated per-article data, so it works for the live feed. When the text is
// thin, it degrades to sensible, honest defaults rather than inventing facts.
// ─────────────────────────────────────────────────────────────────────────────

export type Tone = "positive" | "negative" | "mixed" | "neutral";
export type Level = "Low" | "Medium" | "High";

export interface AffectedName {
  ticker: string;
  role: string;
  why: string;
  impact: Level;
  confidence: Level;
  watch: string;
  primary: boolean;
}

export interface LinkedTheme {
  id: string;
  label: string;
}

export interface NewsImpactAnalysis {
  tone: Tone;
  impact: Level;
  confidence: number; // 0–100
  whatChanged: string;
  whyItMatters: string;
  impactMap: string[];
  affected: AffectedName[];
  themes: LinkedTheme[];
  watchNext: string[];
  signalType: string;
  thesisRelevance: Level;
  timeHorizon: string;
}

// ── Tone ─────────────────────────────────────────────────────────────────────
const POS = ["surge", "jump", "gain", "beat", "rally", "soar", "record", "upgrade", "profit", "rise", "rose", "boost", "outperform", "strong", "high", "win", "wins", "approval", "expand"];
const NEG = ["plunge", "fall", "fell", "drop", "miss", "cut", "loss", "downgrade", "slump", "crash", "lawsuit", "probe", "warn", "weak", "decline", "tumble", "sink", "fear", "selloff", "sell-off", "delay", "halt", "ban", "fine"];

export function toneOf(text: string): Tone {
  const t = text.toLowerCase();
  let p = 0;
  let n = 0;
  for (const w of POS) if (t.includes(w)) p++;
  for (const w of NEG) if (t.includes(w)) n++;
  if (p > 0 && n > 0) return "mixed";
  if (p > 0) return "positive";
  if (n > 0) return "negative";
  return "neutral";
}

// ── Category ─────────────────────────────────────────────────────────────────
type Category = "earnings" | "ma" | "regulatory" | "macro" | "analyst" | "product" | "general";

function categoryOf(text: string): Category {
  const t = text.toLowerCase();
  if (/earnings|results|revenue|quarter|guidance|\beps\b|profit|margin|forecast|outlook/.test(t)) return "earnings";
  if (/acquir|merger|buyout|takeover|\bstake\b|\bdeal\b|spin-?off/.test(t)) return "ma";
  if (/lawsuit|probe|investigat|regulat|antitrust|\bfine\b|\bban\b|\bsue\b|court|subpoena|\bsec\b/.test(t)) return "regulatory";
  if (/\bfed\b|interest rate|rate cut|rate hike|inflation|\bcpi\b|jobs report|\bgdp\b|tariff|\byield(s)?\b|treasury/.test(t)) return "macro";
  if (/upgrade|downgrade|price target|analyst|\brating\b|initiate|overweight|underweight|buy rating/.test(t)) return "analyst";
  if (/launch|unveil|\bproduct\b|\bchip\b|partnership|\bmodel\b|release|rollout|contract|award/.test(t)) return "product";
  return "general";
}

// ── Themes ───────────────────────────────────────────────────────────────────
const THEME_RULES: { re: RegExp; themes: LinkedTheme[] }[] = [
  { re: /\bai\b|artificial intelligence|cloud|data ?cent(er|re)|\bgpu\b|accelerator|compute|openai|nvidia|inference|training|hyperscal/i,
    themes: [{ id: "ai-power-bottleneck", label: "AI Power Bottleneck" }, { id: "sovereign-ai-stacks", label: "Sovereign AI Stacks" }] },
  { re: /bubble|circular|vendor financing|overvalued|stretched valuation|priced for perfection/i,
    themes: [{ id: "great-company-dangerous-price", label: "Great Company, Dangerous Price" }] },
  { re: /chip|semiconductor|foundry|tsmc|wafer|lithograph|fab\b/i,
    themes: [{ id: "ai-power-bottleneck", label: "AI Power Bottleneck" }, { id: "global-industrial-rebuild", label: "Global Industrial Rebuild" }] },
  { re: /\bev\b|electric vehicle|battery|lithium|charging/i,
    themes: [{ id: "china-ev-shockwave", label: "China EV Shockwave" }, { id: "battery-storage-beyond-evs", label: "Battery Storage Beyond EVs" }] },
  { re: /defen[cs]e|military|missile|weapon|\bwar\b|army|navy|fighter jet/i,
    themes: [{ id: "global-defence-rearmament", label: "Global Defence Re-Armament" }] },
  { re: /space|satellite|orbit|rocket|launch provider/i,
    themes: [{ id: "spacex-orbital-internet", label: "SpaceX & Orbital Internet" }] },
  { re: /robot|humanoid|automation/i,
    themes: [{ id: "physical-ai-robotics", label: "Physical AI & Robotics" }] },
  { re: /factory|manufactur|industrial|infrastructure|power grid|electric grid|\bgrid\b|capex/i,
    themes: [{ id: "global-industrial-rebuild", label: "Global Industrial Rebuild" }] },
  { re: /weight ?loss|\bglp-?1\b|obesity|ozempic|wegovy|pharma|\bdrug\b|biotech/i,
    themes: [{ id: "glp1-health-repricing", label: "GLP-1 Health Repricing" }] },
  { re: /payment|\bexchange\b|fintech|toll|platform fee|marketplace|interchange/i,
    themes: [{ id: "market-toll-booths", label: "Market Toll Booths" }] },
  { re: /\bipo\b|listing|debut|newly public|going public/i,
    themes: [{ id: "post-hype-ipo-survivors", label: "Post-Hype IPO Survivors" }] },
  { re: /rare earth|critical mineral|copper|cobalt|mining|lithium supply/i,
    themes: [{ id: "critical-minerals", label: "Critical Minerals & Resource Security" }] },
  { re: /\bagent(s|ic)?\b|superapp|quick commerce|app\b/i,
    themes: [{ id: "internet-2-0", label: "Internet 2.0: Agents & Superapps" }] },
];

function themesOf(text: string): LinkedTheme[] {
  const seen = new Set<string>();
  const out: LinkedTheme[] = [];
  for (const rule of THEME_RULES) {
    if (rule.re.test(text)) {
      for (const th of rule.themes) {
        if (!seen.has(th.id)) {
          seen.add(th.id);
          out.push(th);
        }
      }
    }
  }
  return out.slice(0, 4);
}

// ── Category-driven copy ─────────────────────────────────────────────────────
const WATCH_BY_CAT: Record<Category, string[]> = {
  earnings: ["revenue growth", "forward guidance", "operating margins", "backlog / bookings"],
  ma: ["deal terms and price", "regulatory approval path", "accretion / dilution", "financing structure"],
  regulatory: ["scope of the review", "new filings or disclosures", "any fines or remedies", "management commentary"],
  macro: ["the rate path", "sector breadth of the move", "fund flows", "next data print"],
  analyst: ["consensus estimate revisions", "spread of price targets", "whether fundamentals follow", "next earnings print"],
  product: ["launch traction / adoption", "design wins or contracts", "competitive response", "margin on new lines"],
  general: ["upcoming results and guidance", "follow-on coverage", "sector read-through", "management commentary"],
};

const SIGNAL_BY_CAT: Record<Category, { type: string; relevance: Level; horizon: string }> = {
  earnings: { type: "Fundamental / Earnings", relevance: "High", horizon: "Plays out over the next 1–2 prints" },
  ma: { type: "Event-driven / Corporate action", relevance: "High", horizon: "Until the deal closes or breaks" },
  regulatory: { type: "Regulatory / Event", relevance: "High", horizon: "Until a filing or formal finding follows" },
  macro: { type: "Macro", relevance: "Medium", horizon: "Days to weeks, with the cycle" },
  analyst: { type: "Sentiment / Narrative", relevance: "Low", horizon: "Short-term — sentiment, not fundamentals" },
  product: { type: "Event-driven", relevance: "Medium", horizon: "Longer-term growth story" },
  general: { type: "Sentiment / Narrative", relevance: "Low", horizon: "Short-term, unless confirmed by filings or guidance" },
};

const CONF_BASE: Record<Category, number> = {
  earnings: 74, ma: 76, regulatory: 66, macro: 58, analyst: 56, product: 62, general: 50,
};

const IMPACT_BASE: Record<Category, Level> = {
  earnings: "High", ma: "High", regulatory: "Medium", macro: "Medium", analyst: "Medium", product: "Medium", general: "Low",
};

function notch(level: Level, down = true): Level {
  const order: Level[] = ["Low", "Medium", "High"];
  const i = order.indexOf(level);
  return order[Math.max(0, Math.min(2, i + (down ? -1 : 1)))];
}

function driverFor(themes: LinkedTheme[]): { driver: string; narrative: string; sector: string } {
  const ids = themes.map((t) => t.id);
  if (ids.includes("ai-power-bottleneck") || ids.includes("sovereign-ai-stacks"))
    return { driver: "AI demand, data-centre capacity and large customer commitments", narrative: "AI infrastructure story", sector: "AI infrastructure" };
  if (ids.includes("china-ev-shockwave") || ids.includes("battery-storage-beyond-evs"))
    return { driver: "unit demand, pricing and battery economics", narrative: "EV growth story", sector: "EV / battery" };
  if (ids.includes("spacex-orbital-internet"))
    return { driver: "launch cadence, backlog and contract wins", narrative: "space-economy story", sector: "space" };
  if (ids.includes("global-defence-rearmament"))
    return { driver: "defence budgets and order backlog", narrative: "rearmament story", sector: "defence" };
  if (ids.includes("glp1-health-repricing"))
    return { driver: "drug demand, pricing and pipeline", narrative: "healthcare repricing story", sector: "healthcare" };
  if (ids.includes("global-industrial-rebuild"))
    return { driver: "capex cycles and reshoring demand", narrative: "industrial-rebuild story", sector: "industrials" };
  return { driver: "its growth and margin outlook", narrative: "investment case", sector: "the sector" };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export function analyzeNews(input: { title: string; summary: string; tickers: string[] }): NewsImpactAnalysis {
  const text = `${input.title} ${input.summary}`;
  const titleLower = input.title.toLowerCase();
  const tone = toneOf(text);
  const category = categoryOf(text);
  const themes = themesOf(text);
  const tickers = input.tickers.slice(0, 6);
  const primary = tickers[0];
  const names = tickers.length ? tickers.slice(0, 3).join(", ") : "the broader market";
  const { driver, narrative, sector } = driverFor(themes);

  // Impact level — base on category, bump on strong sentiment.
  let impact = IMPACT_BASE[category];
  const strong = (text.match(new RegExp(`\\b(${[...POS, ...NEG].join("|")})\\b`, "gi")) ?? []).length;
  if (strong >= 2 && impact !== "High") impact = notch(impact, false);

  // Confidence — base on category, raise when a name is in the headline itself.
  let confidence = CONF_BASE[category];
  const nameInTitle = tickers.some((t) => new RegExp(`\\b${t.replace(/\.(NS|BO)$/, "")}\\b`, "i").test(titleLower));
  if (nameInTitle) confidence += 9;
  if (tickers.length >= 2) confidence += 4;
  if (themes.length) confidence += 3;
  confidence = Math.max(45, Math.min(88, confidence));

  // What changed.
  const changedByCat: Record<Category, string> = {
    earnings: `An earnings or guidance item landed for ${names} — results and outlook are the fastest-moving inputs to a stock.`,
    ma: `A deal, stake change or corporate action involving ${names} — transactions reprice the names involved and often their peers.`,
    regulatory: `A legal or regulatory development touching ${names} — headlines like this can weigh on sentiment beyond the case itself.`,
    macro: `A macro development (rates, inflation or policy) that tends to move whole sectors, not just ${names}.`,
    analyst: `An analyst rating or price-target change on ${names} — a sentiment nudge rather than a fundamental shift.`,
    product: `A product, chip, contract or partnership update from ${names} — the kind of news that shapes the longer-term growth story.`,
    general: `A market headline referencing ${names}.`,
  };
  const whatChanged = changedByCat[category];

  // Why it matters — specific to the primary name + its theme driver.
  const pushVerb = tone === "positive" ? "support" : tone === "negative" ? "pressure" : "swing";
  const whyItMatters = primary
    ? `${primary} is valued partly on ${driver}. A ${SIGNAL_BY_CAT[category].type.split(" / ")[0].toLowerCase()} headline like this can ${pushVerb} sentiment around its ${narrative}, even if the direct fundamental impact is not yet clear.`
    : `This reads through to ${sector} sentiment broadly rather than to one name — treat it as context for the names you hold in the space.`;

  // Impact map — the causal chain.
  const toneMove = tone === "positive" ? "improves" : tone === "negative" ? "weakens" : "wobbles";
  const questioned = tone === "positive" ? "is reinforced" : "is questioned";
  const impactMap = [
    `${cap(tone)} ${category === "general" ? "market" : category} signal`,
    `${cap(sector)} sentiment ${toneMove}`,
    primary ? `${primary}’s ${narrative} ${questioned}` : `Names across ${sector} re-rate on the read-through`,
    primary
      ? `${primary}${tickers.length > 1 ? ` and ${tickers.length - 1} other name${tickers.length - 1 > 1 ? "s" : ""}` : ""} affected`
      : "Sector ETFs absorb the move",
  ];

  // Affected-name cards.
  const watchStr = WATCH_BY_CAT[category].slice(0, 4).join(", ");
  const affected: AffectedName[] = tickers.map((t, i) => {
    const isPrimary = i === 0;
    return {
      ticker: t,
      role: isPrimary
        ? `Most exposed — ${sector === "the sector" ? "directly named" : `${sector} exposure`}`
        : "Sector peer — read-through",
      why: isPrimary
        ? `Named or central to the story; ${pushVerb}s the ${narrative}.`
        : `Moves on sentiment spillover from ${primary ?? "the lead name"}, not a direct catalyst.`,
      impact: isPrimary ? impact : notch(impact, true),
      confidence: isPrimary ? (nameInTitle ? "High" : "Medium") : "Low",
      watch: watchStr,
      primary: isPrimary,
    };
  });

  // What to watch next — category metrics, plus theme/AI specifics + the call.
  const watchNext = [...WATCH_BY_CAT[category]];
  if (themes.some((th) => th.id === "ai-power-bottleneck")) watchNext.push("AI contracts, capex and RPO / backlog");
  watchNext.push("commentary on the next earnings call");

  const sig = SIGNAL_BY_CAT[category];

  return {
    tone,
    impact,
    confidence,
    whatChanged,
    whyItMatters,
    impactMap,
    affected,
    themes,
    watchNext: watchNext.slice(0, 6),
    signalType: sig.type,
    thesisRelevance: sig.relevance,
    timeHorizon: sig.horizon,
  };
}
