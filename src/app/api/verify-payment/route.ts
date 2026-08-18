import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { kvSet } from "@/lib/kv";
import { recordEvent } from "@/lib/analytics";
import { isRazorpayConfigured, verifyOrderSignature } from "@/lib/razorpay";
import type { ProRecord } from "@/lib/access";

export const dynamic = "force-dynamic";

// Razorpay Standard Checkout — step 3: verify the payment signature server-side,
// then (only on a match) record Pro access for the signed-in user. Never trusts
// the client's word that a payment succeeded.
export async function POST(req: Request) {
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: "Payments not configured." }, { status: 503 });
  }

  const user = getUser(req);
  if (!user?.email) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    razorpay_order_id?: string;
    razorpay_payment_id?: string;
    razorpay_signature?: string;
  } | null;

  const orderId = body?.razorpay_order_id;
  const paymentId = body?.razorpay_payment_id;
  const signature = body?.razorpay_signature;

  if (!orderId || !paymentId || !signature) {
    return NextResponse.json({ error: "Missing payment fields." }, { status: 400 });
  }

  if (!verifyOrderSignature(orderId, paymentId, signature)) {
    // Signature mismatch — do NOT grant access.
    return NextResponse.json({ error: "Signature verification failed." }, { status: 400 });
  }

  // Verified: grant ~1 month of Pro access.
  const record: ProRecord = {
    active: true,
    subscription_id: `order_${orderId}`,
    current_end: Math.floor(Date.now() / 1000) + 31 * 24 * 60 * 60,
  };
  await kvSet(`pro:${user.email.toLowerCase()}`, JSON.stringify(record));
  // The conversion. Counted here rather than inferred from the pro:* keys,
  // because a count of current subscribers cannot tell you WHEN anyone joined.
  // With the VISITOR id, not only the email: every earlier funnel step is
  // counted by visitor, and a last step counted by account would be a different
  // unit silently divided by the first.
  const vid = (req.headers.get("cookie") || "").match(/quantifi_vid=([a-f0-9]{32})/)?.[1];
  await recordEvent({ kind: "pro", email: user.email, visitorId: vid }).catch(() => {});

  return NextResponse.json({ ok: true });
}
