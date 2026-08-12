import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { kvGet, kvSet, kvConfigured } from "@/lib/kv";
import { seal, open } from "@/lib/secretBox";

export const dynamic = "force-dynamic";

// These are the only keys that can be read or written, and the key that reaches
// the database is built here from the session's own email — never from anything
// the caller sends. That is what keeps one account out of another's data; the
// encryption below is a separate concern, guarding the stored bytes against
// whoever might read the database itself.
const ALLOWED = new Set(["portfolios", "watchlist", "alerts"]);

export async function GET(req: Request, { params }: { params: { key: string } }) {
  if (!ALLOWED.has(params.key)) return NextResponse.json({ ok: false }, { status: 400 });
  const u = getUser(req);
  if (!u?.email) return NextResponse.json({ ok: true, authed: false, data: null });
  if (!kvConfigured()) return NextResponse.json({ ok: true, authed: true, configured: false, data: null });
  const raw = open(await kvGet(`${params.key}:${u.email.toLowerCase()}`));
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  return NextResponse.json({ ok: true, authed: true, data });
}

export async function PUT(req: Request, { params }: { params: { key: string } }) {
  if (!ALLOWED.has(params.key)) return NextResponse.json({ ok: false }, { status: 400 });
  const u = getUser(req);
  if (!u?.email) return NextResponse.json({ ok: true, authed: false });
  if (!kvConfigured()) return NextResponse.json({ ok: true, authed: true, configured: false });
  const body = (await req.json().catch(() => null)) as { data?: unknown } | null;
  const okSet = await kvSet(
    `${params.key}:${u.email.toLowerCase()}`,
    seal(JSON.stringify(body?.data ?? null))
  );
  return NextResponse.json({ ok: okSet, authed: true });
}
