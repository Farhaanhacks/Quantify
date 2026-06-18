// Lightweight Google sign-in plumbing — no auth library, just Google's OAuth2
// endpoints and a signed (HMAC) session cookie using Node's built-in crypto.
// This keeps the build free of an untested dependency. Server-only.
//
// Required environment variables (set these in Vercel → Settings → Env Vars):
//   GOOGLE_CLIENT_ID      — from Google Cloud Console OAuth client
//   GOOGLE_CLIENT_SECRET  — from the same OAuth client
//   AUTH_SECRET           — any long random string (signs the session cookie)
// Authorized redirect URI to register in Google Cloud:
//   https://<your-domain>/api/auth/callback/google

import { createHmac, randomBytes } from "crypto";

export const SESSION_COOKIE = "quantifi_session";
export const STATE_COOKIE = "quantifi_oauth_state";

export interface SessionUser {
  sub: string;
  name?: string;
  email?: string;
  picture?: string;
  exp: number;
}

function hmac(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("base64url");
}

const DAY = 24 * 60 * 60 * 1000;

export function signSession(user: Omit<SessionUser, "exp">, secret: string, ttlMs = 7 * DAY): string {
  const payload: SessionUser = { ...user, exp: Date.now() + ttlMs };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(body, secret)}`;
}

export function verifySession(token: string | undefined, secret: string): SessionUser | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (hmac(body, secret) !== sig) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as SessionUser;
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export function authConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "",
  };
}

export function newState(): string {
  return randomBytes(16).toString("hex");
}

// Build the app's own origin from the incoming request (works behind Vercel's proxy).
export function originFromRequest(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") || h.get("host") || "";
  const proto = h.get("x-forwarded-proto") || "https";
  return `${proto}://${host}`;
}

export function readCookie(req: Request, name: string): string | undefined {
  const raw = req.headers.get("cookie");
  if (!raw) return undefined;
  const m = raw.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return m ? decodeURIComponent(m[1]) : undefined;
}
