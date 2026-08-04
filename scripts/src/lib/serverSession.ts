// Read the signed-in user inside Server Components / route handlers using the
// app-router cookie store (the request-based getUser in lib/auth covers the
// Request-object call sites).
import { cookies } from "next/headers";
import { authConfig, verifySession, SESSION_COOKIE, type SessionUser } from "@/lib/auth";

export function currentUser(): SessionUser | null {
  const { secret } = authConfig();
  if (!secret) return null;
  const token = cookies().get(SESSION_COOKIE)?.value;
  return verifySession(token, secret);
}
