# Quantifi — Security headers

All security headers live in **`next.config.mjs`** (`async headers()`), applied to every
route. Nothing else in the app changed for the headers. Deploy this build as-is.

## What you asked for

| Concern | Fixed by | Value shipped |
|---|---|---|
| **Clickjacking** (missing CSP) | `frame-ancestors` in the CSP **+** `X-Frame-Options` | `frame-ancestors 'self'` / `SAMEORIGIN` — no other site can iframe Quantifi. |
| **Missing COOP** | `Cross-Origin-Opener-Policy` | `same-origin-allow-popups` |

Plus `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, and HSTS.

## Why these values (so nothing breaks)

The CSP is scoped to exactly what the **browser** loads, read from the code:
TradingView (`s3.`/`www.tradingview.com`), Razorpay (`*.razorpay.com`), Vercel Analytics
(`va.vercel-scripts.com` + `vitals.vercel-insights.com`), and your own same-origin
`/api/*`. Server-side data fetches (Yahoo/SEC/NSE/BSE/FMP…) happen on the server and are
not subject to CSP. Fonts (**Lora + Source Serif 4**) are self-hosted by `next/font`, so
`font-src 'self'` is enough — no Google Fonts hosts needed.

**COOP = `same-origin-allow-popups`** so Razorpay's payment/3-D-Secure popups keep their
`window.opener` link. Google sign-in is a full-page redirect, so it's fine either way.

**One pragmatic compromise:** `script-src` keeps `'unsafe-inline'` because of inline
scripts (theme toggle, JSON-LD) and Next's hydration bootstrap. This does **not** weaken
clickjacking protection — that's `frame-ancestors`. Nonce-based upgrade path below.

**Deliberately skipped:** `Cross-Origin-Embedder-Policy: require-corp` — it would break
TradingView, Razorpay, and remote images.

## Verify after deploy

```bash
curl -sI https://www.quantifiapp.com | grep -iE "content-security|opener|frame-options|content-type-options|strict-transport"
```
Then open the site with DevTools → Console, click a stock/chart page and the pricing
page — zero red CSP errors means it's clean. Grade it at https://securityheaders.com
(expect A/A+).

If something gets blocked, set `CSP_REPORT_ONLY = true` in `next.config.mjs` to observe
without blocking, add the missing host to the right directive, then set it back.

## Optional later: nonce-based CSP

To drop `'unsafe-inline'` from `script-src`, generate a per-request nonce in
`src/middleware.ts`, add it to the CSP header and to the inline `<script>` tags in
`layout.tsx` / `JsonLd.tsx`, and use `'strict-dynamic'`. Trade-off: it forces dynamic
rendering, costing some static/SEO caching. Your clickjacking + COOP goals are already
fully met without it.
