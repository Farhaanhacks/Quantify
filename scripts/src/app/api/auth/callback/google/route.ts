import { NextResponse } from "next/server";
import {
  authConfig,
  originFromRequest,
  readCookie,
  signSession,
  SESSION_COOKIE,
  STATE_COOKIE,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const origin = originFromRequest(req);
  const { clientId, clientSecret, secret } = authConfig();
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    const cookieState = readCookie(req, STATE_COOKIE);
    if (!code || !state || !cookieState || state !== cookieState) {
      return NextResponse.redirect(`${origin}/?auth=failed`);
    }
    if (!clientId || !clientSecret || !secret) {
      return NextResponse.redirect(`${origin}/?auth=unconfigured`);
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${origin}/api/auth/callback/google`,
        grant_type: "authorization_code",
      }),
    });
    if (!tokenRes.ok) return NextResponse.redirect(`${origin}/?auth=failed`);
    const token = (await tokenRes.json()) as { access_token?: string };
    if (!token.access_token) return NextResponse.redirect(`${origin}/?auth=failed`);

    const uiRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!uiRes.ok) return NextResponse.redirect(`${origin}/?auth=failed`);
    const u = (await uiRes.json()) as {
      sub?: string;
      name?: string;
      email?: string;
      picture?: string;
    };
    if (!u.sub) return NextResponse.redirect(`${origin}/?auth=failed`);

    const sessionToken = signSession(
      { sub: u.sub, name: u.name, email: u.email, picture: u.picture },
      secret
    );
    const res = NextResponse.redirect(`${origin}/?auth=ok`);
    res.cookies.set(SESSION_COOKIE, sessionToken, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600,
    });
    res.cookies.set(STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch {
    return NextResponse.redirect(`${origin}/?auth=failed`);
  }
}
