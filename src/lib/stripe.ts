// Server-only Stripe client. Stays null until STRIPE_SECRET_KEY is set, so the
// app builds and runs (pricing page included) before you add your keys.
// Never import this from a client component.

import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;

export const stripe = secret ? new Stripe(secret) : null;

export const isStripeConfigured = (): boolean => Boolean(secret);
