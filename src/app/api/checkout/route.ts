import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { PLANS } from "@/data/plans";

export async function POST(req: Request) {
  if (!stripe) {
    return NextResponse.json(
      { error: "Payments aren't configured yet. Add STRIPE_SECRET_KEY to enable checkout." },
      { status: 503 }
    );
  }

  try {
    const { plan } = (await req.json()) as { plan?: string };
    const cfg = PLANS.find((p) => p.id === plan);

    if (!cfg || !cfg.priceEnv) {
      return NextResponse.json({ error: "Unknown or non-paid plan." }, { status: 400 });
    }

    const priceId = process.env[cfg.priceEnv];
    if (!priceId) {
      return NextResponse.json(
        { error: `Missing Stripe Price ID. Set ${cfg.priceEnv} in your environment.` },
        { status: 500 }
      );
    }

    const origin =
      req.headers.get("origin") ??
      process.env.NEXT_PUBLIC_BASE_URL ??
      "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/billing/cancel`,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[checkout]", err);
    return NextResponse.json({ error: "Could not start checkout." }, { status: 500 });
  }
}
