"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard, SectionHeading, Tag } from "@/components/quantifi/Cards";
import { popularTickers } from "@/data/popularTickers";
import type { NewsArticle } from "@/lib/news";
import { analyzeNews, type Level, type Tone } from "@/lib/newsImpact";
import { useProStatus } from "@/lib/useProStatus";
import { FREE_LIMITS } from "@/data/plans";

function timeAgo(ms: number): string {
  const diff = Date.now() - ms;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

// ── Keyless analysis helpers ─────────────────────────────────────────────────
const STRIP = /\b(inc|incorporated|corp|corporation|ltd|limited|plc|co|company|platforms|industries|technologies|enterprises|holdings|group|motors|bank|the)\b/gi;

const NAME_MAP = popularTickers
  .map((p) => ({
    kw: p.n.replace(STRIP, "").replace(/[.,&]/g, " ").replace(/\s+/g, " ").trim().toLowerCase(),
    ticker: p.s,
  }))
  .filter((x) => x.kw.length >= 4);

// Index / common-phrase aliases → the ETF that tracks them.
const ALIASES: { re: RegExp; ticker: string }[] = [
  { re: /\bs&p\s*500\b|\bsp\s*500\b|\bspx\b|\bs and p 500\b/i, ticker: "SPY" },
  { re: /\bnasdaq\s*100\b|\bnasdaq\b|\bndx\b/i, ticker: "QQQ" },
  { re: /\bdow jones\b|\bdjia\b|\bdow industrials\b|\bthe dow\b/i, ticker: "DIA" },
  { re: /\brussell\s*2000\b/i, ticker: "IWM" },
  { re: /\bsemiconductor(s)?\b|\bchip stocks\b|\bsox\b/i, ticker: "SOXX" },
  { re: /\bwall street\b|\bu\.?s\.? stocks\b|\bamerican (stocks|market|markets|equities|shares)\b|\bus equities\b/i, ticker: "SPY" },
  { re: /\bsensex\b|\bnifty\b|\bnse\b|\bbse\b|\bdalal street\b|\bindian (stocks|shares|equities|market|markets)\b/i, ticker: "NIFTYBEES.NS" },
];

function detectTickers(text: string): string[] {
  const found = new Set<string>();
  // 1) index/phrase aliases (e.g. "S&P 500" -> SPY)
  for (const { re, ticker } of ALIASES) if (re.test(text)) found.add(ticker);
  // 2) company names
  const norm = ` ${text.toLowerCase().replace(/[^a-z0-9]/g, " ").replace(/\s+/g, " ")} `;
  for (const { kw, ticker } of NAME_MAP) {
    if (norm.includes(` ${kw} `)) found.add(ticker);
  }
  // 3) explicit ticker symbols (3+ chars to avoid noise)
  const upper = text.toUpperCase();
  for (const p of popularTickers) {
    const sym = p.s.replace(/\.(NS|BO)$/, "");
    if (sym.length >= 3 && new RegExp(`\\b${sym}\\b`).test(upper)) found.add(p.s);
  }
  return Array.from(found).slice(0, 8);
}

const REGIONS = ["All", "US", "India", "Global"] as const;

const LEVEL_TONE: Record<Level, "up" | "gold" | "down"> = {
  High: "up",
  Medium: "gold",
  Low: "down",
};

function Capsule({ t }: { t: string }) {
  return (
    <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[0.62rem] text-slate-300">
      {t}
    </span>
  );
}

export default function NewsFeed({ items }: { items: NewsArticle[] }) {
  const [region, setRegion] = useState<(typeof REGIONS)[number]>("All");
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<NewsArticle | null>(null);
  const { pro } = useProStatus();

  // Prefer server-side detection (full SEC universe); fall back to the client list.
  const tickersByLink = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of items) {
      m.set(a.link, a.tickers && a.tickers.length ? a.tickers : detectTickers(`${a.title} ${a.summary}`));
    }
    return m;
  }, [items]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return items.filter((a) => {
      if (region !== "All" && a.region !== region) return false;
      if (needle && !`${a.title} ${a.source}`.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [items, region, q]);

  // Free accounts see the latest few items; Pro sees the full feed.
  const visible = pro ? filtered : filtered.slice(0, FREE_LIMITS.newsPerDay);
  const hiddenCount = filtered.length - visible.length;

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const detail = selected
    ? analyzeNews({
        title: selected.title,
        summary: selected.summary,
        tickers: tickersByLink.get(selected.link) ?? [],
      })
    : null;

  const toneTag = (tone: Tone) => (tone === "positive" ? "up" : tone === "negative" ? "down" : "teal");

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="News Impact"
        title="Live market news"
        subtitle="A continuously updating feed from multiple sources. Each story shows the stocks it touches; tap for the tone and why it matters, then drill into any name."
      />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {REGIONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRegion(r)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              region === r
                ? "border-gold/50 bg-gold/15 text-gold"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
            }`}
          >
            {r}
          </button>
        ))}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search headlines…"
          className="ml-auto w-full max-w-xs rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-sm text-white outline-none focus:border-gold/40"
        />
      </div>

      <p className="mt-3 text-xs text-slate-500">{filtered.length} stories</p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((a, i) => {
          const ts = tickersByLink.get(a.link) ?? [];
          return (
            <button key={`${a.link}-${i}`} type="button" onClick={() => setSelected(a)} className="text-left">
              <GlassCard hover className="flex h-full flex-col p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate text-xs font-medium text-teal">{a.source}</span>
                  <Tag tone={a.region === "India" ? "gold" : "teal"}>{a.region}</Tag>
                </div>
                <h3 className="mt-2 line-clamp-3 font-display text-[0.95rem] font-semibold leading-snug text-white">
                  {a.title}
                </h3>
                {a.summary ? (
                  <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-400">{a.summary}</p>
                ) : null}
                {ts.length ? (
                  <div className="mt-2.5 flex flex-wrap gap-1">
                    {ts.slice(0, 4).map((t) => <Capsule key={t} t={t} />)}
                    {ts.length > 4 ? <span className="text-[0.62rem] text-slate-500">+{ts.length - 4}</span> : null}
                  </div>
                ) : null}
                <div className="mt-auto pt-3 text-[0.7rem] text-slate-500">{timeAgo(a.publishedMs)}</div>
              </GlassCard>
            </button>
          );
        })}
      </div>

      {!pro && hiddenCount > 0 ? (
        <Link
          href="/pricing"
          className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-gold/25 bg-gold/[0.05] p-6 text-center transition hover:border-gold/40"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full border border-gold/40 bg-gold/15 text-gold">🔒</span>
          <span className="text-sm font-semibold text-white">
            {hiddenCount} more {hiddenCount === 1 ? "story" : "stories"} in the live feed
          </span>
          <span className="max-w-md text-xs leading-relaxed text-slate-400">
            Free accounts see the latest {FREE_LIMITS.newsPerDay} news-impact items. Quantifi Pro unlocks the
            full, continuously updating feed.
          </span>
          <span className="mt-1 rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-3 py-1 text-[0.7rem] font-semibold text-ink">
            Unlock with Pro →
          </span>
        </Link>
      ) : null}

      {visible.length === 0 ? (
        <GlassCard className="mt-4 p-10 text-center">
          <p className="text-sm text-slate-400">
            {items.length === 0
              ? "Couldn't reach the news feeds right now — they refresh automatically, so try again shortly."
              : "No stories match that filter."}
          </p>
        </GlassCard>
      ) : null}

      {/* Article analysis modal */}
      {selected && detail ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-2xl sm:p-8">
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="absolute right-4 top-4 rounded-md px-2 py-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
            >
              ✕
            </button>

            {/* 1 · Header badges */}
            <h3 className="font-display text-xl font-semibold leading-snug text-white">{selected.title}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="font-medium text-teal">{selected.source}</span>
              <span className="text-slate-500">· {timeAgo(selected.publishedMs)}</span>
              <Tag tone={selected.region === "India" ? "gold" : "teal"}>{selected.region}</Tag>
              <Tag tone={toneTag(detail.tone)}>{detail.tone} tone</Tag>
              <Tag tone={LEVEL_TONE[detail.impact]}>{detail.impact} impact</Tag>
              <Tag tone="neutral">{detail.confidence}% confidence</Tag>
            </div>

            {/* 2 · What changed */}
            <div className="mt-5">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">What changed</div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{detail.whatChanged}</p>
              {selected.summary ? (
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{selected.summary}</p>
              ) : null}
            </div>

            {/* 3 · Why it matters */}
            <div className="mt-4 rounded-xl border border-gold/20 bg-gold/[0.06] p-4">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-gold/80">Why it matters</div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{detail.whyItMatters}</p>
            </div>

            {/* 4 · Impact map */}
            <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="mb-3 text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Impact map</div>
              <ol className="space-y-0">
                {detail.impactMap.map((s, i) => (
                  <li key={s} className="relative pl-7">
                    <span className="absolute left-0 top-0.5 grid h-5 w-5 place-items-center rounded-full border border-gold/30 bg-gold/10 text-[0.6rem] font-semibold text-gold">
                      {i + 1}
                    </span>
                    {i < detail.impactMap.length - 1 ? (
                      <span className="absolute left-[9px] top-6 h-[calc(100%-1.25rem)] w-px bg-gradient-to-b from-gold/40 to-transparent" />
                    ) : null}
                    <p className={`pb-4 text-sm leading-snug ${i === detail.impactMap.length - 1 ? "text-white" : "text-slate-300"}`}>
                      {s}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            {/* 5 · Stocks affected */}
            <div className="mt-5">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Stocks affected</div>
              {detail.affected.length ? (
                <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {detail.affected.map((a) => (
                    <div key={a.ticker} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-sm text-white">{a.ticker}</span>
                        {a.primary ? <Tag tone="gold">Primary</Tag> : <span className="text-[0.65rem] text-slate-500">Read-through</span>}
                      </div>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">{a.role}</p>
                      <p className="mt-1 text-xs leading-relaxed text-slate-400">
                        <span className="text-slate-500">Why: </span>{a.why}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.65rem]">
                        <span className={a.impact === "High" ? "text-up" : a.impact === "Medium" ? "text-gold" : "text-slate-400"}>
                          Impact: {a.impact}
                        </span>
                        <span className="text-slate-400">Confidence: {a.confidence}</span>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                        <span className="text-slate-500">Watch: </span>{a.watch}
                      </p>
                      <Link
                        href={`/stock-analysis?symbol=${encodeURIComponent(a.ticker)}`}
                        onClick={() => setSelected(null)}
                        className="mt-2 inline-block text-[0.7rem] text-gold underline-offset-2 hover:underline"
                      >
                        Open analysis →
                      </Link>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No tracked companies were detected by name in this headline.</p>
              )}
            </div>

            {/* 6 · Linked Quantifi themes */}
            {detail.themes.length ? (
              <div className="mt-5">
                <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">Linked Quantifi themes</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {detail.themes.map((t) => (
                    <Link
                      key={t.id}
                      href={`/ideas?theme=${encodeURIComponent(t.id)}`}
                      onClick={() => setSelected(null)}
                      className="inline-flex items-center rounded-full border border-gold/25 bg-gold/[0.06] px-3 py-1 text-xs text-gold transition hover:border-gold/50"
                    >
                      {t.label} →
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}

            {/* 7 · What to watch next */}
            <div className="mt-5">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">What to watch next</div>
              <ul className="mt-2 space-y-1.5">
                {detail.watchNext.map((w) => (
                  <li key={w} className="flex items-start gap-2 text-xs text-slate-400">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-gold" />
                    {w}
                  </li>
                ))}
              </ul>
            </div>

            {/* 8 · Signal classification */}
            <div className="mt-5 grid grid-cols-1 gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 sm:grid-cols-3">
              <div>
                <div className="text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">Signal type</div>
                <div className="mt-1 text-xs font-medium text-slate-200">{detail.signalType}</div>
              </div>
              <div>
                <div className="text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">Thesis relevance</div>
                <div className="mt-1 text-xs font-medium text-slate-200">{detail.thesisRelevance}</div>
              </div>
              <div>
                <div className="text-[0.58rem] uppercase tracking-[0.16em] text-slate-500">Time horizon</div>
                <div className="mt-1 text-xs font-medium text-slate-200">{detail.timeHorizon}</div>
              </div>
            </div>

            {/* 9 · Footer */}
            <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/[0.06] pt-4">
              <a
                href={selected.link}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90"
              >
                Read full article ↗
              </a>
              <p className="text-xs text-slate-500">
                Auto-generated impact map. Research starting point, not a recommendation.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
