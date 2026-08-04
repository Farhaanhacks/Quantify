import { NextResponse } from "next/server";
import { originFromRequest, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const res = NextResponse.redirect(`${originFromRequest(req)}/`);
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
