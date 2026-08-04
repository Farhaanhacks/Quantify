import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { isOwnerEmail } from "@/lib/access";
import { kvRPush, kvLRange, kvLTrim, kvConfigured } from "@/lib/kv";

export const dynamic = "force-dynamic";

const KEY = "community:questions";
const MAX = 500;

export interface CommunityQuestion {
  q: string;
  email?: string;
  name?: string;
  ts: number;
}

// POST — submit a question (anyone). Stored in KV so owners can read them.
export async function POST(req: Request) {
  if (!kvConfigured()) {
    // Without KV we can't persist — tell the client so it can still show a
    // friendly confirmation but we don't pretend it was saved.
    return NextResponse.json({ ok: false, stored: false });
  }
  const body = (await req.json().catch(() => null)) as { question?: string } | null;
  const q = (body?.question ?? "").trim();
  if (!q) return NextResponse.json({ error: "Empty question." }, { status: 400 });
  if (q.length > 2000) return NextResponse.json({ error: "Too long." }, { status: 400 });

  const user = getUser(req);
  const record: CommunityQuestion = {
    q,
    email: user?.email,
    name: user?.name,
    ts: Date.now(),
  };
  await kvRPush(KEY, JSON.stringify(record));
  await kvLTrim(KEY, -MAX, -1); // keep the most recent MAX
  return NextResponse.json({ ok: true, stored: true });
}

// GET — read the inbox. Owners (PRO_EMAILS allowlist) only.
export async function GET(req: Request) {
  const user = getUser(req);
  if (!isOwnerEmail(user?.email)) {
    return NextResponse.json({ error: "Not authorized." }, { status: 403 });
  }
  const raw = await kvLRange(KEY, 0, -1);
  const questions: CommunityQuestion[] = raw
    .map((s) => {
      try {
        return JSON.parse(s) as CommunityQuestion;
      } catch {
        return null;
      }
    })
    .filter((x): x is CommunityQuestion => !!x)
    .reverse(); // newest first
  return NextResponse.json({ ok: true, questions });
}
