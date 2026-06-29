import { NextResponse } from "next/server";
import { authConfig, originFromRequest, newState, STATE_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Google blocks OAuth inside embedded in-app browsers (LinkedIn, Instagram,
// Facebook, X, TikTok, etc.) with "Access blocked: disallowed_useragent". The
// app already does a full-page redirect — the issue is the webview itself. So
// when we detect one, we DON'T send the user to Google (that just shows the
// scary block screen); instead we show a clean "open in your browser" page.
function isEmbeddedWebview(ua: string): boolean {
  if (!ua) return false;
  return /\b(FBAN|FBAV|FB_IAB|Instagram|LinkedInApp|Twitter|Line\/|MicroMessenger|Snapchat|Pinterest|musical_ly|Bytedance|TikTok|GSA\/|Reddit)\b/i.test(
    ua
  ) || /; wv\)/i.test(ua); // generic Android WebView
}

function webviewPage(origin: string): string {
  const url = origin.replace(/^https?:\/\//, "");
  return `<!doctype html><html lang="en"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Open in your browser · Quantifi</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#05070D; color:#E5E7EB; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif; }
  .wrap { max-width:520px; margin:0 auto; padding:48px 24px; }
  h1 { font-size:1.4rem; line-height:1.3; margin:0 0 12px; }
  p { color:#9CA3AF; line-height:1.6; font-size:0.95rem; }
  .card { margin-top:24px; border:1px solid rgba(255,255,255,0.1); background:rgba(255,255,255,0.03); border-radius:16px; padding:18px; }
  .url { display:flex; align-items:center; justify-content:space-between; gap:12px; margin-top:8px; font-family:ui-monospace,Menlo,monospace; font-size:0.95rem; color:#fff; }
  button { background:linear-gradient(90deg,#F2C879,#D9A441); color:#0B0F1A; border:0; border-radius:999px; padding:10px 16px; font-weight:600; font-size:0.85rem; cursor:pointer; }
  ol { color:#9CA3AF; line-height:1.7; font-size:0.92rem; padding-left:20px; }
  .ok { color:#34D399; font-size:0.8rem; margin-top:8px; min-height:1em; }
  .brand { font-size:0.7rem; letter-spacing:0.18em; text-transform:uppercase; color:#D9A441; }
</style></head>
<body><div class="wrap">
  <div class="brand">Quantifi</div>
  <h1>Open Quantifi in your browser to continue</h1>
  <p>For your security, Google sign-in doesn't work inside in-app browsers (like LinkedIn, Instagram or Facebook). Open Quantifi in <strong>Chrome</strong> or <strong>Safari</strong> and you'll be able to sign in and browse normally.</p>
  <div class="card">
    <div style="font-size:0.7rem;letter-spacing:0.14em;text-transform:uppercase;color:#6B7280">Your link</div>
    <div class="url"><span>${url}</span><button onclick="copy()">Copy</button></div>
    <div class="ok" id="ok"></div>
  </div>
  <div class="card">
    <div style="font-size:0.7rem;letter-spacing:0.14em;text-transform:uppercase;color:#6B7280;margin-bottom:8px">How to open in your browser</div>
    <ol>
      <li>Tap the <strong>⋯</strong> (or share) menu at the top of this in-app window.</li>
      <li>Choose <strong>“Open in browser”</strong> / “Open in Chrome” / “Open in Safari”.</li>
      <li>Or paste the copied link into Chrome or Safari.</li>
    </ol>
  </div>
  <p style="margin-top:24px"><a href="${origin}/" style="color:#D9A441">← Back to Quantifi home</a></p>
</div>
<script>
  function copy(){
    var t='${origin}';
    (navigator.clipboard&&navigator.clipboard.writeText?navigator.clipboard.writeText(t):Promise.reject())
      .then(function(){document.getElementById('ok').textContent='Link copied — now open it in Chrome or Safari.';})
      .catch(function(){document.getElementById('ok').textContent='Copy the link above and open it in Chrome or Safari.';});
  }
</script>
</body></html>`;
}

export async function GET(req: Request) {
  const origin = originFromRequest(req);
  const { clientId } = authConfig();
  if (!clientId) return NextResponse.redirect(`${origin}/?auth=unconfigured`);

  // In-app webview → friendly interstitial instead of Google's block screen.
  const ua = req.headers.get("user-agent") ?? "";
  if (isEmbeddedWebview(ua)) {
    return new NextResponse(webviewPage(origin), {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const state = newState();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/callback/google`,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
