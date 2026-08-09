// Taiwan insider / major-shareholder holdings via FinMind — an open-source
// Taiwanese market-data project (https://finmind.github.io/). Chosen deliberately
// over a commercial vendor: FinMind is open data, so displaying it in a public
// product doesn't run into the "personal use only" redistribution clause that
// retail market-data APIs attach to their consumer tiers.
//
// A free token raises the rate limit but is not required for light use; set
// FINMIND_TOKEN to use one.

import type { IndiaDisclosure } from "@/lib/insiderIndia";

const API = "https://api.finmindtrade.com/api/v4/data";

const str = (v: unknown): string | undefined =>
  v == null ? undefined : String(v).trim() || undefined;
const numOf = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : undefined;
};

// "2330.TW" / "2330.TWO" → "2330" (FinMind keys on the bare board number).
export function taiwanStockId(ticker: string): string | null {
  const m = ticker.toUpperCase().match(/^(\d{4,6})\.(TW|TWO)$/);
  return m ? m[1] : null;
}

export interface TaiwanDebug {
  source: "finmind";
  stockId: string | null;
  dataset: string;
  status?: number;
  rows: number;
  reason?: string;
}

// FinMind returns Chinese field names for some datasets and romanised ones for
// others, and the shape has changed between dataset versions — so every field is
// read through a list of plausible keys rather than one hard-coded name. A missing
// field degrades that row's detail; it never throws.
function pick(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) if (row[k] != null && row[k] !== "") return row[k];
  return undefined;
}

function rowToDisclosure(row: Record<string, unknown>, ticker: string): IndiaDisclosure | null {
  const date = str(pick(row, ["date", "Date", "announce_date"]));
  if (!date) return null;

  const person = str(pick(row, ["name", "Name", "insider_name", "姓名"]));
  const role = str(pick(row, ["security_type", "title", "職稱", "身分別"]));
  const company = str(pick(row, ["stock_name", "公司名稱"])) ?? ticker;

  // Month-on-month change in holdings is what the disclosure actually reports.
  const now = numOf(pick(row, ["this_month_shareholding", "本月持股", "shareholding"]));
  const prev = numOf(pick(row, ["last_month_shareholding", "上月持股"]));
  const delta = now != null && prev != null ? now - prev : undefined;

  const action = delta == null ? undefined : delta > 0 ? "Buy" : delta < 0 ? "Sell" : "No change";
  const sharesText =
    delta != null && delta !== 0
      ? `${Math.abs(delta).toLocaleString()} shares`
      : now != null
      ? `${now.toLocaleString()} shares held`
      : undefined;

  const headline =
    [person, role, action, sharesText].filter(Boolean).join(" · ") ||
    "Insider shareholding disclosure";

  return {
    id: `tw-${ticker}-${date}-${(person ?? "na").slice(0, 12)}`.replace(/\s+/g, ""),
    ticker,
    company,
    headline,
    category: "Insider shareholding (TWSE)",
    date: date.slice(0, 10),
    person,
    action,
    sharesText,
    // FinMind reports holdings, not consideration — so there's no value to show.
    valueText: undefined,
  };
}

export async function getTaiwanInsiderWithDebug(
  ticker: string,
  limit = 20
): Promise<{ disclosures: IndiaDisclosure[]; debug: TaiwanDebug }> {
  const stockId = taiwanStockId(ticker);
  const debug: TaiwanDebug = {
    source: "finmind",
    stockId,
    dataset: "TaiwanStockInsiderTrading",
    rows: 0,
  };
  if (!stockId) {
    debug.reason = "not a TWSE/TPEx symbol";
    return { disclosures: [], debug };
  }

  // Last ~12 months of monthly disclosures.
  const since = new Date();
  since.setMonth(since.getMonth() - 12);
  const start = since.toISOString().slice(0, 10);

  const params = new URLSearchParams({
    dataset: debug.dataset,
    data_id: stockId,
    start_date: start,
  });
  const token = process.env.FINMIND_TOKEN;
  if (token) params.set("token", token);

  try {
    const res = await fetch(`${API}?${params.toString()}`, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
      signal: AbortSignal.timeout(9000),
    });
    debug.status = res.status;
    if (!res.ok) {
      debug.reason = `FinMind responded ${res.status}`;
      return { disclosures: [], debug };
    }
    const json = (await res.json()) as { data?: unknown; msg?: string };
    const rows = Array.isArray(json?.data) ? (json.data as Record<string, unknown>[]) : [];
    debug.rows = rows.length;
    if (!rows.length) {
      debug.reason = str(json?.msg) ?? "no rows";
      return { disclosures: [], debug };
    }

    const disclosures = rows
      .map((r) => rowToDisclosure(r, ticker))
      .filter((d): d is IndiaDisclosure => d != null)
      // Newest first.
      .sort((a, b) => (a.date < b.date ? 1 : -1))
      .slice(0, limit);

    return { disclosures, debug };
  } catch (e) {
    debug.reason = e instanceof Error ? e.message : "fetch failed";
    return { disclosures: [], debug };
  }
}
