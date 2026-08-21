// The checks a figure must survive before anyone is shown it.
//
// No imports, so scripts/test-filings.mjs can compile and drive this.
//
// Every rule here exists because the failure it catches is INVISIBLE. That is
// the whole selection criterion. A parser that crashes tells you it crashed; a
// parser that reads a nine-month column as a quarter, or a figure in lakhs as
// rupees, or last year's comparative as this year's result, hands back a number
// that is the right shape, the right sign and the right order of magnitude for
// a plausible company, and nothing downstream will ever question it.
//
// The rule that governs all of them: a fact that fails is marked rejected and
// KEPT, with its reason. It is never deleted, never rounded, and above all never
// turned into a zero. A zero is a claim about the company. "We could not verify
// this" is a claim about us, and only one of those is true.

export type ReportingScope = "standalone" | "consolidated";

export interface FactToCheck {
  concept: string;
  sourceConcept?: string;
  numericValue?: number;
  unit?: string;
  currency?: string;
  periodStart?: string;
  periodEnd?: string;
  scope?: ReportingScope;
  /** Industries this tag belongs to, when it did not belong to this one. */
  conceptIndustryMismatch?: string[];
  rejectedReason?: string;
}

export interface FilingContext {
  /** The period the document is FOR, so comparatives can be told apart. */
  periodEnd?: string;
  /** How many months the headline column covers: 3, 6, 9 or 12. */
  expectedPeriodMonths?: number;
  scope?: ReportingScope;
  /** What the figures are denominated in, once the header has been read. */
  scale?: number;
  industry?: string;
}

const DAY = 86400000;

/** Months between two dates, rounded to the nearest whole month. */
export function monthsBetween(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  const a = Date.parse(start);
  const b = Date.parse(end);
  if (!isFinite(a) || !isFinite(b) || b < a) return undefined;
  return Math.round((b - a) / DAY / 30.44);
}

/**
 * The multiplier a filing's header implies.
 *
 * Indian statements are almost never in rupees. "(₹ in crore)" sits above the
 * table and every figure below it is a ten-millionth of its real self, so a bank
 * with ₹40 lakh crore of assets tags as 4,000,000 and reads as a corner shop.
 * Nothing about that number looks wrong on its own, which is precisely why it
 * has to be read off the header rather than guessed at from the value.
 */
export function detectScale(headerText: string): number {
  const t = (headerText ?? "").toLowerCase();
  if (/\bcrores?\b|\bcr\.?\b/.test(t)) return 1e7;
  if (/\blakhs?\b|\blacs?\b/.test(t)) return 1e5;
  if (/\bmillions?\b|\bmn\b/.test(t)) return 1e6;
  if (/\bbillions?\b|\bbn\b/.test(t)) return 1e9;
  if (/\bthousands?\b|'000/.test(t)) return 1e3;
  return 1;
}

/** Concepts that cannot be negative on any honest balance sheet. */
const NON_NEGATIVE = new Set([
  "totalAssets",
  "shareholderEquity",
  "cashAndEquivalents",
  "deposits",
  "advances",
  "grossAdvances",
  "loanBook",
  "investments",
  "grossNpa",
  "netNpa",
  "riskWeightedAssets",
  "grossPremium",
  "grossWrittenPremium",
]);

/** Concepts that are percentages, and therefore have a plausible band. */
const PERCENTAGE = new Set([
  "grossNpaRatio",
  "netNpaRatio",
  "provisionCoverageRatio",
  "capitalAdequacyRatio",
  "tier1Ratio",
  "cet1Ratio",
  "crar",
  "stage3Ratio",
  "liquidityCoverageRatio",
  "solvencyRatio",
  "claimSettlementRatio",
  "persistency13m",
  "persistency61m",
  "claimsRatio",
  "expenseRatio",
  "combinedRatio",
]);

/**
 * A listed company's balance sheet does not total less than this.
 *
 * The smallest company on either Indian exchange runs to crores, so a total-
 * assets figure of a few thousand is a scaling error rather than a very small
 * company. Set low enough that it only fires on genuine unit mistakes.
 */
const MIN_PLAUSIBLE_BALANCE_SHEET = 1e7;

export interface ValidationIssue {
  concept: string;
  reason: string;
}

export interface ValidationResult<T> {
  facts: T[];
  /** Facts that were rejected, and why. Kept for the error dashboard. */
  issues: ValidationIssue[];
  /** Facts that are prior-period comparatives rather than this filing's result. */
  comparatives: number;
}

/**
 * Check every fact against everything that can be known from the fact alone,
 * plus what the filing says about itself.
 *
 * Cross-fact checks are separate (see checkIdentities) because they need the
 * whole set, and a fact can be individually sound and jointly impossible.
 */
export function validateFacts<T extends FactToCheck>(
  facts: T[],
  ctx: FilingContext = {}
): ValidationResult<T> {
  const issues: ValidationIssue[] = [];
  let comparatives = 0;
  const reject = (f: T, reason: string) => {
    f.rejectedReason = reason;
    issues.push({ concept: f.concept, reason });
  };

  for (const f of facts) {
    if (f.rejectedReason) {
      issues.push({ concept: f.concept, reason: f.rejectedReason });
      continue;
    }
    const v = f.numericValue;

    // 9. The tag belongs to a different kind of company.
    //
    // Reported rather than mapped. A filing full of deposit tags from a company
    // classified as a manufacturer means the classification or the document is
    // wrong, and mapping it anyway would bury the contradiction in the data.
    if (f.conceptIndustryMismatch?.length) {
      reject(
        f,
        `Tag "${f.sourceConcept ?? f.concept}" belongs to a ${f.conceptIndustryMismatch.join(" or ")} filing, not to this company's industry.`
      );
      continue;
    }

    if (v == null || !isFinite(v)) {
      reject(f, "No numeric value could be read.");
      continue;
    }

    // 5. A negative where none can exist.
    if (NON_NEGATIVE.has(f.concept) && v < 0) {
      reject(f, `${f.concept} cannot be negative; read as ${v}.`);
      continue;
    }

    // 1. Units. A percentage outside its band, or a balance sheet too small to
    //    belong to a listed company, is a scaling error and not a small company.
    if (PERCENTAGE.has(f.concept)) {
      if (v < 0 || v > 500) {
        reject(f, `${f.concept} of ${v}% is outside any plausible range.`);
        continue;
      }
    } else if (
      (f.concept === "totalAssets" || f.concept === "totalLiabilities") &&
      v > 0 &&
      v < MIN_PLAUSIBLE_BALANCE_SHEET
    ) {
      reject(
        f,
        `${f.concept} of ${v} is too small for a listed company; the figures are probably in lakhs or crores and the header was not read.`
      );
      continue;
    }

    // 3. Scope. Undefined is allowed to pass here and refused later at the point
    //    where two facts would be combined, because a single figure with no
    //    stated scope is still a real figure worth storing.
    if (ctx.scope && f.scope && f.scope !== ctx.scope) {
      reject(
        f,
        `Fact is ${f.scope} but the filing is ${ctx.scope}; the two sets of books must not be mixed.`
      );
      continue;
    }

    // 2. Period length. A year-to-date column read as a quarter is the classic
    //    one: nine months of income presented as three inflates the quarter
    //    threefold and still looks like a normal quarter.
    const months = monthsBetween(f.periodStart, f.periodEnd);
    if (ctx.expectedPeriodMonths && months != null) {
      const drift = Math.abs(months - ctx.expectedPeriodMonths);
      if (drift > 1) {
        reject(
          f,
          `Covers ${months} months but the filing reports ${ctx.expectedPeriodMonths}; this is a different column.`
        );
        continue;
      }
    }

    // 4. Comparatives. Kept, but never published as the current result: a
    //    filing carries last year's figures beside this year's, and they are
    //    indistinguishable once the date is dropped.
    if (ctx.periodEnd && f.periodEnd && f.periodEnd !== ctx.periodEnd) {
      const gap = Math.abs(Date.parse(ctx.periodEnd) - Date.parse(f.periodEnd));
      if (isFinite(gap) && gap > 45 * DAY) {
        comparatives++;
        reject(f, `Prior-period comparative (${f.periodEnd}), not this filing's result.`);
        continue;
      }
    }
  }

  return { facts, issues, comparatives };
}

/**
 * 8. Checks that need more than one fact.
 *
 * Each identity here is one an accountant would apply without thinking, which is
 * why they are worth automating: a set of figures that violates one of them has
 * been mis-read, and no amount of care in reading any single figure would have
 * revealed it.
 */
export function checkIdentities(
  values: Record<string, number | undefined>,
  tolerance = 0.02
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const has = (k: string) => typeof values[k] === "number" && isFinite(values[k]!);
  const near = (a: number, b: number) => Math.abs(a - b) <= Math.max(Math.abs(b) * tolerance, 1);

  if (has("totalAssets") && has("totalLiabilities") && has("shareholderEquity")) {
    const lhs = values.totalAssets!;
    const rhs = values.totalLiabilities! + values.shareholderEquity!;
    if (!near(lhs, rhs)) {
      issues.push({
        concept: "totalAssets",
        reason: `Balance sheet does not balance: assets ${lhs} against liabilities plus equity ${rhs}.`,
      });
    }
  }
  if (has("grossNpa") && has("netNpa") && values.netNpa! > values.grossNpa!) {
    issues.push({
      concept: "netNpa",
      reason: "Net NPAs exceed gross NPAs, which is impossible: net is gross less provisions.",
    });
  }
  if (has("grossNpaRatio") && has("netNpaRatio") && values.netNpaRatio! > values.grossNpaRatio!) {
    issues.push({
      concept: "netNpaRatio",
      reason: "Net NPA ratio exceeds the gross ratio.",
    });
  }
  if (has("advances") && has("totalAssets") && values.advances! > values.totalAssets!) {
    issues.push({ concept: "advances", reason: "Advances exceed total assets." });
  }
  if (has("deposits") && has("totalLiabilities") && values.deposits! > values.totalLiabilities! * 1.02) {
    issues.push({ concept: "deposits", reason: "Deposits exceed total liabilities." });
  }
  if (has("tier1Ratio") && has("capitalAdequacyRatio") && values.tier1Ratio! > values.capitalAdequacyRatio! + 0.01) {
    issues.push({
      concept: "tier1Ratio",
      reason: "Tier-1 ratio exceeds total capital adequacy, which contains it.",
    });
  }
  return issues;
}

/**
 * 7. The same filing, submitted to both exchanges.
 *
 * NSE and BSE each publish the company's results and they are the same document.
 * Ingesting both doubles every fact, and because the duplicates agree exactly,
 * nothing downstream notices: averages are unchanged, sums are doubled, and a
 * count of filings says the company reports twice as often as it does.
 *
 * The content hash catches byte-identical copies. Where the two exchanges
 * re-encode and the hashes differ, the fallback is the identity of the filing
 * itself: one company, one period, one scope.
 */
export function dedupeFilings<T extends {
  companyId: string;
  periodEnd?: string;
  contentHash: string;
  source: string;
  submittedAt?: string;
  format?: string;
}>(filings: T[]): { kept: T[]; dropped: T[] } {
  const byHash = new Map<string, T>();
  const byIdentity = new Map<string, T>();
  const kept: T[] = [];
  const dropped: T[] = [];

  // A structured document beats a scanned one, and an earlier submission beats a
  // later re-upload of the same period, so the ordering decides which copy wins
  // before anything is compared.
  const rank = (f: T) => (f.format === "xbrl" ? 0 : f.format === "xhtml" || f.format === "html" ? 1 : 2);
  const ordered = [...filings].sort((a, b) => {
    const byFormat = rank(a) - rank(b);
    if (byFormat !== 0) return byFormat;
    return (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "");
  });

  for (const f of ordered) {
    const identity = `${f.companyId}|${f.periodEnd ?? ""}`;
    if (byHash.has(f.contentHash) || byIdentity.has(identity)) {
      dropped.push(f);
      continue;
    }
    byHash.set(f.contentHash, f);
    byIdentity.set(identity, f);
    kept.push(f);
  }
  return { kept, dropped };
}

/**
 * 6. A revised filing replaces the one it revises.
 *
 * Companies re-file: a correction, a restatement, an auditor's revision. Both
 * versions sit in the feed afterwards and the older one is not marked as dead,
 * so the only thing distinguishing them is when they were submitted. Keeping
 * both would leave two different answers for the same quarter and no rule for
 * choosing between them.
 */
export function latestPerPeriod<T extends { periodEnd?: string; submittedAt?: string }>(
  filings: T[]
): T[] {
  const best = new Map<string, T>();
  for (const f of filings) {
    const key = f.periodEnd ?? "";
    const current = best.get(key);
    if (!current || (f.submittedAt ?? "") > (current.submittedAt ?? "")) best.set(key, f);
  }
  return Array.from(best.values());
}
