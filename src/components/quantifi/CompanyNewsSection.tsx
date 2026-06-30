"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/quantifi/Cards";
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

// A dedicated, self-contained news section for a company/fund. Articles open in
// an in-site modal (with the publisher's summary) rather than navigating away.
export default function CompanyNewsSection({
  symbol,
  name,
}: {
  symbol: string;
  name?: string;
}) {
  const [items, setItems] = useState<NewsArticle[] | null>(null);
  const [selected, setSelected] = useState<NewsArticle | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    const qs = name
      ? `ticker=${encodeURIComponent(symbol)}&name=${encodeURIComponent(name)}`
      : `ticker=${encodeURIComponent(symbol)}`;
    fetch(`/api/news-for?${qs}`)
      .then((r) => r.json())
      .then((d: { articles?: NewsArticle[] }) => {
        if (!cancelled) setItems(Array.isArray(d.articles) ? d.articles : []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, name]);

  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSelected(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const copyLink = async () => {
    if (!selected) return;
    try {
      await navigator.clipboard.writeText(selected.link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — the Read full article link still works */
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      <h3 className="font-display text-lg font-semibold text-white">Recent News &amp; Updates</h3>
      <p className="mt-1 text-xs text-slate-500">
        Latest coverage for {name ?? symbol} — tap a story to read it here.
      </p>

      {items === null ? (
        <GlassCard className="mt-4 p-6">
          <p className="text-sm text-slate-500">Loading news…</p>
        </GlassCard>
      ) : items.length === 0 ? (
        <GlassCard className="mt-4 p-6">
          <p className="text-sm text-slate-500">No recent news found for {symbol}.</p>
        </GlassCard>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((a, i) => (
            <button key={`${a.link}-${i}`} type="button" onClick={() => setSelected(a)} className="text-left">
              <GlassCard hover className="flex h-full flex-col p-4">
                <div className="flex items-center gap-2 text-[0.7rem] text-slate-500">
                  <span className="truncate text-teal">{a.source}</span>
                  <span>· {timeAgo(a.publishedMs)}</span>
                </div>
                <h4 className="mt-1 line-clamp-2 text-sm font-semibold leading-snug text-slate-100">
                  {a.title}
                </h4>
                {a.summary ? (
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-400">{a.summary}</p>
                ) : null}
              </GlassCard>
            </button>
          ))}
        </div>
      )}

      {/* In-site article modal */}
      {selected ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className="relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-white/10 bg-ink-900 p-6 shadow-2xl sm:p-8">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">
                <span className="text-teal">{selected.source}</span> · {timeAgo(selected.publishedMs)}
              </span>
              <button
                onClick={() => setSelected(null)}
                aria-label="Close"
                className="rounded-md px-2 py-1 text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
              >
                ✕
              </button>
            </div>

            <h3 className="mt-3 font-display text-xl font-semibold leading-snug text-white">
              {selected.title}
            </h3>
            <div className="mt-3 h-px w-full bg-white/10" />

            {selected.summary ? (
              <p className="mt-4 text-sm leading-relaxed text-slate-300">{selected.summary}</p>
            ) : (
              <p className="mt-4 text-sm text-slate-400">
                No preview text is available for this story.
              </p>
            )}
            <p className="mt-3 text-xs text-slate-500">
              Publisher&apos;s summary shown here — open the full article for the complete story.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3 border-t border-white/[0.06] pt-4">
              <button
                onClick={copyLink}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30"
              >
                {copied ? "Copied!" : "Copy link"}
              </button>
              <a
                href={selected.link}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-4 py-2 text-sm font-semibold text-ink transition hover:opacity-90"
              >
                Read full article ↗
              </a>
              <button
                onClick={() => setSelected(null)}
                className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-white/30"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
