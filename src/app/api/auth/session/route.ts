import { NextResponse } from "next/server";
import { authConfig, readCookie, verifySession, SESSION_COOKIE } from "@/lib/auth";
import { isEmailPro } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { secret, clientId } = authConfig();
  const token = readCookie(req, SESSION_COOKIE);
  const user = secret ? verifySession(token, secret) : null;
  const pro = user?.email ? await isEmailPro(user.email) : false;
  return NextResponse.json({
    configured: !!clientId,
    pro,
    user: user ? { name: user.name, email: user.email, picture: user.picture } : null,
  });
}
