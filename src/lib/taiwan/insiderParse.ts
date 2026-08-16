// Parsing for the Taiwan Stock Exchange and Taipei Exchange insider datasets.
//
// No imports, on purpose: this file is numbers and strings in, normalised
// records out, so scripts/test-taiwan-insider.mjs can compile and run it
// directly against saved payloads. That is the whole point of separating it —
// the failure this replaces was a parser that could not be exercised without the
// network, so nobody found out it was returning nothing until the page said a
// company had no disclosures.
//
// ── The datasets ────────────────────────────────────────────────────────────
//
// Three per market, published by the exchange itself under the Taiwan
// Government Open Data Licence 1.0:
//
//   t187ap11  董事、監察人、經理人及大股東持股餘額     holding snapshot
//   t187ap12  持股轉讓事前申報表                       planned transfer
//   t187ap13  持股未轉讓部分                           declared, not transferred
//
// Suffix _L for TWSE-listed companies, _O for TPEx-listed ones.
//
// ── Why the column mapping is defensive ─────────────────────────────────────
//
// The columns are Chinese, and the exchange has renamed and reordered them
// between revisions. Reading them by position would break silently on the next
// revision; reading one hard-coded name each would break silently on a rename.
// So every field is resolved against a list of names it has been published
// under — and, crucially, a REQUIRED field that resolves to nothing is a parse
// FAILURE, not a row with a blank in it. A schema change has to surface as "the
// source is unavailable", never as a company that appears to have filed nothing.

export type TaiwanMarket = "TWSE" | "TPEx";

export type TaiwanEventType = "holding_snapshot" | "planned_transfer" | "untransferred";

export interface TaiwanInsiderRecord {
  market: TaiwanMarket;
  companyId: string;
  companyName?: string;
  person: string;
  role: string;
  eventType: TaiwanEventType;
  /** YYYY-MM-DD. The declaration date where one is published, else the table date. */
  filingDate: string;
  /** YYYY-MM for a monthly holdings snapshot. */
  reportingMonth?: string;
  shares?: number;
  sharesBefore?: number;
  sharesAfter?: number;
  /** Shares pledged as collateral — published with the holdings snapshot. */
  sharesPledged?: number;
  transferMethod?: string;
  transferPeriod?: string;
  sourceUrl: string;
  sourceAgency: string;
}

export interface ParseResult {
  records: TaiwanInsiderRecord[];
  /** Required columns that could not be resolved. Non-empty ⇒ treat as a failure. */
  missingColumns: string[];
  /** Column names seen in the payload — logged so a rename is diagnosable in one look. */
  seenColumns: string[];
  rowsIn: number;
}

// ── Column resolution ───────────────────────────────────────────────────────

/**
 * Names each field has been published under. Order is preference, not priority
 * of correctness — the first one PRESENT in the payload wins.
 *
 * Both the Chinese names and the romanised ones the OpenAPI sometimes emits are
 * listed, because which you get has varied by endpoint and by revision.
 */
const COLUMNS = {
  companyId: ["公司代號", "公司代碼", "證券代號", "Code", "code", "CompanyCode"],
  companyName: ["公司名稱", "公司簡稱", "證券名稱", "Name", "name", "CompanyName"],
  person: ["姓名", "申報人姓名", "申報人", "Name of the person", "person"],
  role: ["職稱", "身分別", "申報人身分", "Title", "title"],
  tableDate: ["出表日期", "資料日期", "Date", "date"],
  filingDate: ["申報日期", "公告日期", "DeclarationDate", "declare_date"],
  reportingMonth: ["資料年月", "年月", "報表年月", "YearMonth"],
  holdingsNow: ["目前持股", "本月持股", "持有股數", "目前持有股數", "CurrentShares"],
  holdingsAtAppointment: ["選任時持股", "選任時持有股數", "SharesAtAppointment"],
  pledged: ["設質股數", "設質股份", "PledgedShares"],
  plannedShares: ["預定轉讓股數", "申報轉讓股數", "轉讓股數", "PlannedShares"],
  untransferred: ["未轉讓股數", "尚未轉讓股數", "UntransferredShares"],
  transferMethod: ["轉讓方式", "轉讓方式別", "TransferMethod"],
  transferPeriod: ["轉讓期間", "預定轉讓期間", "TransferPeriod"],
} as const;

type Field = keyof typeof COLUMNS;

/** The first candidate name actually present among the payload's columns. */
export function resolveColumn(seen: string[], field: Field): string | null {
  const set = new Set(seen.map((s) => s.trim()));
  for (const candidate of COLUMNS[field]) if (set.has(candidate)) return candidate;
  return null;
}

// ── Value coercion ──────────────────────────────────────────────────────────

const text = (v: unknown): string | undefined => {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s && s !== "-" && s !== "－" ? s : undefined;
};

/**
 * A share count. The feed publishes these with thousands separators, sometimes
 * full-width digits, and occasionally a placeholder dash.
 *
 * Returns undefined rather than 0 for anything unreadable: zero shares is a real
 * and meaningful value in these datasets (a director who transferred nothing),
 * so it must never be what an unparseable string becomes.
 */
export function toShares(v: unknown): number | undefined {
  const s = text(v);
  if (s == null) return undefined;
  const normalised = s
    // Full-width digits → ASCII.
    .replace(/[０-９]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0xfee0))
    .replace(/[,，\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(normalised)) return undefined;
  const n = Number(normalised);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * A date, from either of the two calendars the exchange publishes in.
 *
 * Taiwan's official filings use the Minguo (ROC) era: year 1 is 1912, so "1140815"
 * is 15 August 2025. Reading that as a Gregorian year is not a small error — it
 * puts every filing about eleven hundred years in the past, and a "sort by date"
 * then buries the newest disclosures at the bottom. ISO dates are passed through
 * unchanged, because some endpoints publish those instead.
 */
export function toIsoDate(v: unknown): string | undefined {
  const s = text(v);
  if (!s) return undefined;

  // Already ISO-ish: 2025-08-15 or 2025/08/15.
  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const [, y, m, d] = iso;
    return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Minguo with separators: 114/08/15 or 114-08-15.
  const roc = s.match(/^(\d{2,3})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (roc) {
    const [, y, m, d] = roc;
    return `${Number(y) + 1911}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }

  // Minguo, packed: 1140815 (7 digits) or 990815 (6, for years before 100).
  const packed = s.match(/^(\d{6,7})$/);
  if (packed) {
    const raw = packed[1];
    const y = Number(raw.slice(0, raw.length - 4));
    const m = raw.slice(-4, -2);
    const d = raw.slice(-2);
    if (y > 0 && y < 300 && +m >= 1 && +m <= 12 && +d >= 1 && +d <= 31) {
      return `${y + 1911}-${m}-${d}`;
    }
  }

  // Gregorian, packed: 20250815.
  const greg = s.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (greg && +greg[1] > 1911) return `${greg[1]}-${greg[2]}-${greg[3]}`;

  return undefined;
}

/** "11408" or "114/08" → "2025-08". */
export function toIsoMonth(v: unknown): string | undefined {
  const s = text(v);
  if (!s) return undefined;
  const sep = s.match(/^(\d{2,4})[-/](\d{1,2})$/);
  if (sep) {
    const y = Number(sep[1]);
    const year = y > 1911 ? y : y + 1911;
    return `${year}-${sep[2].padStart(2, "0")}`;
  }
  const packed = s.match(/^(\d{5,6})$/);
  if (packed) {
    const raw = packed[1];
    const y = Number(raw.slice(0, raw.length - 2));
    const m = raw.slice(-2);
    if (+m >= 1 && +m <= 12) return `${y > 1911 ? y : y + 1911}-${m}`;
  }
  return undefined;
}

// ── Dataset → record ────────────────────────────────────────────────────────

export const SOURCE_AGENCY: Record<TaiwanMarket, string> = {
  TWSE: "Taiwan Stock Exchange",
  TPEx: "Taipei Exchange",
};

/** Required columns per event type — absent ⇒ the payload is not what we expect. */
const REQUIRED: Record<TaiwanEventType, Field[]> = {
  holding_snapshot: ["companyId", "person"],
  planned_transfer: ["companyId", "person"],
  untransferred: ["companyId", "person"],
};

export function parseTaiwanDataset({
  rows,
  market,
  eventType,
  sourceUrl,
}: {
  rows: Record<string, unknown>[];
  market: TaiwanMarket;
  eventType: TaiwanEventType;
  sourceUrl: string;
}): ParseResult {
  const seenColumns = rows.length ? Object.keys(rows[0]) : [];
  const col = (f: Field) => resolveColumn(seenColumns, f);

  // An empty payload has no columns to judge, so it is NOT a schema failure —
  // saying "columns not found" about a file with no rows in it would send an
  // operator hunting for a rename that never happened. It is not proof that
  // nobody filed anything either; the caller treats an empty market-wide file
  // as an unusable answer, which is the honest reading for a file that always
  // has rows in normal operation.
  if (rows.length === 0) {
    return { records: [], missingColumns: [], seenColumns, rowsIn: 0 };
  }

  const missingColumns = REQUIRED[eventType].filter((f) => col(f) == null);
  if (missingColumns.length) {
    return { records: [], missingColumns, seenColumns, rowsIn: rows.length };
  }

  const get = (row: Record<string, unknown>, f: Field): unknown => {
    const name = col(f);
    return name == null ? undefined : row[name];
  };

  const records: TaiwanInsiderRecord[] = [];
  for (const row of rows) {
    const companyId = text(get(row, "companyId"));
    const person = text(get(row, "person"));
    if (!companyId || !person) continue;

    // The declaration date when the dataset carries one; the table's own date
    // otherwise. A holdings snapshot has no declaration — it is a monthly
    // position, and dating it "today" would imply an event that did not happen.
    const filingDate =
      toIsoDate(get(row, "filingDate")) ?? toIsoDate(get(row, "tableDate")) ?? undefined;
    if (!filingDate) continue;

    const base = {
      market,
      companyId,
      companyName: text(get(row, "companyName")),
      person,
      role: text(get(row, "role")) ?? "Insider",
      filingDate,
      reportingMonth: toIsoMonth(get(row, "reportingMonth")),
      sourceUrl,
      sourceAgency: SOURCE_AGENCY[market],
    };

    if (eventType === "holding_snapshot") {
      records.push({
        ...base,
        eventType,
        // A snapshot is a POSITION, not a trade. sharesAfter is what is held now;
        // sharesBefore is the holding at appointment where the dataset gives it,
        // which is the only "before" the exchange publishes here. Neither is a
        // purchase or a sale, and the UI must not call them one.
        sharesAfter: toShares(get(row, "holdingsNow")),
        sharesBefore: toShares(get(row, "holdingsAtAppointment")),
        sharesPledged: toShares(get(row, "pledged")),
      });
    } else if (eventType === "planned_transfer") {
      records.push({
        ...base,
        eventType,
        // An INTENTION to transfer, declared in advance. It is not a sale, and
        // it is not evidence one happened — see the untransferred dataset, whose
        // entire purpose is to report the part that did not.
        shares: toShares(get(row, "plannedShares")),
        sharesBefore: toShares(get(row, "holdingsNow")),
        transferMethod: text(get(row, "transferMethod")),
        transferPeriod: text(get(row, "transferPeriod")),
      });
    } else {
      records.push({
        ...base,
        eventType,
        shares: toShares(get(row, "untransferred")),
        sharesBefore: toShares(get(row, "plannedShares")),
        transferMethod: text(get(row, "transferMethod")),
      });
    }
  }

  return { records, missingColumns: [], seenColumns, rowsIn: rows.length };
}

// ── Display ─────────────────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * The one-line description shown for a record.
 *
 * The wording is the point of this whole rewrite. None of these datasets reports
 * a trade:
 *
 *   • A holdings snapshot is a monthly position. Comparing two months tells you
 *     the holding rose or fell; it does NOT tell you the person bought or sold —
 *     the change could be a grant, an inheritance, a pledge being called, or a
 *     share issue diluting the count. "Bought"/"Sold" asserts a cause the filing
 *     does not state.
 *   • A planned transfer is an intention declared in advance, with a window and
 *     a method. Calling it a "sale" reports something that has not happened and
 *     may never happen.
 *   • The untransferred dataset exists precisely because plans go unexecuted.
 */
export function describeTaiwanRecord(r: TaiwanInsiderRecord): string {
  if (r.eventType === "holding_snapshot") {
    const delta =
      r.sharesAfter != null && r.sharesBefore != null ? r.sharesAfter - r.sharesBefore : undefined;
    const held = r.sharesAfter != null ? `${fmt(r.sharesAfter)} shares held` : undefined;
    const move =
      delta == null || delta === 0
        ? undefined
        : `Holdings ${delta > 0 ? "increased" : "decreased"} by ${fmt(Math.abs(delta))} since appointment`;
    return [move, held].filter(Boolean).join(" · ") || "Holdings disclosed";
  }
  if (r.eventType === "planned_transfer") {
    const n = r.shares != null ? `${fmt(r.shares)} shares` : "shares";
    const how = r.transferMethod ? ` by ${r.transferMethod}` : "";
    const when = r.transferPeriod ? ` (${r.transferPeriod})` : "";
    return `Planned transfer of ${n}${how}${when}`;
  }
  const n = r.shares != null ? `${fmt(r.shares)} shares` : "shares";
  const of = r.sharesBefore != null ? ` of ${fmt(r.sharesBefore)} declared` : "";
  return `Declared but not transferred: ${n}${of}`;
}

export const EVENT_LABEL: Record<TaiwanEventType, string> = {
  holding_snapshot: "Holdings",
  planned_transfer: "Planned transfer",
  untransferred: "Not transferred",
};

/** A stable id, so re-ingesting the same monthly file cannot duplicate rows. */
export function taiwanRecordId(r: TaiwanInsiderRecord): string {
  const amount = r.shares ?? r.sharesAfter ?? 0;
  return [
    "tw",
    r.market.toLowerCase(),
    r.companyId,
    r.eventType,
    r.filingDate,
    r.reportingMonth ?? "",
    r.person,
    amount,
  ]
    .join("-")
    .replace(/\s+/g, "");
}
