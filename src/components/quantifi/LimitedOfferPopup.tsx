"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProStatus } from "@/lib/useProStatus";
import {
  QUANTIFI_PRO,
  FREE_LAUNCH_OFFER,
  FREE_LAUNCH_DAYS,
  PRO_FEATURES,
  PRO_STANDARD_PRICE,
} from "@/data/plans";

// One-time launch-offer modal. Shows on first app open per browser session
// (sessionStorage flag). Dismissable; does not reappear until the tab/session
// resets. Never shown to Pro subscribers.
//
// Built on the same two-column shape as the sign-up panel: what you're being
// let into on the left, the ask on the right. A single narrow card asking for
// money is a demand; showing what's behind it first is an offer. The features
// listed are read from PRO_FEATURES rather than retyped, so this cannot drift
// from what the plan actually includes.
const SEEN_KEY = "quantifi:offer-seen";

export default function LimitedOfferPopup() {
  const { ready, pro } = useProStatus();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);

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

  // Paint the transparent state first, then flip on the next frame, so the
  // browser has something to animate from.
  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  const close = () => {
    setOpen(false);
    try {
      sessionStorage.setItem(SEEN_KEY, "1");
    } catch {
      /* ignore */
    }
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Limited-time launch offer"
      className={`fixed inset-0 z-[100] flex items-center justify-center p-4 transition-opacity duration-700 ease-out ${
        shown ? "opacity-100" : "opacity-0"
      }`}
    >
      {/* Scrim only — no backdrop blur. The blurred version of this is what put
          an opaque plate behind the logo on iOS; a flat scrim renders the same
          everywhere. */}
      <button
        aria-label="Close offer"
        onClick={close}
        className="absolute inset-0 h-full w-full cursor-default bg-ink/80"
      />

      <div
        className={`relative grid w-full max-w-3xl overflow-hidden rounded-2xl border border-gold/25 bg-ink-900 shadow-2xl transition-all duration-700 ease-out md:grid-cols-2 ${
          shown ? "translate-y-0 scale-100" : "translate-y-3 scale-[0.98]"
        }`}
      >
        <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gold/15 blur-3xl" />

        <button
          onClick={close}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>

        {/* Left: what Pro opens up. */}
        <div className="hidden border-r border-white/[0.08] bg-white/[0.02] p-7 md:block">
          <h3 className="font-editorial text-[1.5rem] leading-tight text-white">
            The whole research suite.
          </h3>
          <p className="mt-2.5 text-[0.82rem] leading-relaxed text-slate-400">
            Everything Quantifi computes, on every name you follow.
          </p>
          <ul className="mt-5 space-y-2.5">
            {PRO_FEATURES.slice(0, 5).map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-[0.82rem] text-slate-300">
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="mt-0.5 flex-none text-gold"
                  aria-hidden="true"
                >
                  <path d="m5 12.5 4.5 4.5L19 7.5" />
                </svg>
                {f}
              </li>
            ))}
          </ul>
        </div>

        {/* Right: the offer. */}
        <div className="relative p-7 text-center sm:p-9">
          <h2 className="font-display text-xl font-semibold leading-snug text-white sm:text-2xl">
            {FREE_LAUNCH_OFFER ? "Your first week of Pro is on us" : "Unlock Quantifi Pro"}
          </h2>

          {FREE_LAUNCH_OFFER ? (
            <p className="mt-2.5 text-[0.85rem] leading-relaxed text-slate-400">
              Free for {FREE_LAUNCH_DAYS} days. No card, no catch — claim it in one tap.
            </p>
          ) : (
            <p className="mt-2.5 text-[0.85rem] leading-relaxed text-slate-400">
              Full access for{" "}
              <span className="font-semibold text-gold">{QUANTIFI_PRO.price}/month</span> — standard
              price{" "}
              <span className="text-slate-300 line-through decoration-slate-500">
                {PRO_STANDARD_PRICE}/month
              </span>
              . Cancel anytime.
            </p>
          )}

          <Link
            href="/pricing"
            onClick={close}
            className="mt-6 block w-full rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-5 py-3 text-center text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Get Quantifi Pro →
          </Link>

          <button
            onClick={close}
            className="mt-3 w-full rounded-lg px-5 py-2 text-[0.82rem] text-slate-400 transition hover:text-white"
          >
            Maybe later
          </button>

          <p className="mt-5 text-[0.68rem] leading-relaxed text-slate-600">
            Cancel anytime. Research and education only — not investment advice.
          </p>
        </div>
      </div>
    </div>
  );
}
