import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createProSubscription, isRazorpayConfigured, razorpayConfig } from "@/lib/razorpay";
import { QUANTIFI_PRO } from "@/data/plans";

export const dynamic = "force-dynamic";

// Starts a Quantifi Pro subscription with Razorpay and returns the details the
// browser needs to open Razorpay Checkout.
export async function POST(req: Request) {
  if (!isRazorpayConfigured()) {
    return NextResponse.json(
      { error: "Payments aren't configured yet. Add RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET." },
      { status: 503 }
    );
  }

  const { planId, keyId } = razorpayConfig();
  if (!planId) {
    return NextResponse.json(
      { error: "Missing Razorpay plan. Set RAZORPAY_PLAN_PRO to your ₹79/month Plan ID." },
      { status: 500 }
    );
  }

  const user = getUser(req);
  if (!user?.email) {
    return NextResponse.json(
      { error: "Please sign in before upgrading so we can link Pro to your account." },
      { status: 401 }
    );
  }

  try {
    const sub = await createProSubscription({
      email: user.email.toLowerCase(),
      name: user.name ?? "",
    });

    return NextResponse.json({
      subscriptionId: sub.id,
      keyId,
      plan: { name: QUANTIFI_PRO.name, price: QUANTIFI_PRO.price, period: QUANTIFI_PRO.period },
      user: { name: user.name ?? "", email: user.email },
    });
  } catch (err) {
    console.error("[checkout]", err);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
