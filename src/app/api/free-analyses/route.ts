import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isEmailPro } from "@/lib/access";
import { kvGet, kvSet, kvConfigured } from "@/lib/kv";
import { FREE_LIMIT } from "@/lib/freeLimit";

export const dynamic = "force-dynamic";

// The set of symbols a free user has already spent an analysis on. Kept per
// email in KV so the quota survives refreshes and follows the account across
// devices — the browser can't widen it.
async function readUsed(email: string): Promise<string[]> {
  try {
    const raw = await kvGet(`free:${email}`);
    if (!raw) return [];
    const a = JSON.parse(raw) as unknown;
    return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// GET — current free-analysis state for the signed-in user.
export async function GET(req: Request) {
  const user = getUser(req);
  const email = user?.email?.toLowerCase();
  const pro = await isEmailPro(email);
  const used = email && !pro ? await readUsed(email) : [];
  return NextResponse.json({
    signedIn: Boolean(email),
    pro,
    used,
    limit: FREE_LIMIT,
    enforced: kvConfigured(),
  });
}

// POST { symbol } — spend (or re-use) one free analysis for this symbol.
// Re-opening an already-revealed symbol never costs another slot. Pro is
// unlimited. Signed-out users can't spend — the quota is per email.
export async function POST(req: Request) {
  const user = getUser(req);
  const email = user?.email?.toLowerCase();
  if (!email) {
    return NextResponse.json(
      { allowed: false, reason: "signin", used: [], limit: FREE_LIMIT },
      { status: 401 }
    );
  }

  const pro = await isEmailPro(email);
  if (pro) {
    return NextResponse.json({ allowed: true, pro: true, used: [], limit: FREE_LIMIT });
  }

  const body = (await req.json().catch(() => null)) as { symbol?: string } | null;
  const sym = (body?.symbol ?? "").trim().toUpperCase();
  if (!sym) {
    return NextResponse.json(
      { allowed: false, reason: "bad", used: await readUsed(email), limit: FREE_LIMIT },
      { status: 400 }
    );
  }

  const used = await readUsed(email);
  if (used.includes(sym)) {
    // Already unlocked — no charge.
    return NextResponse.json({ allowed: true, used, limit: FREE_LIMIT });
  }
  if (used.length >= FREE_LIMIT) {
    return NextResponse.json({ allowed: false, reason: "limit", used, limit: FREE_LIMIT });
  }

  const next = [...used, sym];
  await kvSet(`free:${email}`, JSON.stringify(next));
  return NextResponse.json({ allowed: true, used: next, limit: FREE_LIMIT });
}
