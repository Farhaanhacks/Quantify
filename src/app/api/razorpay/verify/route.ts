import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { kvSet } from "@/lib/kv";
import { fetchSubscription, isRazorpayConfigured, verifyPaymentSignature } from "@/lib/razorpay";
import type { ProRecord } from "@/lib/access";

export const dynamic = "force-dynamic";

// Called by the browser after a successful Razorpay Checkout. Verifies the
// signature, then records Pro access for the signed-in user in KV.
export async function POST(req: Request) {
  if (!isRazorpayConfigured()) {
    return NextResponse.json({ error: "Payments not configured." }, { status: 503 });
  }

  const user = getUser(req);
  if (!user?.email) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    razorpay_payment_id?: string;
    razorpay_subscription_id?: string;
    razorpay_signature?: string;
  } | null;

  const paymentId = body?.razorpay_payment_id;
  const subscriptionId = body?.razorpay_subscription_id;
  const signature = body?.razorpay_signature;

  if (!paymentId || !subscriptionId || !signature) {
    return NextResponse.json({ error: "Missing payment fields." }, { status: 400 });
  }

  if (!verifyPaymentSignature(paymentId, subscriptionId, signature)) {
    return NextResponse.json({ error: "Signature verification failed." }, { status: 400 });
  }

  // Default a month of access; refine from the real subscription if available.
  let currentEnd = Math.floor(Date.now() / 1000) + 32 * 24 * 60 * 60;
  const sub = await fetchSubscription(subscriptionId);
  if (sub?.current_end) currentEnd = sub.current_end;

  const record: ProRecord = {
    active: true,
    subscription_id: subscriptionId,
    current_end: currentEnd,
  };
  await kvSet(`pro:${user.email.toLowerCase()}`, JSON.stringify(record));

  return NextResponse.json({ ok: true });
}
