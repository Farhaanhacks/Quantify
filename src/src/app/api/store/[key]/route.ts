import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { kvGet, kvSet, kvConfigured } from "@/lib/kv";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["portfolios", "watchlist", "alerts"]);

export async function GET(req: Request, { params }: { params: { key: string } }) {
  if (!ALLOWED.has(params.key)) return NextResponse.json({ ok: false }, { status: 400 });
  const u = getUser(req);
  if (!u?.email) return NextResponse.json({ ok: true, authed: false, data: null });
  if (!kvConfigured()) return NextResponse.json({ ok: true, authed: true, configured: false, data: null });
  const raw = await kvGet(`${params.key}:${u.email.toLowerCase()}`);
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
  const okSet = await kvSet(`${params.key}:${u.email.toLowerCase()}`, JSON.stringify(body?.data ?? null));
  return NextResponse.json({ ok: okSet, authed: true });
}
