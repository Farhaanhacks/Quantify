"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProStatus } from "@/lib/useProStatus";

// One-time launch-offer modal. Shows on first app open per browser session
// (sessionStorage flag), announcing the ₹49/month limited price vs the ₹500
// standard price. Dismissable; does not reappear until the tab/session resets.
// Never shown to Pro subscribers — they already have everything it sells.
const SEEN_KEY = "quantifi:offer-seen";

export default function LimitedOfferPopup() {
  const { ready, pro } = useProStatus();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Wait until we know the plan, and never pitch Pro to people who have it.
    if (!ready || pro) return;
    try {
      if (!sessionStorage.getItem(SEEN_KEY)) {
        // brief delay so it lands after the page paints, not mid-load
        const t = setTimeout(() => setOpen(true), 600);
        return () => clearTimeout(t);
      }
    } catch {
      /* storage blocked — just show it */
      setOpen(true);
    }
  }, [ready, pro]);

  const close = () => {
    setOpen(false);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Limited-time launch offer"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      {/* backdrop */}
      <button
        aria-label="Close offer"
        onClick={close}
        className="absolute inset-0 bg-ink/80 backdrop-blur-sm"
      />

      {/* card */}
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl border border-gold/30 bg-ink-900 p-6 shadow-2xl sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-gold/20 blur-3xl" />

        <button
          onClick={close}
          aria-label="Close"
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full border border-white/10 text-slate-400 transition hover:border-white/30 hover:text-white"
        >
          ×
        </button>

        <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-gold">
          Limited offer
        </span>

        <h2 className="mt-4 font-display text-2xl font-bold text-white">
          Quantifi Pro is ₹49<span className="text-lg font-medium text-slate-400">/month</span>
        </h2>

        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          For a limited time only. The standard price is{" "}
          <span className="font-semibold text-slate-200 line-through decoration-down/70">
            ₹500/month
          </span>{" "}
          — lock in <span className="font-semibold text-gold">₹49/month</span> while the launch
          offer lasts and unlock the full research suite.
        </p>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Link
            href="/pricing"
            onClick={close}
            className="flex-1 rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-5 py-2.5 text-center text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Claim ₹49/month →
          </Link>
          <button
            onClick={close}
            className="rounded-lg border border-white/10 px-5 py-2.5 text-sm text-slate-300 transition hover:border-white/30 hover:text-white"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
