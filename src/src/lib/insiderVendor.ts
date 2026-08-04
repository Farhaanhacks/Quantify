// Layer 1 (pluggable): a paid, reliable insider-data API — e.g. InsiderScreener
// (https://www.insiderscreener.com/en/api-pricing), which serves NSE + BSE SEBI
// PIT disclosures as structured JSON. Until INSIDER_API_URL and INSIDER_API_KEY
// are set, this is a no-op and the ingest cron falls through to the NSE/BSE
// scraper (Layer 2). When you have a key, map the provider's response shape into
// IndiaDisclosure[] here — nothing else in the pipeline changes.

import type { IndiaDisclosure } from "@/lib/insiderIndia";

export interface VendorResult {
  bySymbol: Map<string, IndiaDisclosure[]>;
  rows: number;
}

// Returns null when Layer 1 isn't configured, so the caller uses Layer 2.
export async function fetchVendorInsiderMarketWide(days = 7): Promise<VendorResult | null> {
  const base = process.env.INSIDER_API_URL;
  const key = process.env.INSIDER_API_KEY;
  if (!base || !key) return null; // Layer 1 not configured → Layer 2 (scraper).

  try {
    // Example wiring — adjust path/params/field names to the chosen provider's
    // docs. The important part is: fetch the market-wide window ONCE and bucket by
    // NSE symbol; the store + route are already provider-agnostic.
    const url = `${base.replace(/\/$/, "")}?days=${days}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      signal: AbortSignal.timeout(20000),
      cache: "no-store",
    });
    if (!res.ok) return { bySymbol: new Map(), rows: 0 };
    const json = (await res.json()) as { data?: unknown };
    const data = Array.isArray(json?.data) ? (json.data as Record<string, unknown>[]) : [];

    const bySymbol = new Map<string, IndiaDisclosure[]>();
    for (const row of data) {
      const symbol = String(row.symbol ?? row.nseSymbol ?? "").toUpperCase().trim();
      if (!symbol) continue;
      const person = String(row.acquirer ?? row.person ?? row.acqName ?? "");
      const cat = String(row.category ?? row.personCategory ?? "");
      const tx = String(row.transactionType ?? row.tdpTransactionType ?? "");
      const shares = String(row.shares ?? row.secAcq ?? "");
      const value = String(row.value ?? row.secVal ?? "");
      const date = String(row.date ?? row.broadcastDate ?? "").slice(0, 10);
      const parts = [person, cat, tx, shares && `${shares} shares`, value && `₹${value}`].filter(Boolean);
      const disc: IndiaDisclosure = {
        id: `vendor-${symbol}-${date}-${person.slice(0, 8)}-${shares}`.replace(/\s+/g, ""),
        ticker: `${symbol}.NS`,
        company: String(row.company ?? symbol),
        headline: parts.join(" · ") || "Insider / SAST disclosure",
        category: cat || "Insider Trading (PIT Reg 7)",
        date,
        url: typeof row.url === "string" && /^https?:\/\//.test(row.url) ? row.url : undefined,
      };
      const list = bySymbol.get(symbol) ?? [];
      list.push(disc);
      bySymbol.set(symbol, list);
    }
    return { bySymbol, rows: data.length };
  } catch {
    return { bySymbol: new Map(), rows: 0 };
  }
}
