import { NextResponse } from "next/server";
import { recordEvent, type EventKind } from "@/lib/analytics";
import { authConfig, readCookie, verifySession, SESSION_COOKIE } from "@/lib/auth";

// The page-view beacon.
//
// It runs on the server so the identity it records is the SIGNED cookie's, not
// whatever the browser claims. A client that posts {email: "someone"} is
// ignored: the only fields taken from the request are the path, the kind and an
// optional ticker.
//
// The visitor id is a random value in a first-party cookie, set here on the
// first request. It exists to count distinct people, is never sent anywhere,
// and is not derived from anything about the device — so it cannot identify
// anyone across sites, and clearing cookies genuinely resets it.

export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "quantifi_vid";
const KINDS: EventKind[] = ["visit", "search", "stock"];

function newVisitorId(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: Request) {
  let body: { kind?: string; path?: string; ticker?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* an empty body is a plain page view */
  }

  const kind = (KINDS as string[]).includes(body.kind ?? "") ? (body.kind as EventKind) : "visit";

  const { secret } = authConfig();
  const user = secret ? verifySession(readCookie(req, SESSION_COOKIE), secret) : null;

  let vid = readCookie(req, VISITOR_COOKIE);
  let setCookie = false;
  if (!vid || !/^[a-f0-9]{32}$/.test(vid)) {
    vid = newVisitorId();
    setCookie = true;
  }

  // Fire and await — the write is a couple of Redis calls and the response is
  // empty either way, but a floating promise in a serverless function is a
  // promise that gets killed when the response returns.
  await recordEvent({
    kind,
    visitorId: vid,
    email: user?.email,
    path: typeof body.path === "string" ? body.path : undefined,
    ticker: typeof body.ticker === "string" ? body.ticker : undefined,
  });

  const res = new NextResponse(null, { status: 204 });
  if (setCookie) {
    res.cookies.set(VISITOR_COOKIE, vid, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 365 * 24 * 60 * 60,
    });
  }
  return res;
}
