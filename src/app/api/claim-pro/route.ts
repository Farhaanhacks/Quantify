import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { kvGet, kvSet, kvConfigured } from "@/lib/kv";
import type { ProRecord } from "@/lib/access";
import { FREE_LAUNCH_OFFER, FREE_LAUNCH_DAYS } from "@/data/plans";

export const dynamic = "force-dynamic";

// Instant, no-card Pro unlock for the limited-time launch offer. Writes the SAME
// KV record shape the paid Razorpay path uses (`pro:<email>`) — but tagged as a
// launch grant and with an expiry — so:
//   • access turns on the moment the browser re-reads /api/auth/session, and
//   • it lapses on its own when the free window (FREE_LAUNCH_DAYS) ends, which is
//     how a user gets "blocked again unless they purchase" once you flip
//     FREE_LAUNCH_OFFER off and switch the paywall back on.
// No payment, no card, no Razorpay call.
export async function POST(req: Request) {
  if (!FREE_LAUNCH_OFFER) {
    return NextResponse.json({ error: "The free launch offer has ended." }, { status: 403 });
  }

  const user = getUser(req);
  if (!user?.email) {
    return NextResponse.json(
      { error: "Please sign in first so we can link Pro to your account." },
      { status: 401 }
    );
  }

  // Pro is persisted in KV. Without it we can't grant access, so say so honestly
  // rather than pretend it worked.
  if (!kvConfigured()) {
    return NextResponse.json(
      { error: "Account storage isn't configured yet — please try again shortly." },
      { status: 503 }
    );
  }

  const email = user.email.toLowerCase();

  // Never clobber a real paid subscription with a free grant.
  try {
    const existing = await kvGet(`pro:${email}`);
    if (existing) {
      const rec = JSON.parse(existing) as ProRecord;
      const paidActive =
        rec.active &&
        rec.subscription_id &&
        rec.subscription_id !== "launch-free" &&
        (!rec.current_end || Date.now() / 1000 < rec.current_end);
      if (paidActive) return NextResponse.json({ ok: true, alreadyPro: true });
    }
  } catch {
    /* unreadable record — fall through and grant the free access */
  }

  const record: ProRecord = {
    active: true,
    subscription_id: "launch-free",
    source: "launch",
    current_end: Math.floor(Date.now() / 1000) + FREE_LAUNCH_DAYS * 24 * 60 * 60,
  };

  const ok = await kvSet(`pro:${email}`, JSON.stringify(record));
  if (!ok) {
    return NextResponse.json(
      { error: "Couldn't activate Pro right now — please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
