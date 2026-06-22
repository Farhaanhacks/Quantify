// Quantifi Pro access checks. A user is "Pro" if their email is in the
// PRO_EMAILS allowlist (handy for the owner / comps) or if a Razorpay payment
// has recorded an active subscription for them in KV under `pro:<email>`.
//
// KV record shape (written by /api/razorpay/verify and the webhook):
//   { "active": true, "subscription_id": "sub_...", "current_end": <unix secs> }
import { kvGet } from "@/lib/kv";

export interface ProRecord {
  active?: boolean;
  subscription_id?: string;
  current_end?: number; // unix seconds; access lapses after this
}

function proEmailAllowlist(): Set<string> {
  return new Set(
    (process.env.PRO_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

export async function isEmailPro(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const e = email.toLowerCase();
  if (proEmailAllowlist().has(e)) return true;

  const raw = await kvGet(`pro:${e}`);
  if (!raw) return false;
  try {
    const rec = JSON.parse(raw) as ProRecord;
    if (!rec.active) return false;
    if (rec.current_end && Date.now() / 1000 > rec.current_end) return false;
    return true;
  } catch {
    return false;
  }
}
