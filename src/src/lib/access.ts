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

// Owner / comp allowlist. Tolerant by design: accepts a few common env-var
// names (in case the var was added as PRO_EMAIL or with the NEXT_PUBLIC_ prefix)
// and splits on commas, semicolons or whitespace so a stray separator can't
// silently lock the owner out.
function proEmailAllowlist(): Set<string> {
  const raw =
    process.env.PRO_EMAILS ||
    process.env.PRO_EMAIL ||
    process.env.NEXT_PUBLIC_PRO_EMAILS ||
    "";
  return new Set(
    raw
      .split(/[\s,;]+/)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean)
  );
}

// Owner / comp emails only (the PRO_EMAILS allowlist) — used to gate owner-only
// surfaces like the community question inbox. KV-paid Pro users are NOT owners.
export function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return proEmailAllowlist().has(email.trim().toLowerCase());
}

export async function isEmailPro(email?: string | null): Promise<boolean> {
  if (!email) return false;
  const e = email.trim().toLowerCase();
  if (proEmailAllowlist().has(e)) return true;

  // Paid path via KV — never let a KV error throw and break a gated page.
  try {
    const raw = await kvGet(`pro:${e}`);
    if (!raw) return false;
    const rec = JSON.parse(raw) as ProRecord;
    if (!rec.active) return false;
    if (rec.current_end && Date.now() / 1000 > rec.current_end) return false;
    return true;
  } catch {
    return false;
  }
}
