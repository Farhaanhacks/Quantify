"use client";

import { useEffect, useRef, useState } from "react";
import { GlassCard } from "@/components/quantifi/Cards";

const keyFor = (t: string) => `quantifi:notes:${t.toUpperCase()}`;

// Per-stock scratchpad. Notes are saved locally on the device (auto-saved as you
// type), so the user can jot a thesis, target or risks against any ticker.
export default function MyNotes({ ticker }: { ticker: string }) {
  const [text, setText] = useState("");
  const [saved, setSaved] = useState(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    try {
      setText(localStorage.getItem(keyFor(ticker)) || "");
    } catch {
      setText("");
    }
    setSaved(true);
  }, [ticker]);

  const onChange = (v: string) => {
    setText(v);
    setSaved(false);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try {
        localStorage.setItem(keyFor(ticker), v);
      } catch {
        /* storage blocked */
      }
      setSaved(true);
    }, 500);
  };

  return (
    <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold text-white">
          My notes <span className="font-mono text-sm text-slate-500">· {ticker}</span>
        </h3>
        <span className={`text-xs ${saved ? "text-slate-500" : "text-gold"}`}>
          {saved ? "Saved ✓" : "Saving…"}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500">
        Private to this device — your thesis, target price, or risks to track on {ticker}.
      </p>
      <GlassCard className="mt-4 p-4">
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Why are you watching ${ticker}? Your thesis, fair-value target, catalysts and risks…`}
          className="min-h-[140px] w-full resize-y rounded-lg border border-white/10 bg-ink-800 px-3 py-2.5 text-sm leading-relaxed text-white outline-none focus:border-gold/40"
        />
      </GlassCard>
    </section>
  );
}
