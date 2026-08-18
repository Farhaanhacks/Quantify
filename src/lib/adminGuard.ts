import { NextResponse } from "next/server";
import { currentUser } from "@/lib/serverSession";
import { isAdminEmail } from "@/lib/access";

// The server-side check every admin surface makes for itself.
//
// Middleware is not the boundary here. It runs at the edge and only checks that
// a session cookie EXISTS — it never verifies the signature, and Next has had
// more than one bypass in that layer. So each admin route and the admin page
// re-derive the answer from the signed cookie themselves, which is the check
// that actually decides anything.
//
// A non-admin gets 404, not 403. 403 confirms the route exists and that they
// found the right path; 404 says nothing at all. For a surface whose whole
// purpose is to describe infrastructure, saying nothing is the better answer.
export function adminOr404(): { email: string } | NextResponse {
  const user = currentUser();
  if (!user?.email || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return { email: user.email };
}

export function isNextResponse(x: unknown): x is NextResponse {
  return x instanceof NextResponse;
}
