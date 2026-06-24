"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PriceChart from "@/components/quantifi/PriceChart";
import { Tag } from "@/components/quantifi/Cards";

export interface Thesis {
  ticker: string;
  company: string;
  author: string;
  role: string;
  badge?: string;
  title: string;
  body: string;
  tags: string[];
  when: string;
  initials: string;
}

interface ScoreResponse {
  available: boolean;
  price?: number;
  name?: string;
  analytics?: { fairValue?: { estimate: number } };
}

// Currency symbol: ₹ for NSE/BSE listings, $ otherwise (good enough for the
// community tickers we surface).
function ccy(ticker: string): string {
  const u = ticker.toUpperCase();
  return u.endsWith(".NS") || u.endsWith(".BO") ? "₹" : "$";
}

function fmt(n: number, sym: string): string {
  return `${sym}${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

// Detail view for a contributor's stock thesis: the company's fair value vs its
// live price, the chart, and what the contributor has to say. Mirrors the
// "click a stock → see the chart and the take" flow.
export default function CommunityThesisModal({
  thesis,
  onClose,
}: {
  thesis: Thesis;
  onClose: () => void;
}) {
  const [score, setScore] = useState<ScoreResponse | null>(null);
  const sym = ccy(thesis.ticker);

  // Lock background scroll + close on Escape while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  useEffect(() => {
    let cancelled = false;
    setScore(null);
    fetch(`/api/score/${encodeURIComponent(thesis.ticker)}`)
      .then((r) => r.json())
      .then((d: ScoreResponse) => !cancelled && setScore(d))
      .catch(() => !cancelled && setScore({ available: false }));
    return () => {
      cancelled = true;
    };
  }, [thesis.ticker]);

  const price = score?.price;
  const fair = score?.analytics?.fairValue?.estimate;
  const upside =
    price && fair && price > 0 ? ((fair - price) / price) * 100 : undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${thesis.company} — ${thesis.title}`}
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-3 sm:p-6"
    >
      <button aria-label="Close" onClick={onClose} className="fixed inset-0 bg-ink/80 backdrop-blur-sm" />

      <div className="relative my-4 w-full max-w-2xl overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg font-semibold text-white">{thesis.company}</span>
              <span className="font-mono text-xs text-gold">{thesis.ticker}</span>
            </div>
            <div className="mt-1 text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">
              Community thesis
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-white/10 text-slate-400 transition hover:border-white/30 hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-5 sm:px-6">
          {/* Fair value vs share price */}
          <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
            <div>
              <div className="text-[0.7rem] uppercase tracking-wide text-slate-500">Fair value</div>
              <div className="font-display text-2xl font-semibold text-white">
                {fair ? fmt(fair, sym) : "—"}
              </div>
            </div>
            <div>
              <div className="text-[0.7rem] uppercase tracking-wide text-slate-500">Share price</div>
              <div className="font-display text-2xl font-semibold text-white">
                {price ? fmt(price, sym) : "—"}
              </div>
            </div>
            {upside !== undefined ? (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  upside >= 0 ? "bg-up/15 text-up" : "bg-down/15 text-down"
                }`}
              >
                {upside >= 0
                  ? `${upside.toFixed(0)}% undervalued`
                  : `${Math.abs(upside).toFixed(0)}% overvalued`}
              </span>
            ) : null}
          </div>

          {/* Chart */}
          <div className="mt-4">
            <PriceChart symbol={thesis.ticker} height={260} />
          </div>

          {/* The take */}
          <div className="mt-6 flex items-center gap-3">
            <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-gold/30 bg-gold/10 font-display text-sm font-semibold text-gold">
              {thesis.initials}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-white">{thesis.author}</span>
                {thesis.badge ? (
                  <span className="rounded-full border border-gold/40 bg-gold/10 px-2 py-0.5 text-[0.62rem] font-medium text-gold">
                    ◆ {thesis.badge}
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-slate-500">
                {thesis.role} · {thesis.when}
              </div>
            </div>
          </div>

          <h3 className="mt-4 font-display text-xl font-bold leading-snug text-white">{thesis.title}</h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-300">{thesis.body}</p>

          <div className="mt-4 flex flex-wrap gap-1.5">
            {thesis.tags.map((t) => (
              <Tag key={t} tone="gold">
                {t}
              </Tag>
            ))}
          </div>

          <div className="mt-6 border-t border-white/[0.06] pt-4">
            <Link
              href={`/stock-analysis?symbol=${encodeURIComponent(thesis.ticker)}`}
              className="inline-flex rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-5 py-2 text-sm font-semibold text-ink transition hover:opacity-90"
            >
              Open full {thesis.ticker} analysis →
            </Link>
            <p className="mt-3 text-[0.7rem] leading-relaxed text-slate-600">
              Community theses are the contributor&apos;s own educational views — not advice from
              Quantifi, and never a recommendation to buy, sell or hold.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
