import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createOrder, isRazorpayConfigured, razorpayConfig } from "@/lib/razorpay";
import { QUANTIFI_PRO } from "@/data/plans";

export const dynamic = "force-dynamic";

// Razorpay Standard Checkout — step 1: create an order. Returns the order id and
// the public key the browser needs to open Checkout. The secret never leaves the
// server.
export async function POST(req: Request) {
  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { error: "Payments aren't configured yet. Add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET." },
      { status: 503 }
    );
  }

  const user = getUser(req);
  if (!user?.email) {
    return NextResponse.json(
      { error: "Please sign in before upgrading so we can link Pro to your account." },
      { status: 401 }
    );
  }

  const body = (await req.json().catch(() => null)) as { amount?: number } | null;
  const amount = Math.round(body?.amount ?? QUANTIFI_PRO.amount); // paise
  if (!Number.isFinite(amount) || amount < 100) {
    return NextResponse.json({ error: "Amount must be at least 100 paise." }, { status: 400 });
  }

  try {
    const { keyId } = razorpayConfig();
    const order = await createOrder(amount, `pro_${Date.now()}`, QUANTIFI_PRO.currency);
    return NextResponse.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      user: { name: user.name ?? "", email: user.email },
    });
  } catch (err) {
    console.error("[create-order]", err);
    return NextResponse.json({ error: "Could not create the payment order." }, { status: 500 });
  }
}
