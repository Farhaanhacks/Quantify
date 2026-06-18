"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard, SectionHeading, Tag } from "@/components/quantifi/Cards";
import { popularTickers } from "@/data/popularTickers";
import type { NewsArticle } from "@/lib/news";

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
  { re: /\bdow jones\b|\bdjia\b|\bdow industrials\b/i, ticker: "DIA" },
  { re: /\brussell\s*2000\b/i, ticker: "IWM" },
  { re: /\bsemiconductor(s)?\b|\bchip stocks\b|\bsox\b/i, ticker: "SOXX" },
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

const POS = ["surge", "jump", "gain", "beat", "rally", "soar", "record", "upgrade", "profit", "rise", "rose", "boost", "outperform", "strong", "high"];
const NEG = ["plunge", "fall", "fell", "drop", "miss", "cut", "loss", "downgrade", "slump", "crash", "lawsuit", "probe", "warn", "weak", "decline", "tumble", "sink", "fear", "selloff", "sell-off"];

type Tone = "positive" | "negative" | "mixed" | "neutral";

function sentiment(text: string): Tone {
  const t = text.toLowerCase();
  let p = 0, n = 0;
  for (const w of POS) if (t.includes(w)) p++;
  for (const w of NEG) if (t.includes(w)) n++;
  if (p > 0 && n > 0) return "mixed";
  if (p > 0) return "positive";
  if (n > 0) return "negative";
  return "neutral";
}

function themeNote(text: string): string {
  const t = text.toLowerCase();
  if (/earnings|results|revenue|quarter|guidance|\beps\b/.test(t))
    return "Earnings and guidance move a stock quickly and often ripple to peers in the same space.";
  if (/\bfed\b|interest rate|rate cut|rate hike|inflation|\bcpi\b|jobs report|\bgdp\b/.test(t))
    return "Macro news like this tends to move whole sectors and indices, not just one name.";
  if (/acquir|merger|buyout|\bdeal\b|takeover|stake/.test(t))
    return "Deals reprice the companies involved — and frequently their competitors too.";
  if (/lawsuit|probe|investigat|regulat|antitrust|\bfine\b|\bban\b/.test(t))
    return "Legal and regulatory headlines can weigh on sentiment well beyond the case itself.";
  if (/launch|unveil|product|\bchip\b|partnership/.test(t))
    return "Product and partnership news shapes the longer-term growth story more than the next print.";
  if (/upgrade|downgrade|price target|analyst|rating/.test(t))
    return "Analyst rating moves nudge short-term sentiment but aren't fundamentals themselves.";
  return "Read it alongside the company's fundamentals before drawing any conclusion.";
}

function significance(text: string, tickers: string[], tone: Tone): string {
  const names = tickers.length ? tickers.slice(0, 3).join(", ") : "the broader market";
  const toneWord =
    tone === "positive" ? "a potential tailwind" :
    tone === "negative" ? "a potential headwind" :
    tone === "mixed" ? "a mixed signal" : "context";
  return `Reads as ${toneWord} for ${names}. ${themeNote(text)}`;
}

const REGIONS = ["All", "US", "India", "Global"] as const;

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

  // Precompute detected tickers per article once.
  const tickersByLink = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const a of items) m.set(a.link, detectTickers(`${a.title} ${a.summary}`));
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

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const detail = selected
    ? (() => {
        const tickers = tickersByLink.get(selected.link) ?? [];
        const tone = sentiment(`${selected.title} ${selected.summary}`);
        return { tickers, tone, why: significance(`${selected.title} ${selected.summary}`, tickers, tone) };
      })()
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

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((a, i) => {
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

      {filtered.length === 0 ? (
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

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-medium text-teal">{selected.source}</span>
              <span className="text-slate-500">· {timeAgo(selected.publishedMs)}</span>
              <Tag tone={selected.region === "India" ? "gold" : "teal"}>{selected.region}</Tag>
              <Tag tone={toneTag(detail.tone)}>{detail.tone} tone</Tag>
            </div>

            <h3 className="mt-3 font-display text-xl font-semibold leading-snug text-white">{selected.title}</h3>
            {selected.summary ? (
              <p className="mt-3 text-sm leading-relaxed text-slate-300">{selected.summary}</p>
            ) : null}

            {/* Why it matters */}
            <div className="mt-5 rounded-xl border border-gold/20 bg-gold/[0.06] p-4">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-gold/80">Why it matters</div>
              <p className="mt-1.5 text-sm leading-relaxed text-slate-200">{detail.why}</p>
            </div>

            {/* Affected stocks */}
            <div className="mt-5">
              <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">
                Stocks affected — tap for full analysis
              </div>
              {detail.tickers.length ? (
                <div className="mt-2.5 flex flex-wrap gap-2">
                  {detail.tickers.map((t) => (
                    <Link
                      key={t}
                      href={`/stock-analysis?symbol=${t}`}
                      onClick={() => setSelected(null)}
                      className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-sm text-slate-200 transition hover:border-gold/40 hover:text-white"
                    >
                      {t}
                      <span className={detail.tone === "positive" ? "text-up" : detail.tone === "negative" ? "text-down" : "text-slate-500"}>
                        {detail.tone === "positive" ? "↑" : detail.tone === "negative" ? "↓" : "→"}
                      </span>
                    </Link>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500">No tracked companies were detected by name in this headline.</p>
              )}
            </div>

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
                Stocks and significance are auto-detected from the text — a quick read, not a verdict.
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
