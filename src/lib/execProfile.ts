// Turning a name on a roster into a verified person, using Wikidata + Wikipedia.
//
// Yahoo's assetProfile gives a name, a title, an age and a pay figure. It has no
// education, no career history and no photograph — so "who is this CEO" cannot
// be answered from it at any depth. Wikidata can: it holds `educated at`,
// `academic degree`, `employer`, `position held` and a Commons portrait as
// structured claims, and Wikipedia carries a written summary alongside.
//
// The hard part is not fetching. It is being sure the person you found is the
// person you were looking for. "Sanjay Kumar" matches dozens of humans; a
// profile page that confidently attaches the wrong biography to a named
// executive of a real listed company is worse than showing nothing at all —
// it is a false statement about an identifiable person.
//
// So everything here is built around REFUSING a match that is not corroborated.
// A candidate must be a human, and must be tied to the company by its own
// claims or by its Wikipedia summary naming the company. Name similarity alone
// is never enough. The parsing is kept pure and separate from the fetching so
// those rules can be tested, which is the only way to know they hold.

/** Wikidata property + item identifiers used below. */
export const WD = {
  INSTANCE_OF: "P31",
  HUMAN: "Q5",
  EDUCATED_AT: "P69",
  ACADEMIC_DEGREE: "P512",
  EMPLOYER: "P108",
  POSITION_HELD: "P39",
  OCCUPATION: "P106",
  DATE_OF_BIRTH: "P569",
  IMAGE: "P18",
  MEMBER_OF_BOARD: "P3320",
  CHAIRPERSON_OF: "P488",
  FOUNDER_OF: "P112",
  OF: "P642", // qualifier: "<position> of <organisation>"
  // Held by the COMPANY, pointing at people. This is how Wikidata actually
  // records corporate leadership — the person's own item frequently has no
  // employer claim at all.
  CEO: "P169",
  CHAIRPERSON: "P488",
  DIRECTOR_MANAGER: "P1037",
  BOARD_MEMBER: "P3320",
  FOUNDED_BY: "P112",
} as const;

/** Properties on a COMPANY item that name its people. */
export const LEADERSHIP_PROPS = [
  WD.CEO,
  WD.CHAIRPERSON,
  WD.DIRECTOR_MANAGER,
  WD.BOARD_MEMBER,
  WD.FOUNDED_BY,
];

/** Claim-holding properties that can tie a person to an organisation. */
const ORG_LINK_PROPS = [WD.EMPLOYER, WD.MEMBER_OF_BOARD, WD.CHAIRPERSON_OF, WD.FOUNDER_OF];

export interface WikidataEntity {
  id: string;
  labels?: Record<string, { value: string }>;
  descriptions?: Record<string, { value: string }>;
  sitelinks?: Record<string, { title: string }>;
  claims?: Record<string, unknown[]>;
}

export interface ExecProfile {
  /** Wikidata QID, so a caller can always check our work. */
  id: string;
  name: string;
  description?: string;
  /** Institutions, most notable first. */
  education: string[];
  degrees: string[];
  occupations: string[];
  birthYear?: number;
  /** Commons file name, not a URL — the caller builds a proxied URL from it. */
  image?: string;
  /** Wikipedia article title, for the extract and the attribution link. */
  wikiTitle?: string;
  /** Which rule accepted this match. Shown to the reader, not just logged. */
  matchedOn:
    | "company-names-them"
    | "employer-claim"
    | "position-claim"
    | "summary-mentions-company";
}

const claimList = (e: WikidataEntity, prop: string): Record<string, unknown>[] =>
  Array.isArray(e.claims?.[prop]) ? (e.claims[prop] as Record<string, unknown>[]) : [];

/** The QID a claim points at, if it points at an item at all. */
function claimId(claim: Record<string, unknown>): string | undefined {
  const main = claim.mainsnak as { datavalue?: { value?: { id?: string } } } | undefined;
  return main?.datavalue?.value?.id;
}

/** The QIDs a claim's qualifiers point at, for one qualifier property. */
function qualifierIds(claim: Record<string, unknown>, prop: string): string[] {
  const q = claim.qualifiers as Record<string, unknown[]> | undefined;
  const list = Array.isArray(q?.[prop]) ? (q[prop] as Record<string, unknown>[]) : [];
  return list
    .map((s) => (s.datavalue as { value?: { id?: string } } | undefined)?.value?.id)
    .filter((x): x is string => Boolean(x));
}

function claimTime(claim: Record<string, unknown>): string | undefined {
  const main = claim.mainsnak as { datavalue?: { value?: { time?: string } } } | undefined;
  return main?.datavalue?.value?.time;
}

function claimString(claim: Record<string, unknown>): string | undefined {
  const main = claim.mainsnak as { datavalue?: { value?: unknown } } | undefined;
  const v = main?.datavalue?.value;
  return typeof v === "string" ? v : undefined;
}

export function isHuman(e: WikidataEntity): boolean {
  return claimList(e, WD.INSTANCE_OF).some((c) => claimId(c) === WD.HUMAN);
}

/**
 * Strip the noise that stops two names for the same company from matching:
 * honorifics, legal suffixes, punctuation, case.
 */
export function normaliseOrg(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(limited|ltd|plc|inc|incorporated|corporation|corp|company|co|holdings|group|the|and)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** The distinctive words of a company name — what a summary would actually say. */
export function orgTokens(company: string): string[] {
  return normaliseOrg(company).split(" ").filter((t) => t.length >= 3);
}

/** Strip honorifics and punctuation; lowercase. */
export function nameTokens(name: string): string[] {
  return name
    .replace(/^(mr|mrs|ms|dr|prof|shri|smt)\.?\s+/i, "")
    .replace(/\b(jr|sr|ph\.?d|j\.?d|m\.?d|cfa)\b\.?/gi, " ")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Is this Wikidata label the same person as this roster name?
 *
 * Filings and encyclopaedias disagree about given names more often than you
 * would expect: NVIDIA files its chief executive as "Jen-Hsun Huang" and
 * Wikidata calls him "Jensen Huang". Requiring the strings to match loses him.
 *
 * The surname must match exactly — that is the part that does not drift. The
 * given name only has to be consistent: identical, a prefix of the other
 * ("Jen" / "Jensen"), or an initial. Middle names and initials are ignored on
 * both sides.
 */
export function samePerson(rosterName: string, candidate: string): boolean {
  const a = nameTokens(rosterName);
  const b = nameTokens(candidate);
  if (a.length < 2 || b.length < 2) return false;
  if (a[a.length - 1] !== b[b.length - 1]) return false; // surname must agree

  const fa = a[0];
  const fb = b[0];
  if (fa === fb) return true;
  if (fa.length === 1 || fb.length === 1) return fa[0] === fb[0]; // initial
  return fa.startsWith(fb) || fb.startsWith(fa);
}

/** Every person QID a company item names as leadership. */
export function leadershipIds(company: WikidataEntity): string[] {
  const ids = new Set<string>();
  for (const prop of LEADERSHIP_PROPS) {
    for (const c of claimList(company, prop)) {
      const id = claimId(c);
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

/** Labels plus aliases, which is where "Jen-Hsun" usually lives. */
export function allNames(e: WikidataEntity & { aliases?: Record<string, { value: string }[]> }, lang = "en"): string[] {
  const out: string[] = [];
  const label = e.labels?.[lang]?.value;
  if (label) out.push(label);
  for (const a of e.aliases?.[lang] ?? []) if (a?.value) out.push(a.value);
  return out;
}

/**
 * Does this candidate belong to this company?
 *
 * Three ways to say yes, in descending order of strength. Anything else is a
 * no, however well the name matches.
 */
export function verifyMatch(
  entity: WikidataEntity,
  company: string,
  /** QIDs already known to be this company, when the caller could resolve them. */
  companyQids: string[],
  /** The Wikipedia summary extract, when we have it. */
  extract?: string
): ExecProfile["matchedOn"] | null {
  if (!isHuman(entity)) return null;

  if (companyQids.length) {
    const qids = new Set(companyQids);
    for (const prop of ORG_LINK_PROPS) {
      if (claimList(entity, prop).some((c) => qids.has(claimId(c) ?? ""))) return "employer-claim";
    }
    // "position held: CEO" qualified by "of: <company>".
    const positioned = claimList(entity, WD.POSITION_HELD).some((c) =>
      qualifierIds(c, WD.OF).some((id) => qids.has(id))
    );
    if (positioned) return "position-claim";
  }

  // Last resort: the article's own summary names the company. Requires EVERY
  // distinctive word, so "Vedanta Aluminium" is not satisfied by an article
  // that merely says "Vedanta".
  if (extract) {
    const hay = normaliseOrg(extract);
    const toks = orgTokens(company);
    if (toks.length && toks.every((t) => hay.includes(t))) return "summary-mentions-company";
  }

  return null;
}

/**
 * Pull the profile fields out of a verified entity.
 *
 * `labels` maps the QIDs referenced by education/degree/occupation claims to
 * readable names; anything missing from it is dropped rather than shown as a
 * bare QID.
 */
export function buildProfile(
  entity: WikidataEntity,
  matchedOn: ExecProfile["matchedOn"],
  labels: Record<string, string>,
  lang = "en"
): ExecProfile {
  const named = (prop: string): string[] => {
    const seen = new Set<string>();
    const out: string[] = [];
    for (const c of claimList(entity, prop)) {
      const id = claimId(c);
      const label = id ? labels[id] : undefined;
      if (!label || seen.has(label)) continue;
      seen.add(label);
      out.push(label);
    }
    return out;
  };

  const dob = claimList(entity, WD.DATE_OF_BIRTH).map(claimTime).find(Boolean);
  const birthYear = dob ? Number(String(dob).replace(/^[+-]/, "").slice(0, 4)) : undefined;

  return {
    id: entity.id,
    name: entity.labels?.[lang]?.value ?? entity.id,
    description: entity.descriptions?.[lang]?.value,
    education: named(WD.EDUCATED_AT),
    degrees: named(WD.ACADEMIC_DEGREE),
    occupations: named(WD.OCCUPATION).slice(0, 4),
    birthYear: Number.isFinite(birthYear) ? birthYear : undefined,
    image: claimList(entity, WD.IMAGE).map(claimString).find(Boolean),
    wikiTitle: entity.sitelinks?.[`${lang}wiki`]?.title,
    matchedOn,
  };
}

/** Every QID whose label the profile will need. */
export function referencedIds(entity: WikidataEntity): string[] {
  const ids = new Set<string>();
  for (const prop of [WD.EDUCATED_AT, WD.ACADEMIC_DEGREE, WD.OCCUPATION]) {
    for (const c of claimList(entity, prop)) {
      const id = claimId(c);
      if (id) ids.add(id);
    }
  }
  return [...ids];
}

/**
 * Is there enough here to be worth showing?
 *
 * A card with a name and nothing else is not a profile — it is the roster row
 * the reader already had, with more chrome around it.
 */
export function isSubstantive(p: ExecProfile, extract?: string): boolean {
  return Boolean(
    p.education.length || p.degrees.length || (extract && extract.length > 120) || p.image
  );
}
