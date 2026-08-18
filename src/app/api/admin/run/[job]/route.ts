import { NextResponse } from "next/server";
import { adminOr404, isNextResponse } from "@/lib/adminGuard";

// Trigger an ingest from the admin page.
//
// It calls the cron route server-side rather than having the browser do it, for
// one reason: the cron routes are protected by CRON_SECRET, and a button that
// worked from the browser would need that secret in client code. Here the
// secret never leaves the server — the browser's authority is the admin session
// it already holds, which is checked before anything runs.
//
// POST only. A job that changes stored data behind a GET is a job any crawler,
// link preview or prefetch can fire.

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const JOBS: Record<string, string> = {
  "insider-tw": "/api/cron/insider-tw",
  "insider-in": "/api/cron/insider-in",
};

export async function POST(req: Request, { params }: { params: { job: string } }) {
  const guard = adminOr404();
  if (isNextResponse(guard)) return guard;

  const path = JOBS[params.job];
  // Fixed map, never a caller-supplied path: without it this is an open proxy
  // that runs any route on this origin with the cron secret attached.
  if (!path) return NextResponse.json({ error: "unknown job" }, { status: 404 });

  const origin = new URL(req.url).origin;
  const secret = process.env.CRON_SECRET?.trim();
  const url = `${origin}${path}${secret ? `?key=${encodeURIComponent(secret)}` : ""}`;

  const started = Date.now();
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(290_000),
    });
    const body = await res.json().catch(() => ({}));
    return NextResponse.json(
      { ok: res.ok, job: params.job, status: res.status, elapsedMs: Date.now() - started, result: body },
      { status: res.ok ? 200 : 502, headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        job: params.job,
        elapsedMs: Date.now() - started,
        error: e instanceof Error ? e.message : "request failed",
      },
      { status: 504 }
    );
  }
}
