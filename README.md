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
