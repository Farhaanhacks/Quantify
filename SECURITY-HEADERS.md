# Quantifi — Security headers

All security headers live in **`next.config.mjs`** (`async headers()`), applied to every
route. Nothing else in the app needed to change. Replace your existing
`next.config.mjs` with the new one, redeploy, done.

## What you asked for

| Your concern | Fixed by | Value shipped |
|---|---|---|
| **Clickjacking** (missing CSP) | `frame-ancestors` in the CSP **+** `X-Frame-Options` | `frame-ancestors 'self'` / `SAMEORIGIN` — no other site can load Quantifi inside an `<iframe>`, so overlay/click-hijack attacks can't work. |
| **Missing COOP** | `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` |

You also get a full CSP plus `X-Content-Type-Options`, `Referrer-Policy`,
`Permissions-Policy`, and HSTS in the same pass.

## Why these specific values (so nothing breaks)

The CSP is scoped to exactly what the **browser** loads on your site — I read the code
to build it, not a generic template:

- **TradingView** widgets pull a script from `s3.tradingview.com` and render a chart
  in an iframe from `www.tradingview.com` (+ a blob web-worker) → allowed in
  `script-src`, `frame-src`, `worker-src`.
- **Razorpay** Checkout loads `checkout.razorpay.com/v1/checkout.js` and opens its
  modal/3-D-Secure flow from `*.razorpay.com` → allowed in `script-src`, `frame-src`,
  `connect-src`, `form-action`.
- **Vercel Analytics** → `va.vercel-scripts.com` (script) + `vitals.vercel-insights.com`
  (beacon).
- **Fonts** (Inter/Sora/JetBrains Mono) are **self-hosted** by `next/font` at build
  time, so `font-src 'self'` is enough — no Google Fonts hosts needed.
- Server-side data fetches (Yahoo, SEC, NSE/BSE, FMP…) happen in your `/api/*` routes
  on the server, so they're **not** subject to CSP and correctly left out.

**COOP = `same-origin-allow-popups`, not `same-origin`:** the stricter value would cut
the `window.opener` link on popups, which can break Razorpay's bank/3-D-Secure return.
The `-allow-popups` variant keeps payments working while still giving you the
cross-window isolation scanners look for. Google sign-in is a full-page redirect here,
so it's fine either way.

**One pragmatic compromise:** `script-src` includes `'unsafe-inline'`. Your app has
inline scripts (the pre-paint theme toggle in `layout.tsx`, JSON-LD blocks) and Next's
own hydration bootstrap. Removing `'unsafe-inline'` requires nonces (below). Important:
this does **not** weaken your clickjacking protection at all — that's `frame-ancestors`,
which is unaffected.

**Deliberately skipped:** `Cross-Origin-Embedder-Policy: require-corp`. It enables full
cross-origin isolation but would instantly break TradingView, Razorpay, and remote
images. Don't add it unless you drop those embeds.

## Verify it works (5 min after deploy)

1. Load the site, open DevTools → **Console**. Click around a stock page (TradingView
   chart) and the pricing page (Razorpay). **Zero red CSP violation errors** = good.
2. Check headers are present:
   ```bash
   curl -sI https://www.quantifiapp.com | grep -iE "content-security|opener|frame-options|content-type-options|strict-transport"
   ```
3. Grade it: run the URL through https://securityheaders.com — you should jump to an
   A / A+.

### If something *does* get blocked
Flip one switch to observe instead of block. In `next.config.mjs`:
```js
const CSP_REPORT_ONLY = true;   // logs violations, blocks nothing
```
Redeploy, watch the console for the blocked host, add it to the right directive, then
set it back to `false`. (Only the CSP is affected; COOP and the rest stay enforced.)

## Optional hardening later: nonce-based CSP

To drop `'unsafe-inline'` from `script-src` (defense-in-depth against XSS), switch to
per-request nonces generated in `src/middleware.ts`, add the nonce to the CSP header and
to the inline `<script>` tags in `layout.tsx` / `JsonLd.tsx`, and use `'strict-dynamic'`.
Trade-off: reading the nonce forces **dynamic rendering**, which costs some of the static
/ SEO caching this site relies on — so it's a considered upgrade, not a free win. Your
clickjacking + COOP goals are already fully met without it.
