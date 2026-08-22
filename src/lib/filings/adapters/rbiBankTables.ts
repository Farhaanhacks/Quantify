// The RBI's own bank-wise statistical tables.
//
// No imports, so scripts/test-rbi-tables.mjs can compile and drive it.
//
// This is the answer to a question the filing pipeline could not answer on its
// own: how do you cover a hundred and forty banks without a licensed quarterly
// feed. You do not scrape two exchanges. You take the regulator's own annual
// publication, which is free, bank-wise, and already the authoritative source
// for exactly the four measures a bank's balance-sheet card is missing.
//
// What this buys and what it does not, stated plainly because the difference
// decides how the figures may be labelled:
//
//   • Annual, not quarterly. The tables are published once a year and are as of
//     31 March. A bank's card carries that date, and a reader can see it is a
//     year old rather than being left to assume it is current.
//   • Standalone domestic operations, in most tables. Not the consolidated
//     group. That is a different set of books from the one a quarterly XBRL
//     filing reports, which is why scope travels with every fact and why
//     ratio() refuses to divide across the two.
//   • Regulator-published, so it outranks anything derived, and sits just below
//     the company's own tagged filing for the same period.
//
// The parser is deliberately generic across tables. The RBI publishes gross and
// net NPAs in one table and capital adequacy in another, with the same layout
// and different columns, so one column-detecting reader handles both and any
// future table that keeps the shape.

export type RbiMetric =
  | "grossNpaRatio"
  | "netNpaRatio"
  | "grossNpa"
  | "netNpa"
  | "provisionCoverageRatio"
  | "capitalAdequacyRatio"
  | "tier1Ratio"
  | "totalAssets"
  | "deposits"
  | "advances";

/**
 * How a column is recognised.
 *
 * Matched against the header text with everything but letters removed, because
 * the RBI writes the same column as "Gross NPA Ratio", "Gross N.P.A. ratio (%)"
 * and "GNPA ratio" across years, and a table that stops being read because a
 * full stop moved is a table nobody notices has stopped being read.
 *
 * Order matters: "netnparatio" contains "nparatio", so the more specific
 * patterns are tested first.
 */
const COLUMN_PATTERNS: { metric: RbiMetric; patterns: RegExp[]; unit: "percent" | "currency" }[] = [
  { metric: "netNpaRatio", patterns: [/netnpa(?:s)?(?:to|ratio|percent)/, /netnpaadvances/, /nnparatio/], unit: "percent" },
  { metric: "grossNpaRatio", patterns: [/grossnpa(?:s)?(?:to|ratio|percent)/, /grossnpaadvances/, /gnparatio/], unit: "percent" },
  { metric: "provisionCoverageRatio", patterns: [/provisioncoverage/, /^pcr$/], unit: "percent" },
  { metric: "tier1Ratio", patterns: [/tier(?:i|1)(?:capital)?(?:ratio)?$/, /cet1/], unit: "percent" },
  { metric: "capitalAdequacyRatio", patterns: [/crar/, /capitaladequacy/, /capitaltoriskweighted/], unit: "percent" },
  { metric: "netNpa", patterns: [/^netnpa(?:s)?$/, /netnpaamount/], unit: "currency" },
  { metric: "grossNpa", patterns: [/^grossnpa(?:s)?$/, /grossnpaamount/], unit: "currency" },
  { metric: "advances", patterns: [/^(?:gross)?advances$/, /loansandadvances/], unit: "currency" },
  { metric: "deposits", patterns: [/^deposits$/, /totaldeposits/], unit: "currency" },
  { metric: "totalAssets", patterns: [/^totalassets$/], unit: "currency" },
];

const NAME_COLUMN = /^(?:name(?:ofthe)?bank|bankname|nameofbank|bank|institution)$/;

const key = (s: string) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

/** Split a CSV line, honouring quoted fields. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      out.push(cur.trim());
      cur = "";
    } else cur += c;
  }
  out.push(cur.trim());
  return out;
}

/**
 * A number as a regulator's table writes one.
 *
 * The three that bite: Indian digit grouping, a dash standing for "no value",
 * and a footnote marker glued to the figure. A dash read as zero would report a
 * bank with no bad loans, which is the most flattering possible way to be wrong.
 */
export function parseRbiNumber(raw: string): number | undefined {
  if (typeof raw !== "string") return undefined;
  let t = raw.trim();
  if (!t) return undefined;
  // "-", "--", "n.a.", "NA", "*" all mean the same thing, and none of them is 0.
  if (/^[-–—*]+$/.test(t) || /^(?:n\.?a\.?|nil|not available)$/i.test(t)) return undefined;
  let negative = false;
  if (/^\(.*\)$/.test(t)) {
    negative = true;
    t = t.slice(1, -1);
  }
  // A trailing footnote marker: "12.4@", "8.9 #", "1.33*"
  t = t.replace(/[@#*†‡§]+$/g, "").trim();
  t = t.replace(/[,\s ]/g, "");
  if (t.startsWith("-")) {
    negative = !negative;
    t = t.slice(1);
  }
  if (!/^\d*\.?\d+$/.test(t)) return undefined;
  const n = Number(t);
  if (!isFinite(n)) return undefined;
  return negative ? -n : n;
}

export interface RbiRow {
  /** The bank's name exactly as the RBI wrote it. */
  bankName: string;
  values: Partial<Record<RbiMetric, number>>;
  /** Which line of the file this came from, for the error report. */
  line: number;
}

export interface RbiTable {
  rows: RbiRow[];
  /** Which metric each column carried. */
  columns: Partial<Record<RbiMetric, number>>;
  /** The multiplier the header implied for currency columns. */
  scale: number;
  errors: string[];
}

/**
 * Read one bank-wise table.
 *
 * The header row is found rather than assumed. RBI tables carry a title, a unit
 * line, sometimes a blank row, and occasionally a two-line header, and the row
 * index that worked last year will not work next year. So the reader looks for
 * the first row that names a bank column AND at least one metric it recognises,
 * which is a description of the table rather than a position in the file.
 */
export function parseRbiTable(csv: string, opts: { scaleHint?: string } = {}): RbiTable {
  const table: RbiTable = { rows: [], columns: {}, scale: 1, errors: [] };
  if (typeof csv !== "string" || !csv.trim()) {
    table.errors.push("Empty table.");
    return table;
  }
  const lines = csv.split(/\r?\n/);

  // The unit is in the table's own header text: "(Amount in ₹ crore)".
  const headerText = `${opts.scaleHint ?? ""} ${lines.slice(0, 8).join(" ")}`.toLowerCase();
  table.scale = /crore/.test(headerText)
    ? 1e7
    : /lakh|lac/.test(headerText)
      ? 1e5
      : /million/.test(headerText)
        ? 1e6
        : 1;

  let headerLine = -1;
  let nameColumn = -1;
  for (let i = 0; i < Math.min(lines.length, 40); i++) {
    const cells = splitCsvLine(lines[i]);
    if (cells.length < 2) continue;
    const nameAt = cells.findIndex((c) => NAME_COLUMN.test(key(c)));
    if (nameAt === -1) continue;
    const found: Partial<Record<RbiMetric, number>> = {};
    cells.forEach((cell, col) => {
      const k = key(cell);
      if (!k) return;
      for (const { metric, patterns } of COLUMN_PATTERNS) {
        if (found[metric] != null) continue;
        if (patterns.some((re) => re.test(k))) {
          found[metric] = col;
          return;
        }
      }
    });
    if (Object.keys(found).length) {
      headerLine = i;
      nameColumn = nameAt;
      table.columns = found;
      break;
    }
  }

  if (headerLine === -1) {
    table.errors.push(
      "No header row found. The table needs a bank-name column and at least one recognised metric column."
    );
    return table;
  }

  for (let i = headerLine + 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw || !raw.trim()) continue;
    const cells = splitCsvLine(raw);
    const bankName = (cells[nameColumn] ?? "").trim();
    if (!bankName) continue;
    // Group headings and footnotes sit in the name column with nothing beside
    // them: "SCHEDULED COMMERCIAL BANKS", "Note: ...", "Source: ...".
    if (/^(?:note|source|footnote|p\s*:)/i.test(bankName)) continue;
    const values: Partial<Record<RbiMetric, number>> = {};
    for (const [metric, col] of Object.entries(table.columns) as [RbiMetric, number][]) {
      const v = parseRbiNumber(cells[col] ?? "");
      if (v == null) continue;
      const spec = COLUMN_PATTERNS.find((c) => c.metric === metric);
      values[metric] = spec?.unit === "currency" ? v * table.scale : v;
    }
    // A row with a name and no figures is a heading, not a bank.
    if (!Object.keys(values).length) continue;
    table.rows.push({ bankName, values, line: i + 1 });
  }

  if (!table.rows.length) table.errors.push("Header found but no data rows parsed.");
  return table;
}

// ── Matching a regulator's name to a company ────────────────────────────────

// Only the words that carry no identity. "India", "Indian" and "of" stay, and
// they have to: Bank of India and Indian Bank are two different listed
// companies, and stripping those words leaves both as the single word "bank".
const BANK_SUFFIX = /\b(limited|ltd|corporation|corp|company|co|the|and|&)\b/gi;

/**
 * A bank name reduced to the words that identify it.
 *
 * "Bank" is NOT stripped, and that is the whole difficulty of this file. Bank of
 * India, Bank of Baroda, Central Bank of India, Indian Bank and Indian Overseas
 * Bank are five different listed companies whose names differ by one or two
 * common words, and a matcher that strips the common words leaves several of
 * them identical. So the reduction is conservative and the matcher refuses
 * anything ambiguous rather than picking the first candidate.
 */
export function normaliseBankName(name: string): string {
  return (name ?? "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(BANK_SUFFIX, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface BankMasterEntry {
  /**
   * The id filings are stored under.
   *
   * An ISIN where one is known, and a provisional symbol key otherwise. The
   * distinction matters when a company relists or renames: the ISIN survives
   * and the symbol does not, so a provisional entry is a placeholder that
   * should be upgraded the moment a real identifier turns up.
   */
  companyId: string;
  /**
   * Every symbol a page can be reached by.
   *
   * Both listings, not one. A company files once and trades on two exchanges,
   * and a reader arriving at HDFCBANK.BO must find the same filings as one
   * arriving at HDFCBANK.NS. Linking only the NSE line leaves half the readers
   * looking at a card that says the data is unavailable while it sits in the
   * database under the other symbol.
   */
  symbols: string[];
  /** The permanent identifier, where it is known rather than guessed. */
  isin?: string;
  legalName: string;
  /** Names the RBI has used for this bank, where they differ. */
  rbiNames?: string[];
}

/** The first symbol, for messages and for the legacy single-symbol callers. */
export const primarySymbol = (e: BankMasterEntry): string => e.symbols[0] ?? "";

export interface BankMatch {
  entry?: BankMasterEntry;
  /** Set when the name matched more than one bank, or none. */
  reason?: string;
  matchedOn?: "exact" | "alias";
}

/**
 * Which listed bank a row belongs to.
 *
 * Exact normalised name, then the alias list, and nothing else. No substring
 * matching, no edit distance, no "closest": "Bank of India" is a substring of
 * "Central Bank of India" and of "Union Bank of India", and a fuzzy matcher
 * that gets this wrong writes one bank's bad-loan ratio onto another bank's
 * page. An unmatched row is reported and skipped, which costs one bank's data
 * until an alias is added; a wrong match costs a reader's trust and is silent.
 */
export function matchBank(rbiName: string, master: BankMasterEntry[]): BankMatch {
  const target = normaliseBankName(rbiName);
  if (!target) return { reason: "Empty bank name." };

  const exact = master.filter((m) => normaliseBankName(m.legalName) === target);
  if (exact.length === 1) return { entry: exact[0], matchedOn: "exact" };
  if (exact.length > 1) {
    return { reason: `"${rbiName}" matches ${exact.length} banks in the master; not resolved.` };
  }

  const aliased = master.filter((m) =>
    (m.rbiNames ?? []).some((a) => normaliseBankName(a) === target)
  );
  if (aliased.length === 1) return { entry: aliased[0], matchedOn: "alias" };
  if (aliased.length > 1) {
    return { reason: `"${rbiName}" matches ${aliased.length} banks by alias; not resolved.` };
  }
  return { reason: `"${rbiName}" is not in the bank master.` };
}
