import { NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";

// Stripe webhook. Verifies the signature against STRIPE_WEBHOOK_SECRET, then
// reacts to subscription lifecycle events. The actual access-granting (e.g.
// marking a user as subscribed) needs a database/user system, which is left as
// a TODO since this prototype has no auth layer yet.

export async function POST(req: Request) {
  if (!stripe) {
    return NextResponse.json({ error: "Stripe not configured." }, { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: "Missing Stripe signature or STRIPE_WEBHOOK_SECRET." },
      { status: 400 }
    );
  }

  // Raw body is required for signature verification.
  const body = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    console.error("[webhook] signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed":
      // TODO: grant access — look up the customer and mark them subscribed.
      break;
    case "customer.subscription.updated":
      // TODO: sync plan changes.
      break;
    case "customer.subscription.deleted":
      // TODO: revoke access when a subscription ends.
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
