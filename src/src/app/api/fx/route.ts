import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

// Returns an FX rate (1 `from` = rate `to`) from two independent sources:
// Frankfurter (European Central Bank data, keyless) first, then Yahoo as fallback.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = (searchParams.get("from") ?? "").toUpperCase();
  const to = (searchParams.get("to") ?? "").toUpperCase();

  if (!from || !to) return NextResponse.json({ valid: false });
  if (from === to) return NextResponse.json({ valid: true, rate: 1, source: "identity" });

  // 1) Frankfurter (ECB) — reliable, keyless, ~30 major currencies.
  try {
    const r = await fetch(
      `https://api.frankfurter.app/latest?from=${from}&to=${to}`,
      { next: { revalidate: 600 } }
    );
    if (r.ok) {
      const d = (await r.json()) as { rates?: Record<string, number> };
      const rate = d?.rates?.[to];
      if (typeof rate === "number" && isFinite(rate)) {
        return NextResponse.json({ valid: true, rate, source: "frankfurter" });
      }
    }
  } catch (err) {
    console.error("[fx] Frankfurter failed:", err);
  }

  // 2) Yahoo fallback — covers pairs the ECB list doesn't (e.g. AED).
  try {
    const r = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${from}${to}=X?range=1d&interval=1d`,
      { headers: { "User-Agent": UA }, next: { revalidate: 300 } }
    );
    if (r.ok) {
      const j = (await r.json()) as {
        chart?: { result?: { meta?: { regularMarketPrice?: number } }[] };
      };
      const price = j?.chart?.result?.[0]?.meta?.regularMarketPrice;
      if (typeof price === "number" && isFinite(price)) {
        return NextResponse.json({ valid: true, rate: price, source: "yahoo" });
      }
    }
  } catch (err) {
    console.error("[fx] Yahoo failed:", err);
  }

  return NextResponse.json({ valid: false });
}
