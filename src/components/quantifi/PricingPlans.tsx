"use client";

import { useState } from "react";
import { GlassCard, Tag } from "@/components/quantifi/Cards";
import { PLANS } from "@/data/plans";

export default function PricingPlans() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function subscribe(planId: string) {
    setError(null);
    setLoading(planId);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: planId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Could not start checkout.");
        setLoading(null);
        return;
      }
      window.location.href = data.url; // redirect to Stripe Checkout
    } catch {
      setError("Network error starting checkout.");
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="grid gap-4 md:grid-cols-3">
        {PLANS.map((plan) => {
          const isPaid = Boolean(plan.priceEnv);
          return (
            <GlassCard
              key={plan.id}
              className={`flex flex-col p-6 ${
                plan.highlight ? "border-gold/40 bg-gold/[0.05]" : ""
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-white">{plan.name}</h3>
                {plan.highlight ? <Tag tone="gold">Popular</Tag> : null}
              </div>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="font-display text-3xl font-semibold text-white">{plan.price}</span>
                <span className="text-sm text-slate-500">/ {plan.period}</span>
              </div>
              <p className="mt-2 text-sm text-slate-400">{plan.tagline}</p>

              <ul className="mt-5 flex-1 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-sm text-slate-300">
                    <span className="mt-0.5 text-gold">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={!isPaid || loading === plan.id}
                onClick={() => isPaid && subscribe(plan.id)}
                className={`mt-6 rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                  !isPaid
                    ? "cursor-default border border-white/10 bg-white/[0.03] text-slate-500"
                    : plan.highlight
                    ? "bg-gradient-to-r from-gold-400 to-gold-600 text-ink hover:opacity-90"
                    : "border border-white/15 text-white hover:border-gold/40"
                } ${loading === plan.id ? "opacity-60" : ""}`}
              >
                {loading === plan.id ? "Redirecting…" : plan.cta}
              </button>
            </GlassCard>
          );
        })}
      </div>

      {error ? (
        <p className="mt-4 rounded-xl border border-down/30 bg-down/10 px-4 py-3 text-sm text-down">
          {error}
        </p>
      ) : null}
    </div>
  );
}
