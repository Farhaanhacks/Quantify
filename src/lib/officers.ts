// Executive roster shaping, kept pure so the ordering can be tested.
//
// The ordering is the whole point of this file: Yahoo returns officers in no
// useful sequence — frequently alphabetical, which puts the Chief Accounting
// Officer first and the CEO fourth — and that is invisible unless something
// asserts it.

/**
 * A named executive as the exchange filings describe them.
 *
 * What is here is what Yahoo actually carries: name, title, age and pay. It
 * does NOT carry biographies — no qualification, no career history — so this
 * type has no field for one. A profile page that wants prose about a CEO needs
 * a different source; inventing the field here would only invite filling it in
 * with something we made up.
 */
export interface Officer {
  name: string;
  title: string;
  age?: number;
  /** Total compensation for `fiscalYear`, in the company's reporting currency. */
  totalPay?: number;
  fiscalYear?: number;
}

// Rank the executives the way a reader looks for them, because Yahoo returns
// them in no useful order — often alphabetically, so the Chief Accounting
// Officer leads and the CEO is fourth.
export function officerRank(title: string): number {
  const t = title.toLowerCase();
  if (/\bchairman\b|\bchairperson\b/.test(t) && /\bceo\b|chief exec/.test(t)) return 0;
  if (/\bceo\b|chief exec|managing director|\bmd\b/.test(t)) return 1;
  if (/\bchairman\b|\bchairperson\b/.test(t)) return 2;
  if (/\bcoo\b|chief operating/.test(t)) return 3;
  if (/\bcfo\b|chief financial/.test(t)) return 4;
  if (/\bcto\b|chief technolog/.test(t)) return 5;
  if (/\bciso\b|chief information/.test(t)) return 6;
  if (/president/.test(t)) return 7;
  if (/chief/.test(t)) return 8;
  if (/director|secretary/.test(t)) return 9;
  return 10;
}

const num = (x: unknown): number | undefined => {
  if (typeof x === "number") return isFinite(x) ? x : undefined;
  if (x && typeof x === "object" && "raw" in (x as Record<string, unknown>)) {
    const r = (x as { raw?: unknown }).raw;
    return typeof r === "number" && isFinite(r) ? r : undefined;
  }
  return undefined;
};
const str = (x: unknown): string | undefined =>
  typeof x === "string" && x.trim() ? x.trim() : undefined;

export function parseOfficers(raw: unknown): Officer[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Officer[] = [];
  for (const o of raw) {
    if (!o || typeof o !== "object") continue;
    const r = o as Record<string, unknown>;
    const name = str(r.name);
    const title = str(r.title);
    if (!name || !title) continue;
    out.push({
      name,
      title,
      age: num(r.age),
      totalPay: num(r.totalPay),
      fiscalYear: num(r.fiscalYear),
    });
  }
  if (!out.length) return undefined;
  return out.sort((a, b) => officerRank(a.title) - officerRank(b.title)).slice(0, 12);
}
