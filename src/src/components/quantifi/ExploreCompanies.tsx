"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  GlassCard,
  SectionHeading,
  TickerChip,
  ChangePill,
  Sparkline,
  Tag,
} from "@/components/quantifi/Cards";
import {
  stocks,
  tradingIdeas,
  fmtPrice,
  dirOf,
  type MarketRegion,
} from "@/data/demo";

type Tab = "Investing Ideas" | "Browse All Stocks" | "Markets";
const tabs: Tab[] = ["Investing Ideas", "Browse All Stocks", "Markets"];
const regions: MarketRegion[] = ["Global", "India", "US"];

const marketRows: { region: Exclude<MarketRegion, "Global">; venues: string[]; note: string }[] = [
  { region: "US", venues: ["NYSE", "NASDAQ"], note: "Deepest coverage — broad large- and mid-cap exposure." },
  { region: "India", venues: ["NSE", "BSE"], note: "IT services and large-cap conglomerate exposure." },
];

export default function ExploreCompanies({
  heading = true,
  preview = false,
}: {
  heading?: boolean;
  preview?: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Browse All Stocks");
  const [region, setRegion] = useState<MarketRegion>("Global");

  const visibleStocks = useMemo(
    () => (region === "Global" ? stocks : stocks.filter((s) => s.region === region)),
    [region],
  );

  const shownStocks = preview ? visibleStocks.slice(0, 6) : visibleStocks;

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Explore"
          title="Explore companies & ETFs"
          subtitle="Browse the demo universe by idea, by name, or by market. A discovery surface, not a screener of recommendations."
          href={preview ? "/explore" : undefined}
          cta={preview ? "Open explorer" : undefined}
        />
      ) : null}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-3.5 py-1.5 text-xs transition ${
                tab === t ? "bg-gold/15 text-gold" : "text-slate-400 hover:text-white"
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Market selector */}
        <div className="inline-flex items-center gap-2">
          <span className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">Market</span>
          <div className="inline-flex rounded-full border border-white/10 bg-white/[0.03] p-1">
            {regions.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRegion(r)}
                className={`rounded-full px-3 py-1.5 text-xs transition ${
                  region === r ? "bg-teal/15 text-teal" : "text-slate-400 hover:text-white"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {tab === "Browse All Stocks" ? (
          <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shownStocks.map((s) => (
              <Link key={s.ticker} href={`/stock-analysis?symbol=${s.ticker}`}>
                <GlassCard hover className="h-full p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <TickerChip ticker={s.ticker} />
                      <p className="mt-2 text-sm font-medium text-white">{s.name}</p>
                      <p className="text-xs text-slate-500">
                        {s.exchange} · {s.sector}
                      </p>
                    </div>
                    <Sparkline data={s.spark} dir={dirOf(s.changePct)} className="h-9 w-20" />
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="font-mono text-sm tnum text-white">{fmtPrice(s.price)}</span>
                    <ChangePill value={s.changePct} />
                  </div>
                  <div className="mt-3 text-xs text-gold/80">View analysis →</div>
                </GlassCard>
              </Link>
            ))}
            {visibleStocks.length === 0 ? (
              <p className="text-sm text-slate-500">No demo names for this market yet.</p>
            ) : null}
          </div>
          {preview && visibleStocks.length > shownStocks.length ? (
            <div className="mt-4 text-center">
              <Link
                href="/explore"
                className="inline-flex items-center gap-1 rounded-full border border-gold/30 bg-gold/10 px-4 py-2 text-sm text-gold transition hover:bg-gold/20"
              >
                View all {visibleStocks.length} companies →
              </Link>
            </div>
          ) : null}
          </>
        ) : null}

        {tab === "Investing Ideas" ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tradingIdeas.map((idea) => (
              <Link key={idea.id} href="/ideas">
                <GlassCard hover className="h-full p-4">
                  <Tag tone="teal">{idea.category}</Tag>
                  <h3 className="mt-2 text-sm font-semibold text-white">{idea.title}</h3>
                  <p className="mt-1 text-xs text-slate-400">{idea.tagline}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {idea.tickers.slice(0, 3).map((t) => (
                      <TickerChip key={t} ticker={t} />
                    ))}
                  </div>
                </GlassCard>
              </Link>
            ))}
          </div>
        ) : null}

        {tab === "Markets" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {marketRows
              .filter((m) => region === "Global" || m.region === region)
              .map((m) => (
                <GlassCard key={m.region} className="p-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-base font-semibold text-white">{m.region}</h3>
                    <div className="flex gap-1.5">
                      {m.venues.map((v) => (
                        <Tag key={v} tone="neutral">
                          {v}
                        </Tag>
                      ))}
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-400">{m.note}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {stocks
                      .filter((s) => s.region === m.region)
                      .slice(0, 6)
                      .map((s) => (
                        <TickerChip key={s.ticker} ticker={s.ticker} />
                      ))}
                  </div>
                </GlassCard>
              ))}
            {region === "Global" ? (
              <GlassCard className="p-5">
                <h3 className="font-display text-base font-semibold text-white">More markets</h3>
                <p className="mt-2 text-sm text-slate-400">
                  UK (FTSE), Canada (TSX), Australia (ASX) and Japan (NIKKEI) are part of the
                  roadmap.
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {["FTSE", "TSX", "ASX", "NIKKEI"].map((v) => (
                    <Tag key={v} tone="gold">
                      {v}
                    </Tag>
                  ))}
                </div>
              </GlassCard>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
