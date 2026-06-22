// Server-only Razorpay helpers. Like the rest of this codebase we avoid an
// extra SDK and talk to Razorpay's REST API with plain fetch + Node crypto, so
// nothing can break the build. Everything stays dormant until keys are set.
//
// Required env (set in .env.local / Vercel):
//   RAZORPAY_KEY_ID         — rzp_test_… or rzp_live_…
//   RAZORPAY_KEY_SECRET     — the matching secret
//   RAZORPAY_PLAN_PRO       — Plan ID for the ₹79/month Quantifi Pro plan
//   RAZORPAY_WEBHOOK_SECRET — (optional) secret configured on the webhook
// The Key ID is also exposed to the browser as NEXT_PUBLIC_RAZORPAY_KEY_ID for
// the Checkout widget.
import { createHmac } from "crypto";

export function razorpayConfig() {
  return {
    keyId: process.env.RAZORPAY_KEY_ID || process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "",
    keySecret: process.env.RAZORPAY_KEY_SECRET || "",
    planId: process.env.RAZORPAY_PLAN_PRO || "",
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || "",
  };
}

export function isRazorpayConfigured(): boolean {
  const { keyId, keySecret } = razorpayConfig();
  return Boolean(keyId && keySecret);
}

function authHeader(): string {
  const { keyId, keySecret } = razorpayConfig();
  return "Basic " + Buffer.from(`${keyId}:${keySecret}`).toString("base64");
}

export interface RazorpaySubscription {
  id: string;
  status: string;
  current_end?: number | null;
  notes?: Record<string, string>;
}

// Create a recurring subscription against the Pro plan. `total_count` is the
// number of billing cycles Razorpay will attempt (12 months here).
export async function createProSubscription(
  notes: Record<string, string>
): Promise<RazorpaySubscription> {
  const { planId } = razorpayConfig();
  const res = await fetch("https://api.razorpay.com/v1/subscriptions", {
    method: "POST",
    headers: { Authorization: authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      plan_id: planId,
      total_count: 12,
      customer_notify: 1,
      notes,
    }),
    cache: "no-store",
  });
  const data = (await res.json()) as RazorpaySubscription & { error?: { description?: string } };
  if (!res.ok) {
    throw new Error(data?.error?.description || "Razorpay subscription create failed");
  }
  return data;
}

export async function fetchSubscription(id: string): Promise<RazorpaySubscription | null> {
  const res = await fetch(`https://api.razorpay.com/v1/subscriptions/${id}`, {
    headers: { Authorization: authHeader() },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return (await res.json()) as RazorpaySubscription;
}

// Checkout success handshake: signature = HMAC_SHA256(payment_id|subscription_id).
export function verifyPaymentSignature(
  paymentId: string,
  subscriptionId: string,
  signature: string
): boolean {
  const { keySecret } = razorpayConfig();
  if (!keySecret || !paymentId || !subscriptionId || !signature) return false;
  const expected = createHmac("sha256", keySecret)
    .update(`${paymentId}|${subscriptionId}`)
    .digest("hex");
  return timingSafeEqual(expected, signature);
}

// Webhook payloads are signed with the webhook secret over the raw body.
export function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const { webhookSecret } = razorpayConfig();
  if (!webhookSecret || !signature) return false;
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  return timingSafeEqual(expected, signature);
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
