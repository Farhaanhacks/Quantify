import { NextResponse } from "next/server";
import { authConfig, readCookie, verifySession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { secret, clientId } = authConfig();
  const token = readCookie(req, SESSION_COOKIE);
  const user = secret ? verifySession(token, secret) : null;
  return NextResponse.json({
    configured: !!clientId,
    user: user ? { name: user.name, email: user.email, picture: user.picture } : null,
  });
}
