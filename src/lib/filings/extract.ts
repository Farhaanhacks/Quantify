import { parseXbrl, type XbrlDocument } from "@/lib/filings/parsers/xbrl";
import { conceptFor, PERCENTAGE_CONCEPTS, type IndustryType } from "@/lib/filings/concepts";
import {
  validateFacts,
  checkIdentities,
  type FilingContext,
  type ValidationIssue,
} from "@/lib/filings/validate";
import { PARSER_VERSION, type FilingFact } from "@/lib/filings/types";

// Parse, map, validate. The glue, deliberately thin.
//
// Everything with a decision in it lives in a module of its own that imports
// nothing, so it can be compiled and driven from a script against saved
// documents. That split matters more here than anywhere else in the codebase:
// there is no way to reach an exchange from a development machine without a
// licensed feed, so the only honest way to build this is against filings that
// have been read by eye first and kept as fixtures.

export interface ExtractionResult {
  facts: FilingFact[];
  /** Facts that were read but must not be published, with the reason. */
  rejected: FilingFact[];
  issues: ValidationIssue[];
  /** Tags the document carried that we have no mapping for at all. */
  unmapped: string[];
  document?: XbrlDocument;
  errors: string[];
}

/**
 * Turn one XBRL instance document into facts this app can use.
 *
 * The industry is an INPUT, not something inferred from the document. Reading it
 * out of the filing would be circular: the reason a bank's filing is full of
 * deposit tags is that it is a bank, and using those tags to decide it is a bank
 * means any mis-tagged document defines its own truth. The classification comes
 * from the company master, where it can be checked.
 */
export function extractFromXbrl(
  xml: string,
  meta: {
    filingId: string;
    companyId: string;
    industry: IndustryType;
    /** The period the filing is FOR, so comparatives can be told apart. */
    periodEnd?: string;
    expectedPeriodMonths?: number;
    scope?: "standalone" | "consolidated";
  }
): ExtractionResult {
  const doc = parseXbrl(xml);
  if (doc.errors.length && !doc.facts.length) {
    return { facts: [], rejected: [], issues: [], unmapped: [], document: doc, errors: doc.errors };
  }

  const unmapped = new Set<string>();
  const mapped: (FilingFact & { conceptIndustryMismatch?: string[] })[] = [];

  for (const f of doc.facts) {
    const match = conceptFor(f.tag, meta.industry);
    if (!match.concept && !match.mismatchedIndustries?.length) {
      unmapped.add(f.tag);
      continue;
    }
    const ctx = doc.contexts.get(f.contextRef);
    const unit = f.unitRef ? doc.units.get(f.unitRef) : undefined;
    const concept = match.concept ?? f.tag;

    mapped.push({
      filingId: meta.filingId,
      companyId: meta.companyId,
      concept,
      sourceConcept: f.tag,
      // A nil fact is the filer saying the figure does not exist, which is
      // different from a figure we failed to read, and different again from
      // zero. It is carried through with no value rather than dropped.
      numericValue: f.nil ? undefined : f.value,
      unit: PERCENTAGE_CONCEPTS.has(concept) ? "percent" : unit,
      currency: unit && /^[A-Z]{3}$/.test(unit) ? unit : undefined,
      periodStart: ctx?.startDate,
      periodEnd: ctx?.endDate ?? ctx?.instant,
      // The context's own scope wins over the document's: a filing can carry
      // both books, and the context is the more specific statement.
      scope: ctx?.scope ?? doc.documentScope ?? meta.scope,
      sourceXPath: `//${f.tag}[@contextRef='${f.contextRef}']`,
      method: "xbrl",
      // A tagged fact is what the filer asserted. Nothing was inferred, so
      // nothing is discounted.
      confidence: 1,
      conceptIndustryMismatch: match.concept ? undefined : match.mismatchedIndustries,
      rejectedReason: f.nil ? "The filer tagged this figure as not applicable." : undefined,
    });
  }

  const ctx: FilingContext = {
    periodEnd: meta.periodEnd,
    expectedPeriodMonths: meta.expectedPeriodMonths,
    scope: meta.scope,
    industry: meta.industry,
  };
  const { facts, issues } = validateFacts(mapped, ctx);

  const good = facts.filter((f) => !f.rejectedReason);
  const rejected = facts.filter((f) => !!f.rejectedReason);

  // Cross-fact arithmetic, over the survivors only. Running it over rejected
  // facts would report identity failures caused by figures we had already
  // decided not to trust, which buries the real ones.
  const byConcept: Record<string, number | undefined> = {};
  for (const f of good) {
    if (f.numericValue != null && byConcept[f.concept] == null) byConcept[f.concept] = f.numericValue;
  }
  const identityIssues = checkIdentities(byConcept);

  return {
    facts: good.map(({ conceptIndustryMismatch: _drop, ...f }) => f),
    rejected: rejected.map(({ conceptIndustryMismatch: _drop, ...f }) => f),
    issues: [...issues, ...identityIssues],
    unmapped: Array.from(unmapped).sort(),
    document: doc,
    errors: doc.errors,
  };
}

export { PARSER_VERSION };
