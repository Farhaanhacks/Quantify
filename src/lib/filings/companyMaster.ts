// One issuer, one record, identified by things that do not change.
//
// No imports, so scripts/test-filings.mjs can compile and drive this.
//
// The identity problem is not theoretical here. HDFC Bank is HDFCBANK on the
// NSE, 500180 on the BSE, INE040A01034 by ISIN, L65920MH1994PLC080618 by CIN,
// and HDB in New York. Five strings, one company. A pipeline that keys on any
// of the first two ends up with two issuers, two sets of filings, and a
// financial history that is missing whichever half went to the other exchange.
//
// So the key is ISIN or CIN. Not the ticker, and the reason is worth stating
// plainly rather than by convention: a ticker is a label an exchange assigns to
// a listing. It is not unique across exchanges, it is reused after a delisting,
// and it changes when a company renames. Preferring it is the same error that
// made a New York depositary receipt outrank the Mumbai shares it is a claim on.

export type IndustryType =
  | "ordinary"
  | "bank"
  | "nbfc"
  | "life-insurer"
  | "general-insurer";

export interface CompanyRecord {
  id: string;
  legalName: string;
  cin?: string;
  isin?: string;
  nseSymbol?: string;
  bseScripCode?: string;
  industryType?: IndustryType;
  homeCountry: string;
  aliases?: string[];
}

const clean = (s?: string) => (s ?? "").trim().toUpperCase();

/** An ISIN is twelve characters: two of country, nine of body, one check digit. */
export function isIsin(s?: string): boolean {
  return /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(clean(s));
}

/**
 * A CIN is twenty-one characters and encodes the company's own history:
 * listing status, industry code, state, year of incorporation, ownership and
 * the registration number.
 */
export function isCin(s?: string): boolean {
  return /^[LU]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}$/.test(clean(s));
}

/**
 * The stable id for a company.
 *
 * ISIN first because it is what every market participant already uses to mean
 * "this security", and CIN second because it identifies the incorporated
 * company even when the security changes. A name is the last resort and is
 * marked as such in the id, so a record built on one is visibly weaker than a
 * record built on an identifier and can be upgraded when a real one arrives.
 */
export function companyKey(c: Partial<CompanyRecord>): string {
  if (isIsin(c.isin)) return `isin:${clean(c.isin)}`;
  if (isCin(c.cin)) return `cin:${clean(c.cin)}`;
  const name = normaliseLegalName(c.legalName ?? "");
  if (name) return `name:${name}`;
  // Deliberately last, and deliberately marked. A ticker-keyed record is a
  // placeholder waiting for an identifier, not an identity.
  if (c.nseSymbol) return `provisional:nse:${clean(c.nseSymbol)}`;
  if (c.bseScripCode) return `provisional:bse:${clean(c.bseScripCode)}`;
  return "";
}

const LEGAL_SUFFIX =
  /\b(limited|ltd|private|pvt|public|company|co|corporation|corp|incorporated|inc|plc|llp)\b/gi;

/** A legal name reduced to the part that identifies the company. */
export function normaliseLegalName(name: string): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(LEGAL_SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface ResolveResult {
  company?: CompanyRecord;
  /** How the match was made, so a weak match is visible as one. */
  matchedOn?: "isin" | "cin" | "nse" | "bse" | "name" | "alias";
}

/**
 * Find the company a filing belongs to, from whatever the filing carries.
 *
 * The order is the order of confidence. A name match is offered last and is
 * labelled, because two different companies can share a normalised name and one
 * of them will be wrong; a caller that cares can refuse anything below an
 * identifier match.
 */
export function resolveCompany(
  master: CompanyRecord[],
  hint: Partial<CompanyRecord>
): ResolveResult {
  if (isIsin(hint.isin)) {
    const m = master.find((c) => clean(c.isin) === clean(hint.isin));
    if (m) return { company: m, matchedOn: "isin" };
  }
  if (isCin(hint.cin)) {
    const m = master.find((c) => clean(c.cin) === clean(hint.cin));
    if (m) return { company: m, matchedOn: "cin" };
  }
  if (hint.nseSymbol) {
    const m = master.find((c) => clean(c.nseSymbol) === clean(hint.nseSymbol));
    if (m) return { company: m, matchedOn: "nse" };
  }
  if (hint.bseScripCode) {
    const m = master.find((c) => clean(c.bseScripCode) === clean(hint.bseScripCode));
    if (m) return { company: m, matchedOn: "bse" };
  }
  const name = normaliseLegalName(hint.legalName ?? "");
  if (name) {
    const exact = master.find((c) => normaliseLegalName(c.legalName) === name);
    if (exact) return { company: exact, matchedOn: "name" };
    const aliased = master.find((c) =>
      (c.aliases ?? []).some((a) => normaliseLegalName(a) === name)
    );
    if (aliased) return { company: aliased, matchedOn: "alias" };
  }
  return {};
}

export interface MergeReport {
  master: CompanyRecord[];
  /** Records that describe a company already present under another identifier. */
  merged: number;
  /** Records that could not be keyed at all. */
  rejected: { record: Partial<CompanyRecord>; reason: string }[];
}

/**
 * Fold new records into the master, joining anything that turns out to be the
 * same issuer.
 *
 * The join is what makes this worth having. A record arriving from the BSE with
 * only a scrip code, and one from the NSE with only a symbol, are the same
 * company the moment either of them carries the ISIN — and a master that stored
 * them separately would have split the company's filing history down the middle
 * without ever raising an error.
 */
export function mergeCompanies(
  existing: CompanyRecord[],
  incoming: Partial<CompanyRecord>[]
): MergeReport {
  const master = existing.map((c) => ({ ...c }));
  const rejected: MergeReport["rejected"] = [];
  let merged = 0;

  for (const raw of incoming) {
    const key = companyKey(raw);
    if (!key) {
      rejected.push({ record: raw, reason: "No ISIN, CIN, name or ticker to key on." });
      continue;
    }
    const found = resolveCompany(master, raw);
    if (found.company) {
      const target = found.company;
      // Identifiers accumulate; they never overwrite. A record that already
      // knows a company's ISIN must not lose it to a later record that does not.
      if (!target.isin && isIsin(raw.isin)) target.isin = clean(raw.isin);
      if (!target.cin && isCin(raw.cin)) target.cin = clean(raw.cin);
      if (!target.nseSymbol && raw.nseSymbol) target.nseSymbol = clean(raw.nseSymbol);
      if (!target.bseScripCode && raw.bseScripCode) target.bseScripCode = clean(raw.bseScripCode);
      if (!target.industryType && raw.industryType) target.industryType = raw.industryType;
      if (raw.legalName && normaliseLegalName(raw.legalName) !== normaliseLegalName(target.legalName)) {
        target.aliases = Array.from(new Set([...(target.aliases ?? []), raw.legalName]));
      }
      // The id follows the strongest identifier the record now has, so a
      // company keyed on its name is promoted the moment an ISIN turns up.
      const upgraded = companyKey(target);
      if (upgraded && upgraded !== target.id && !upgraded.startsWith("name:")) target.id = upgraded;
      merged++;
      continue;
    }
    if (!raw.legalName) {
      rejected.push({ record: raw, reason: "No legal name." });
      continue;
    }
    master.push({
      id: key,
      legalName: raw.legalName,
      cin: isCin(raw.cin) ? clean(raw.cin) : undefined,
      isin: isIsin(raw.isin) ? clean(raw.isin) : undefined,
      nseSymbol: raw.nseSymbol ? clean(raw.nseSymbol) : undefined,
      bseScripCode: raw.bseScripCode ? clean(raw.bseScripCode) : undefined,
      industryType: raw.industryType,
      homeCountry: raw.homeCountry ?? "IN",
      aliases: raw.aliases,
    });
  }
  return { master, merged, rejected };
}

/** Records that share an identifier with another record. Always a data error. */
export function findConflicts(master: CompanyRecord[]): string[] {
  const problems: string[] = [];
  for (const field of ["isin", "cin", "nseSymbol", "bseScripCode"] as const) {
    const seen = new Map<string, string>();
    for (const c of master) {
      const v = clean(c[field]);
      if (!v) continue;
      const owner = seen.get(v);
      if (owner && owner !== c.id) {
        problems.push(`${field} ${v} is claimed by both ${owner} and ${c.id}.`);
      } else {
        seen.set(v, c.id);
      }
    }
  }
  return problems;
}
