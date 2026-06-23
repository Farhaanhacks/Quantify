"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWatchlist } from "@/lib/useWatchlist";
import { usePortfolios } from "@/lib/usePortfolios";

interface Notif {
  id: string;
  ticker: string;
  type: "news" | "move";
  title: string;
  detail?: string;
  url?: string;
  source?: string;
  ts: number;
}

const SEEN_KEY = "quantifi:notif-seen"; // ms timestamp the panel was last opened
const PUSHED_KEY = "quantifi:notif-pushed"; // ids already shown as browser notifications
const POLL_MS = 5 * 60 * 1000; // refresh every 5 minutes while open

function rel(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function readPushed(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(PUSHED_KEY) || "[]"));
  } catch {
    return new Set();
  }
}

export default function NotificationBell() {
  const { data: watch, ready: wReady } = useWatchlist();
  const { portfolios, ready: pReady } = usePortfolios();

  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<Notif[]>([]);
  const [loading, setLoading] = useState(false);
  const [seen, setSeen] = useState(0);
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Tickers to watch = watchlist stocks + every holding across portfolios.
  const tickers = useMemo(() => {
    const set = new Set<string>();
    for (const t of watch.stocks) set.add(t.toUpperCase());
    for (const p of portfolios ?? [])
      for (const h of p.holdings) set.add(h.ticker.toUpperCase());
    return Array.from(set).slice(0, 10);
  }, [watch.stocks, portfolios]);

  const tickerKey = tickers.join(",");
  const ready = wReady && pReady;

  // Restore "last seen" + notification permission once on the client.
  useEffect(() => {
    try {
      setSeen(Number(localStorage.getItem(SEEN_KEY) || 0));
    } catch {
      /* ignore */
    }
    if (typeof Notification === "undefined") setPerm("unsupported");
    else setPerm(Notification.permission);
  }, []);

  // Fire desktop/mobile browser notifications for genuinely new items (once each).
  const pushNew = useCallback((items: Notif[]) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    const pushed = readPushed();
    const fresh = items
      .filter((n) => !pushed.has(n.id) && Date.now() - n.ts < 24 * 3600 * 1000)
      .slice(0, 3); // never spam
    for (const n of fresh) {
      try {
        const note = new Notification(`Quantifi · ${n.ticker}`, {
          body: n.title,
          icon: "/logo-icon.png",
          tag: n.id,
        });
        if (n.url)
          note.onclick = () => {
            window.open(n.url, "_blank", "noopener");
            note.close();
          };
        pushed.add(n.id);
      } catch {
        /* ignore */
      }
    }
    try {
      localStorage.setItem(PUSHED_KEY, JSON.stringify(Array.from(pushed).slice(-300)));
    } catch {
      /* ignore */
    }
  }, []);

  const load = useCallback(async () => {
    if (!tickerKey) {
      setNotifs([]);
      return;
    }
    setLoading(true);
    try {
      const r = await fetch(`/api/notifications?tickers=${encodeURIComponent(tickerKey)}`);
      const d = (await r.json()) as { notifs?: Notif[] };
      const list = d.notifs ?? [];
      setNotifs(list);
      pushNew(list);
    } catch {
      /* keep what we have */
    } finally {
      setLoading(false);
    }
  }, [tickerKey, pushNew]);

  // Poll while mounted.
  useEffect(() => {
    if (!ready) return;
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [ready, load]);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = useMemo(() => notifs.filter((n) => n.ts > seen).length, [notifs, seen]);

  const markSeen = useCallback(() => {
    const now = Date.now();
    setSeen(now);
    try {
      localStorage.setItem(SEEN_KEY, String(now));
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = () => {
    setOpen((v) => {
      const next = !v;
      if (next) markSeen();
      return next;
    });
  };

  const enableAlerts = async () => {
    if (typeof Notification === "undefined") return;
    try {
      const p = await Notification.requestPermission();
      setPerm(p);
      if (p === "granted") pushNew(notifs);
    } catch {
      /* ignore */
    }
  };

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="Notifications"
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-slate-200 transition hover:border-white/30 hover:text-white"
      >
        {/* bell glyph */}
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path
            d="M12 3a6 6 0 0 0-6 6v3.6L4.5 16h15L18 12.6V9a6 6 0 0 0-6-6Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path d="M9.5 19a2.5 2.5 0 0 0 5 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-gold px-1 text-[0.6rem] font-bold text-ink">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-white/10 bg-ink-900 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <span className="font-display text-sm font-semibold text-white">Notifications</span>
            <button
              onClick={load}
              className="text-[0.7rem] text-slate-400 transition hover:text-white"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>

          {/* browser-alert opt-in */}
          {perm === "default" ? (
            <button
              onClick={enableAlerts}
              className="block w-full border-b border-white/[0.06] bg-gold/[0.06] px-4 py-2.5 text-left text-xs text-gold transition hover:bg-gold/[0.1]"
            >
              🔔 Turn on browser alerts for these tickers →
            </button>
          ) : perm === "granted" ? (
            <div className="border-b border-white/[0.06] px-4 py-2 text-[0.7rem] text-slate-500">
              ✓ Browser alerts on — you&apos;ll be pinged about big moves &amp; news while Quantifi is open.
            </div>
          ) : perm === "denied" ? (
            <div className="border-b border-white/[0.06] px-4 py-2 text-[0.7rem] text-slate-500">
              Browser alerts are blocked in your browser settings. In-app alerts still work.
            </div>
          ) : null}

          <div className="max-h-[24rem] overflow-y-auto">
            {!ready || (loading && notifs.length === 0) ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">Loading alerts…</p>
            ) : tickers.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                Add stocks to your watchlist or portfolio and Quantifi will alert you to their news and big moves here.
              </p>
            ) : notifs.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-slate-500">
                You&apos;re all caught up — no recent news or outsized moves on your{" "}
                {tickers.length} tracked {tickers.length === 1 ? "name" : "names"}.
              </p>
            ) : (
              <ul className="divide-y divide-white/[0.05]">
                {notifs.map((n) => {
                  const isNew = n.ts > seen;
                  const body = (
                    <div className="flex gap-3 px-4 py-3">
                      <span
                        className={`mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs ${
                          n.type === "move"
                            ? n.title.includes(" up ")
                              ? "bg-up/15 text-up"
                              : "bg-down/15 text-down"
                            : "bg-teal/15 text-teal"
                        }`}
                      >
                        {n.type === "move" ? "％" : "▤"}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[0.7rem] text-gold">{n.ticker}</span>
                          {isNew ? <span className="h-1.5 w-1.5 rounded-full bg-gold" /> : null}
                          <span className="ml-auto text-[0.65rem] text-slate-500">{rel(n.ts)}</span>
                        </div>
                        <p className="mt-0.5 text-sm leading-snug text-slate-200">{n.title}</p>
                        {n.source ? (
                          <p className="mt-0.5 text-[0.65rem] text-slate-500">{n.source}</p>
                        ) : null}
                      </div>
                    </div>
                  );
                  return (
                    <li key={n.id} className="transition hover:bg-white/[0.03]">
                      {n.url ? (
                        <a href={n.url} target="_blank" rel="noopener noreferrer" className="block">
                          {body}
                        </a>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="border-t border-white/[0.06] px-4 py-2 text-[0.62rem] leading-relaxed text-slate-600">
            Alerts cover news &amp; outsized moves on your watchlist and portfolio. Background push (when Quantifi is closed) is coming soon.
          </p>
        </div>
      ) : null}
    </div>
  );
}
