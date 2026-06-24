"use client";

import { useState } from "react";
import { GlassCard, Tag } from "@/components/quantifi/Cards";
import { QUANTIFI_PRO } from "@/data/plans";
import { useProStatus } from "@/lib/useProStatus";

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

// Loads Razorpay's Checkout script once, on demand.
function loadRazorpay(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
}

export default function PricingPlans() {
  const { pro, user, ready } = useProStatus();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function subscribe() {
    setError(null);
    setLoading(true);
    try {
      const ok = await loadRazorpay();
      if (!ok) {
        setError("Couldn't load the payment widget. Check your connection and retry.");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = (await res.json()) as {
        orderId?: string;
        amount?: number;
        currency?: string;
        keyId?: string;
        user?: { name?: string; email?: string };
        error?: string;
      };
      if (!res.ok || !data.orderId || !data.keyId) {
        setError(data.error ?? "Could not start checkout.");
        setLoading(false);
        return;
      }

      const rzp = new (window as any).Razorpay({
        key: data.keyId,
        order_id: data.orderId,
        amount: data.amount,
        currency: data.currency,
        name: "Quantifi Pro",
        description: `${QUANTIFI_PRO.price} · Quantifi Pro (1 month)`,
        prefill: { name: data.user?.name, email: data.user?.email },
        theme: { color: "#E9B872" },
        handler: async (resp: RazorpayResponse) => {
          const verify = await fetch("/api/verify-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(resp),
          });
          if (verify.ok) {
            window.location.href = "/billing/success";
          } else {
            window.location.href = "/billing/cancel";
          }
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      rzp.on("payment.failed", () => {
        setError("Payment failed. You haven't been charged — please try again.");
        setLoading(false);
      });
      rzp.open();
    } catch {
      setError("Network error starting checkout.");
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Free / Explorer */}
      <GlassCard className="flex flex-col p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-white">Explorer</h3>
          <Tag tone="neutral">Free</Tag>
        </div>
        <div className="mt-3 flex items-baseline gap-1.5">
          <span className="font-display text-3xl font-semibold text-white">₹0</span>
          <span className="text-sm text-slate-500">/ forever</span>
        </div>
        <p className="mt-2 text-sm text-slate-400">Everything except the Pro-only research surfaces.</p>

        <ul className="mt-5 flex-1 space-y-2.5">
          {QUANTIFI_PRO.freeFeatures.map((f) => (
            <li key={f} className="flex gap-2.5 text-sm text-slate-300">
              <span className="mt-0.5 text-gold">✓</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          disabled
          className="mt-6 cursor-default rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-sm font-semibold text-slate-500"
        >
          {pro ? "Included" : "Current plan"}
        </button>
      </GlassCard>

      {/* Quantifi Pro */}
      <GlassCard className="flex flex-col border-gold/40 bg-gold/[0.05] p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-lg font-semibold text-white">{QUANTIFI_PRO.name}</h3>
          <Tag tone="gold">{pro ? "Active" : "Pro"}</Tag>
        </div>
        {!pro ? (
          <>
            {/* Anchor the ₹500 first, then ₹49. Keep "₹500/month" one uniform
                size so the strike is a single clean line (mixed sizes made it
                look stepped/diagonal), with a neutral grey rule. */}
            <div className="mt-3 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="font-display text-xl font-medium text-slate-500 line-through decoration-slate-400/70 decoration-2">
                ₹500/month
              </span>
              <span className="font-display text-4xl font-bold text-white">
                {QUANTIFI_PRO.price}
              </span>
              <span className="text-sm text-slate-500">/ {QUANTIFI_PRO.period}</span>
            </div>
            <p className="mt-2 text-sm text-slate-400">
              Limited launch price — billed {QUANTIFI_PRO.price}/month. Cancel anytime.
            </p>
          </>
        ) : (
          <div className="mt-3 flex items-baseline gap-1.5">
            <span className="font-display text-3xl font-semibold text-white">
              {QUANTIFI_PRO.price}
            </span>
            <span className="text-sm text-slate-500">/ {QUANTIFI_PRO.period}</span>
          </div>
        )}

        <ul className="mt-5 flex-1 space-y-2.5">
          <li className="flex gap-2.5 text-sm text-slate-300">
            <span className="mt-0.5 text-gold">✓</span>
            <span>Everything in Explorer</span>
          </li>
          {QUANTIFI_PRO.proFeatures.map((f) => (
            <li key={f} className="flex gap-2.5 text-sm text-white">
              <span className="mt-0.5 text-gold">★</span>
              <span>{f}</span>
            </li>
          ))}
        </ul>

        {pro ? (
          <div className="mt-6 rounded-full border border-gold/30 bg-gold/10 px-5 py-2.5 text-center text-sm font-semibold text-gold">
            You&apos;re on Quantifi Pro
          </div>
        ) : !ready ? (
          <div className="mt-6 h-[42px] rounded-full border border-white/10" />
        ) : !user ? (
          <a
            href="/api/auth/login"
            className="mt-6 rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-5 py-2.5 text-center text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Sign in to upgrade
          </a>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={subscribe}
            className={`mt-6 rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-5 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90 ${
              loading ? "opacity-60" : ""
            }`}
          >
            {loading ? "Opening checkout…" : QUANTIFI_PRO.cta}
          </button>
        )}
      </GlassCard>

      {error ? (
        <p className="md:col-span-2 rounded-xl border border-down/30 bg-down/10 px-4 py-3 text-sm text-down">
          {error}
        </p>
      ) : null}
    </div>
  );
}
