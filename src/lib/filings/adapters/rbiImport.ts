import {
  parseRbiTable,
  matchBank,
  type BankMasterEntry,
  type RbiMetric,
} from "@/lib/filings/adapters/rbiBankTables";
import { contentHashOf, saveFiling, storeRawDocument, linkSymbol, recordError } from "@/lib/filings/store";
import { PARSER_VERSION, type Filing, type FilingFact } from "@/lib/filings/types";

// One import, every bank.
//
// This is the change of shape the whole thing needed. Ingesting quarterly XBRL
// gets one bank per document and needs a licensed feed to get the documents;
// the RBI's annual tables are one file that carries a hundred and forty banks
// and cost nothing. So the first pass over the market is a bulk import, and the
// per-company filings become the thing that refreshes it quarterly later.
//
// Two properties are load-bearing:
//
//   Nothing is guessed. A row whose bank name does not resolve to exactly one
//   entry in the master is reported and skipped. The alternative is a fuzzy
//   match, and a fuzzy match here writes Bank of India's bad-loan ratio onto
//   Indian Bank's page, permanently and without a symptom.
//
//   Each bank becomes its own filing record, keyed by the hash of the source
//   table plus the bank. One table produces a hundred and forty filings rather
//   than one, so a re-import replaces cleanly, a single bank can be traced back
//   to its row, and the dedupe that stops a document being counted twice works
//   unchanged.

/** RBI ratio columns are percentages; the checklist reads fractions. */
const PERCENT_METRICS = new Set<RbiMetric>([
  "grossNpaRatio",
  "netNpaRatio",
  "provisionCoverageRatio",
  "capitalAdequacyRatio",
  "tier1Ratio",
]);

export interface RbiImportRequest {
  /** The table, as CSV. */
  csv: string;
  /** The fiscal year the table is as of, e.g. "2025-03-31". */
  periodEnd: string;
  /** Where the file came from, so every fact can cite it. */
  sourceUrl: string;
  /** Which table this is, for the filing record. */
  tableName: string;
  master: BankMasterEntry[];
  /** Report what would happen without writing anything. */
  dryRun?: boolean;
}

export interface RbiImportReport {
  ok: boolean;
  /** Banks matched to exactly one master entry. */
  matched: number;
  /** Facts that would be, or were, written. */
  facts: number;
  /** Rows whose bank name resolved to nothing, or to more than one. */
  unmatched: { name: string; reason: string; line: number }[];
  /** Master entries the table said nothing about. */
  missingFromTable: string[];
  columns: string[];
  scale: number;
  errors: string[];
  dryRun: boolean;
}

export interface RbiFactSet {
  entry: BankMasterEntry;
  filingId: string;
  facts: FilingFact[];
}

export interface RbiShaping {
  sets: RbiFactSet[];
  unmatched: { name: string; reason: string; line: number }[];
  missingFromTable: string[];
}

/**
 * Turn parsed rows into facts, matched to companies, with nothing written.
 *
 * Separated from the storage so the whole chain can be driven in a test: a CSV
 * goes in, and what comes out is what a bank's card will read. Every decision
 * that can be wrong lives on this side of the line, and the other side is a
 * Redis write.
 */
export function shapeRbiFacts(
  rows: { bankName: string; values: Record<string, number | undefined>; line: number }[],
  master: BankMasterEntry[],
  meta: { tableHash: string; tableName: string; periodEnd: string }
): RbiShaping {
  const sets: RbiFactSet[] = [];
  const unmatched: RbiShaping["unmatched"] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    const match = matchBank(row.bankName, master);
    if (!match.entry) {
      unmatched.push({ name: row.bankName, reason: match.reason ?? "No match.", line: row.line });
      continue;
    }
    const entry = match.entry;
    seen.add(entry.companyId);
    const filingId = `filing_rbi_${meta.tableHash.slice(0, 12)}_${entry.companyId.replace(/[^A-Za-z0-9]/g, "")}`;
    const facts: FilingFact[] = [];

    for (const [metric, value] of Object.entries(row.values)) {
      if (value == null || !isFinite(value)) continue;
      facts.push({
        filingId,
        companyId: entry.companyId,
        concept: metric,
        sourceConcept: `RBI ${meta.tableName}: ${metric}`,
        // Percentages stay as percentages here. The conversion to a fraction
        // happens once, in toMetrics, so there is exactly one place where 1.33
        // can become 133% by accident.
        numericValue: value,
        unit: PERCENT_METRICS.has(metric as RbiMetric) ? "percent" : "INR",
        currency: PERCENT_METRICS.has(metric as RbiMetric) ? undefined : "INR",
        periodEnd: meta.periodEnd,
        // The RBI's bank-wise tables report standalone domestic operations, not
        // the consolidated group. Recording that is what stops these figures
        // being divided against a consolidated balance sheet.
        scope: "standalone",
        sourcePage: row.line,
        sourceXPath: `row ${row.line}, "${row.bankName}"`,
        method: "regulator-table",
        confidence: 1,
      });
    }
    if (facts.length) sets.push({ entry, filingId, facts });
  }

  return {
    sets,
    unmatched,
    missingFromTable: master.filter((m) => !seen.has(m.companyId)).map((m) => m.legalName),
  };
}

export async function importRbiTable(req: RbiImportRequest): Promise<RbiImportReport> {
  const table = parseRbiTable(req.csv);
  const report: RbiImportReport = {
    ok: false,
    matched: 0,
    facts: 0,
    unmatched: [],
    missingFromTable: [],
    columns: Object.keys(table.columns),
    scale: table.scale,
    errors: [...table.errors],
    dryRun: !!req.dryRun,
  };
  if (!table.rows.length) return report;

  const tableHash = await contentHashOf(req.csv);
  // The original table is kept once, not once per bank. Every fact below cites
  // the same document, and re-storing it per bank would multiply a megabyte by
  // a hundred and forty for no gain.
  if (!req.dryRun) {
    const raw = await storeRawDocument(tableHash, req.csv);
    if (!raw.stored) {
      report.errors.push(`Source table not archived: ${raw.reason}`);
    }
  }

  const shaped = shapeRbiFacts(table.rows, req.master, {
    tableHash,
    tableName: req.tableName,
    periodEnd: req.periodEnd,
  });
  report.unmatched = shaped.unmatched;
  report.missingFromTable = shaped.missingFromTable;
  report.matched = shaped.sets.length;
  report.facts = shaped.sets.reduce((n, s) => n + s.facts.length, 0);

  if (!req.dryRun) {
    for (const set of shaped.sets) {
      const filing: Filing = {
        id: set.filingId,
        companyId: set.entry.companyId,
        source: "manual",
        category: `RBI ${req.tableName}`,
        submittedAt: new Date().toISOString(),
        periodEnd: req.periodEnd,
        sourceUrl: req.sourceUrl,
        format: "html",
        // The bank's identity is part of the hash, so two banks from one table
        // are two filings and re-importing the table replaces both.
        contentHash: `${tableHash}:${set.entry.companyId}`,
        parserVersion: PARSER_VERSION,
        processingStatus: "validated",
      };
      const saved = await saveFiling(filing, set.facts);
      if (!saved) {
        report.errors.push(`Storage not configured; ${set.entry.legalName} was parsed and not kept.`);
      }
      await linkSymbol(set.entry.symbol, set.entry.companyId);
    }
  }

  // An unmatched row is the thing to act on, so it goes in the error log rather
  // than only into a response nobody reads twice.
  if (!req.dryRun && report.unmatched.length) {
    await recordError({
      at: new Date().toISOString(),
      stage: "parse",
      message: `RBI ${req.tableName}: ${report.unmatched.length} rows did not match the bank master: ${report.unmatched
        .slice(0, 10)
        .map((u) => u.name)
        .join(", ")}`,
    });
  }

  report.ok = report.matched > 0;
  return report;
}
