// Quantifi Pro access checks. A user is "Pro" if their email is in the
// PRO_EMAILS allowlist (handy for the owner / comps) or if a Razorpay payment
// has recorded an active subscription for them in KV under `pro:<email>`.
//
// KV record shape (written by /api/razorpay/verify and the webhook):
//   { "active": true, "subscription_id": "sub_...", "current_end": <unix secs> }
import { kvGet } from "@/lib/kv";
import { parseEmailAllowlist, emailInAllowlist } from "@/lib/emailAllowlist";

export interface ProRecord {
  active?: boolean;
  subscription_id?: string;
  current_end?: number; // unix seconds; access lapses after this
  source?: string; // "launch" for the free launch grant, else the paid path
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
  return parseEmailAllowlist(raw);
}

// Owner / comp emails only (the PRO_EMAILS allowlist) — used to gate owner-only
// surfaces like the community question inbox. KV-paid Pro users are NOT owners.
export function isOwnerEmail(email?: string | null): boolean {
  if (!email) return false;
  return proEmailAllowlist().has(email.trim().toLowerCase());
}

// ── Staff ───────────────────────────────────────────────────────────────────
//
// A separate allowlist from PRO_EMAILS, and deliberately so. Pro is a PLAN — it
// says someone paid, and comping it to a friend is routine. Staff is TRUST: it
// opens operational surfaces that show which infrastructure is configured and
// let a person trigger jobs. Sharing one list between the two means every comped
// account silently becomes an operator.
//
// Set ADMIN_EMAILS to a comma-separated list. Unset means NOBODY is staff — the
// admin surface 404s for everyone, which is the right default for a var that
// might never be added.
function adminEmailRaw(): string {
  return process.env.ADMIN_EMAILS || process.env.ADMIN_EMAIL || "";
}

/**
 * Is this email on the staff allowlist?
 *
 * Server-only by construction: it reads a non-public env var, so it cannot be
 * called from client code — which is the point. A client-side "is admin" flag is
 * a hint for rendering, never a permission; every admin surface re-checks this
 * on the server before it does or shows anything.
 */
export function isAdminEmail(email?: string | null): boolean {
  return emailInAllowlist(email, adminEmailRaw());
}

/** Whether any staff account is configured at all — shown on the admin page. */
export function adminConfigured(): boolean {
  return parseEmailAllowlist(adminEmailRaw()).size > 0;
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
