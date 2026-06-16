# Quantifi

A premium **market-discovery & portfolio-intelligence** web app built with **Next.js 14 (App Router)**, **TypeScript** and **Tailwind CSS**.

> **Find what's moving, why it's moving, and which stocks are affected.**

Quantifi turns market news, insider activity, portfolio risk and famous investor
narratives into clear research signals. It is an **educational** prototype — it
makes no buy/sell/hold recommendations and uses **static demo data** only.

---

## Tech

- Next.js 14 App Router · TypeScript · Tailwind CSS
- `src/` directory with the `@/*` import alias
- Mobile-first, fully responsive
- Forced dark premium theme (light mode cannot break the UI)
- **No external chart libraries** — sparklines and donuts are inline SVG
- **No paid APIs, no broker connect** — all data lives in `src/data/demo.ts`

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:3000.

To create a production build:

```bash
npm run build
npm start
```

> Note: `next/font/google` downloads font files at build time, so the first
> `npm run build` needs network access (this is handled automatically on Vercel
> and on any normal dev machine).

## Deploy on Vercel

1. Push this folder to a Git repository.
2. Import the repo at [vercel.com/new](https://vercel.com/new).
3. Framework preset is auto-detected as **Next.js** — no extra config needed.
4. Deploy.

## Project structure

```
src/
  app/
    layout.tsx              # root layout: fonts, global Navbar + Footer
    globals.css             # ink theme, glass utilities, animations
    page.tsx                # homepage
    portfolio/page.tsx
    ideas/page.tsx
    news/page.tsx
    insider-activity/page.tsx
    explore/page.tsx
    screener/page.tsx
    famous-takes/page.tsx
    stock-analysis/page.tsx
    watchlist/page.tsx
  components/quantifi/
    Cards.tsx               # shared primitives (GlassCard, Sparkline, Donut, ImpactChain, …)
    Navbar.tsx  Footer.tsx  Hero.tsx  MarketPulse.tsx
    PortfolioStocks.tsx  Diversification.tsx
    TradingIdeas.tsx  NewsImpact.tsx  InsiderActivity.tsx
    ExploreCompanies.tsx  FamousTakes.tsx  StockAnalysis.tsx  Watchlist.tsx
    CompanySnapshot.tsx   Screener.tsx     # Quantifi Score, fair value, screener
  data/
    demo.ts                 # all typed demo data + formatting helpers
```

## Editing the data

Everything the UI shows comes from `src/data/demo.ts`: the stock universe,
holdings, trading ideas, news (with their direct / peer / sector / ETF impact),
insider events, famous takes, the stock-analysis record and the watchlist.
Edit that one file to reshape the entire prototype.

## Disclaimer

Quantifi is an educational market research and analytics platform. The
information shown is for general informational and educational purposes only and
should not be treated as financial advice, investment advice, trading advice, or
a recommendation to buy, sell, or hold any security. Data may be delayed,
incomplete, or inaccurate. Always verify independently.

## Live market data (optional)

By default the app runs entirely on the demo data in `src/data/demo.ts`, so it
works with zero configuration. To switch to live data:

1. Sign up for a data provider — the built-in adapter targets
   [Financial Modeling Prep](https://site.financialmodelingprep.com/) (broad US +
   Indian/NSE coverage and fundamentals).
2. Copy `.env.example` to `.env.local` and set:
   ```
   MARKET_DATA_PROVIDER=fmp
   MARKET_DATA_API_KEY=your_key_here
   ```
3. Restart `npm run dev`. The Market Pulse movers strip shows a **LIVE** badge
   when a key is detected and a **DEMO** badge otherwise. All data access goes
   through `src/lib/marketData.ts`, which falls back to demo data on any error,
   so the UI never breaks.

> Important: most providers' **free tiers prohibit commercial/paid use**. If you
> charge for the product, you need a paid commercial data licence.

## Payments (Stripe)

Checkout is wired through Stripe Checkout (hosted — no card data touches this
site). It stays dormant until you add keys, so the app builds without them.

1. Create a free Stripe account and grab your **test** secret key (`sk_test_…`).
2. In the Stripe dashboard create two recurring Prices and note their IDs.
3. In `.env.local` set:
   ```
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PRICE_PLUS=price_...
   STRIPE_PRICE_PRO=price_...
   NEXT_PUBLIC_BASE_URL=http://localhost:3000
   ```
4. Run the app, open `/pricing`, click a paid plan, and pay with Stripe's test
   card `4242 4242 4242 4242` (any future expiry / any CVC).
5. For subscription events, set up a webhook to `/api/webhook` and add
   `STRIPE_WEBHOOK_SECRET`. Granting access on payment needs a user/database
   layer (not included in this prototype — see the TODOs in the webhook route).

> Test mode needs no business. Accepting **real** payments requires an activated
> Stripe account (a registered business + KYC), and charging fees for
> stock-related research may carry regulatory obligations — get professional
> advice first.

## Deploying with env vars on Vercel

Add the same variables under **Project → Settings → Environment Variables** in
Vercel, then redeploy. Because the app now has API routes, it runs as a Next.js
server (still zero-config on Vercel).
