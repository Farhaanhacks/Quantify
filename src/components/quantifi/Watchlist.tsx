"use client";

import { useState } from "react";
import {
  GlassCard,
  SectionHeading,
  ChangePill,
  TickerChip,
  Tag,
} from "@/components/quantifi/Cards";
import { watchlist, stockByTicker, fmtPrice } from "@/data/demo";

function alertTone(type: string): "gold" | "teal" | "down" | "neutral" {
  if (type === "Insider") return "down";
  if (type === "News lens") return "gold";
  if (type === "Event") return "teal";
  return "neutral";
}

export default function Watchlist({ heading = true }: { heading?: boolean }) {
  const [alerts, setAlerts] = useState(watchlist.alerts);

  const toggle = (id: string) =>
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, active: !a.active } : a))
    );

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {heading ? (
        <SectionHeading
          eyebrow="Watchlist"
          title="Everything you're tracking"
          subtitle="Saved stocks, themes and narratives in one place — plus the alerts you've set as research reminders."
        />
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Saved stocks */}
        <GlassCard className="p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-lg font-semibold text-white">
              Saved stocks
            </h3>
            <span className="text-xs text-slate-500">
              {watchlist.savedStocks.length} tracked
            </span>
          </div>
          <ul className="mt-4 divide-y divide-white/[0.05]">
            {watchlist.savedStocks.map((ticker) => {
              const stock = stockByTicker[ticker];
              return (
                <li
                  key={ticker}
                  className="flex items-center justify-between py-3"
                >
                  <div className="flex items-center gap-3">
                    <TickerChip ticker={ticker} />
                    <span className="hidden text-sm text-slate-300 sm:inline">
                      {stock?.name ?? "—"}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {stock ? (
                      <>
                        <span className="font-mono text-sm tnum text-white">
                          ${fmtPrice(stock.price)}
                        </span>
                        <ChangePill value={stock.changePct} size="xs" />
                      </>
                    ) : (
                      <span className="text-xs text-slate-500">demo</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </GlassCard>

        {/* Saved themes + takes */}
        <div className="space-y-4">
          <GlassCard className="p-5 sm:p-6">
            <h3 className="font-display text-lg font-semibold text-white">
              Saved themes
            </h3>
            <div className="mt-4 flex flex-wrap gap-2">
              {watchlist.savedThemes.map((t) => (
                <Tag key={t.id} tone="teal">
                  {t.label}
                </Tag>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="p-5 sm:p-6">
            <h3 className="font-display text-lg font-semibold text-white">
              Saved famous takes
            </h3>
            <ul className="mt-4 space-y-2">
              {watchlist.savedTakes.map((t) => (
                <li
                  key={t.id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-sm text-slate-300"
                >
                  {t.label}
                </li>
              ))}
            </ul>
          </GlassCard>
        </div>
      </div>

      {/* Alerts */}
      <GlassCard className="mt-4 p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-white">Alerts</h3>
          <span className="text-xs text-slate-500">
            {alerts.filter((a) => a.active).length} active
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Demo reminders — toggle to simulate turning a research alert on or off.
        </p>
        <ul className="mt-4 space-y-2.5">
          {alerts.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3"
            >
              <div className="flex items-start gap-3">
                <TickerChip ticker={a.ticker} />
                <div>
                  <p className="text-sm text-slate-200">{a.text}</p>
                  <div className="mt-1">
                    <Tag tone={alertTone(a.type)}>{a.type}</Tag>
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={a.active}
                onClick={() => toggle(a.id)}
                className={`relative inline-flex h-6 w-11 flex-none items-center rounded-full border transition ${
                  a.active
                    ? "border-gold/40 bg-gold/30"
                    : "border-white/10 bg-white/[0.06]"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    a.active ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </li>
          ))}
        </ul>
      </GlassCard>
    </section>
  );
}
