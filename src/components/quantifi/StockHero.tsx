"use client";

import { useEffect, useState } from "react";
import StockActions from "@/components/quantifi/StockActions";
import type { CompanyData } from "@/lib/yahooCompany";
import { fmtPrice, currencySymbol, fmtCompactCur, isIndianCurrency } from "@/data/demo";

// The identity band at the top of a stock page: who this company is, what it
// costs, how it's moved, and the two actions people actually want. Without it the
// page reads as a stack of anonymous cards — this is what anchors everything below.

// All in the gold family — brushed-metal gradients, so the tile reads as part of
// the brand rather than a random colour per ticker.
const MONOGRAM_COLORS = [
  ["#E7C873", "#A67F22"], ["#D4AF37", "#8A6B1E"], ["#F0D89B", "#B8912C"],
  ["#C9A227", "#7A5E18"], ["#E3C05C", "#9C7A20"], ["#D9BC63", "#8F701F"],
];

function monogramFor(ticker: string) {
  const base = ticker.replace(/\.(NS|BO|L|HK|KS|TW|SS|SZ)$/i, "");
  let h = 0;
  for (let i = 0; i < base.length; i++) h = (h * 31 + base.charCodeAt(i)) >>> 0;
  return {
    text: base.slice(0, 2).toUpperCase(),
    from: MONOGRAM_COLORS[h % MONOGRAM_COLORS.length][0],
    to: MONOGRAM_COLORS[h % MONOGRAM_COLORS.length][1],
  };
}

// "RELIANCE.NS" → "NSE: RELIANCE" — the way exchanges are actually quoted.
const EXCHANGE: Record<string, string> = {
  NS: "NSE", BO: "BSE", L: "LSE", HK: "HKEX", KS: "KRX", KQ: "KOSDAQ",
  TW: "TWSE", SS: "SSE", SZ: "SZSE", T: "TSE", TO: "TSX", AX: "ASX",
  DE: "XETRA", PA: "EPA", AS: "AMS", MI: "BIT", MC: "BME", SW: "SIX",
};

function listingLabel(ticker: string): string {
  const m = ticker.match(/^(.+)\.([A-Z]{1,4})$/i);
  if (!m) return `NASDAQ: ${ticker}`;
  return `${EXCHANGE[m[2].toUpperCase()] ?? m[2].toUpperCase()}: ${m[1]}`;
}

export default function StockHero({
  ticker,
  name,
  price,
  currency,
  score,
  fairValue,
}: {
  ticker: string;
  name?: string;
  price?: number;
  currency?: string;
  score?: number; // out of 30
  fairValue?: number; // analyst mean target
}) {
  const [data, setData] = useState<CompanyData | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    fetch(`/api/company/${encodeURIComponent(ticker)}`)
      .then((r) => r.json())
      .then((d: { available?: boolean; data?: CompanyData }) => {
        if (!cancelled && d?.available && d.data) setData(d.data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [ticker]);

  const mono = monogramFor(ticker);
  const cur = currency ?? data?.currency;
  const sym = currencySymbol(cur, ticker);
  const px = price ?? data?.price;
  const prev = data?.previousClose;
  const changePct = px != null && prev != null && prev > 0 ? ((px - prev) / prev) * 100 : undefined;
  const indian = isIndianCurrency(cur, ticker);
  const sectorLine = data?.sector
    ? `${data.sector}${data.industry ? ` · ${data.industry}` : ""}`
    : undefined;

  // Upside/downside vs the analyst target — the headline SWS-style verdict pill.
  const gap = fairValue != null && px != null && px > 0 ? ((fairValue - px) / px) * 100 : undefined;

  return (
    <section className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
      <div className="overflow-hidden rounded-lg border border-white/[0.08] bg-gradient-to-br from-white/[0.055] via-white/[0.02] to-transparent">
        <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
          {/* Identity */}
          <div className="flex min-w-0 items-center gap-4">
            <span
              className="flex h-14 w-14 flex-none items-center justify-center rounded-lg font-display text-lg font-bold text-ink shadow-lg"
              style={{ background: `linear-gradient(135deg, ${mono.from}, ${mono.to})` }}
              aria-hidden
            >
              {mono.text}
            </span>
            <div className="min-w-0">
              <h2 className="truncate font-display text-2xl font-semibold text-white sm:text-3xl">
                {name ?? data?.name ?? ticker}
              </h2>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                <span className="font-mono text-slate-300">{listingLabel(ticker)}</span>
                {data?.marketCap != null ? (
                  <>
                    <span className="text-slate-600">·</span>
                    <span>Market cap {fmtCompactCur(data.marketCap, indian, "—")}</span>
                  </>
                ) : null}
                {sectorLine ? (
                  <>
                    <span className="text-slate-600">·</span>
                    <span className="truncate">{sectorLine}</span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* Price + verdict */}
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-baseline gap-2.5">
              <span className="font-mono text-3xl font-semibold tnum text-white">
                {px != null ? `${sym}${fmtPrice(px)}` : "—"}
              </span>
              {changePct != null ? (
                <span className={`font-mono text-sm tnum ${changePct >= 0 ? "text-up" : "text-down"}`}>
                  {changePct >= 0 ? "▲" : "▼"} {Math.abs(changePct).toFixed(2)}%
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {gap != null && Math.abs(gap) >= 1 ? (
                <span
                  className={`rounded-md border px-2.5 py-1 text-xs font-medium ${
                    gap > 0
                      ? "border-up/30 bg-up/10 text-up"
                      : "border-down/30 bg-down/10 text-down"
                  }`}
                >
                  {gap > 0 ? `${gap.toFixed(1)}% below fair value` : `${Math.abs(gap).toFixed(1)}% above fair value`}
                </span>
              ) : null}
              {score != null ? (
                <span className="rounded-md border border-gold/30 bg-gold/10 px-2.5 py-1 font-mono text-xs text-gold">
                  Score {score}/30
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-3 border-t border-white/[0.06] px-5 py-3 sm:px-6">
          <StockActions ticker={ticker} price={px} />
          <span className="ml-auto text-[0.68rem] text-slate-500">
            Live market data · research only, not advice
          </span>
        </div>
      </div>
    </section>
  );
}
