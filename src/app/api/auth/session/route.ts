import { NextResponse } from "next/server";
import { authConfig, readCookie, verifySession, SESSION_COOKIE } from "@/lib/auth";
import { isEmailPro, isAdminEmail } from "@/lib/access";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { secret, clientId } = authConfig();
  const token = readCookie(req, SESSION_COOKIE);
  const user = secret ? verifySession(token, secret) : null;
  const pro = user?.email ? await isEmailPro(user.email) : false;
  // A HINT for rendering, not a permission. It only decides whether the account
  // menu shows a link; /admin and every admin endpoint re-derive staff status
  // from the signed cookie on the server before showing or doing anything, so a
  // forged `true` here buys a link to a 404.
  const admin = isAdminEmail(user?.email);
  return NextResponse.json(
    {
      configured: !!clientId,
      pro,
      admin,
      user: user ? { name: user.name, email: user.email, picture: user.picture } : null,
    },
    // Never cache plan status — it must flip the instant a user upgrades.
    { headers: { "Cache-Control": "no-store, must-revalidate" } }
  );
}
