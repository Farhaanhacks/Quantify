import { NextResponse } from "next/server";
import { kvSet } from "@/lib/kv";
import { isRazorpayConfigured, verifyWebhookSignature } from "@/lib/razorpay";
import type { ProRecord } from "@/lib/access";

export const dynamic = "force-dynamic";

// Razorpay webhook. Verifies the signature against RAZORPAY_WEBHOOK_SECRET and
// keeps each user's Pro access in KV in sync with their subscription lifecycle.
// The subscriber's email is carried in the subscription `notes` we set at
// checkout time.
export async function POST(req: Request) {
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: "Razorpay not configured." }, { status: 503 });
  }

  const signature = req.headers.get("x-razorpay-signature");
  const rawBody = await req.text();

  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: { subscription?: { entity?: { id?: string; current_end?: number; notes?: Record<string, string> } } };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Bad payload." }, { status: 400 });
  }

  const sub = event.payload?.subscription?.entity;
  const email = sub?.notes?.email?.toLowerCase();

  if (email) {
    switch (event.event) {
      case "subscription.activated":
      case "subscription.charged":
      case "subscription.resumed": {
        const record: ProRecord = {
          active: true,
          subscription_id: sub?.id,
          current_end: sub?.current_end,
        };
        await kvSet(`pro:${email}`, JSON.stringify(record));
        break;
      }
      case "subscription.cancelled":
      case "subscription.completed":
      case "subscription.expired":
      case "subscription.halted": {
        const record: ProRecord = { active: false, subscription_id: sub?.id };
        await kvSet(`pro:${email}`, JSON.stringify(record));
        break;
      }
      default:
        break;
    }
  }

  return NextResponse.json({ received: true });
}
