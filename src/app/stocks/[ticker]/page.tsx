import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StockExplorer from "@/components/quantifi/StockExplorer";
import JsonLd from "@/components/JsonLd";
import { buildMetadata, faqJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { getYahooCompany } from "@/lib/yahooCompany";
import { currencySymbol } from "@/data/demo";

// Incremental Static Regeneration: each ticker page is rendered on first request
// and cached for an hour, so Google gets a fast, static-quality page that still
// refreshes its live data. Far better for crawl/indexing than SSR-on-every-hit.
export const revalidate = 3600;

function clean(t: string): string {
  return t.toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12);
}

export async function generateMetadata({ params }: { params: { ticker: string } }): Promise<Metadata> {
  const t = clean(params.ticker);
  // Resolve the real company so the title/description carry the actual name and
  // sector (better long-tail relevance) — and, crucially, so a ticker with NO
  // real data is marked noindex. Publishing empty ticker pages would be thin /
  // soft-404 content that damages the whole site's standing with Google.
  const company = await getYahooCompany(t).catch(() => null);
  const named = company?.name ? `${t} (${company.name})` : t;
  return buildMetadata({
    title: company?.name
      ? `${company.name} (${t}) Stock — Price, Valuation, Insider Activity & Financials`
      : `${t} Stock Analysis — Price, Valuation, Financials & Research`,
    description: `${named} stock analysis on Quantifi${company?.sector ? ` · ${company.sector}` : ""} — live price, valuation vs analyst targets, financial summary, ownership, insider activity and SEC-filing context. Research only, not investment advice.`,
    path: `/stocks/${t}`,
    type: "article",
    noindex: !company, // no real data → don't let Google index a thin page
  });
}

export default async function StockSeoPage({ params }: { params: { ticker: string } }) {
  const ticker = clean(params.ticker);
  // NSE/BSE listings answer to SEBI, not the SEC.
  const isIndian = /\.(NS|BO)$/i.test(ticker);
  if (!ticker) notFound();

  // Server-render real company facts for SEO (best-effort; live widgets below
  // hydrate the interactive analysis).
  const company = await getYahooCompany(ticker).catch(() => null);
  const name = company?.name;
  const sector = company?.sector;
  const c = currencySymbol(company?.currency, ticker);

  const faqs = [
    {
      q: `What is ${ticker}${name ? ` (${name})` : ""}?`,
      a: company?.description
        ? company.description.slice(0, 320)
        : `${ticker} is a publicly listed company. Quantifi shows its live price, valuation, financial summary, ownership and risks for research.`,
    },
    {
      q: `Is ${ticker} a good investment?`,
      a: `Quantifi does not say whether any stock is a buy. It gives you the data — valuation vs analyst targets, financial health, ownership and risks — so you can do your own research. Research only, not investment advice.`,
    },
    {
      q: `How is ${ticker} valued?`,
      a: `The analysis compares the current price against analysts' price targets and a cash-flow-based fair-value estimate, alongside a financial-health scorecard. Valuations move daily.`,
    },
    {
      q: `Is there recent insider trading activity in ${ticker}?`,
      // Which regulator's filings these are depends on where the company is
      // listed. Telling a reader that an NSE-listed company's insider activity
      // comes from SEC Form 4 is simply false — the SEC has no jurisdiction
      // over it — and this text is indexed by search engines as well as read.
      a: isIndian
        ? `Quantifi surfaces ${ticker} insider and SAST disclosures filed with NSE and BSE under SEBI (PIT) Regulation 7 — promoters, directors and designated persons, as disclosed. Insider transactions are one signal among many, not a recommendation.`
        : `Quantifi surfaces ${ticker} insider activity from SEC Form 4 filings — who bought or sold, how many shares and at what price — as research context. Open the Insider Activity page for the latest filings. Insider transactions are one signal among many, not a recommendation.`,
    },
    {
      q: `Where can I see ${ticker} SEC filings and financials?`,
      a: isIndian
        ? `${ticker}'s financial summary, ownership and disclosure history on Quantifi are built from public exchange and market-data sources. Use them as a starting point and confirm against the company's official NSE/BSE filings before acting.`
        : `${ticker}'s financial summary, ownership and insider (Form 4) activity on Quantifi are built from public SEC and market-data sources. Use them as a starting point and confirm against the company's official SEC EDGAR filings before acting.`,
    },
    {
      q: `Does Quantifi give buy or sell signals for ${ticker}?`,
      a: `No. Quantifi is research and education only. It does not execute trades or provide guaranteed returns.`,
    },
  ];

  return (
    <>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Stocks", path: "/stock-analysis" },
            { name: ticker, path: `/stocks/${ticker}` },
          ]),
          faqJsonLd(faqs),
        ]}
      />

      <section className="mx-auto max-w-7xl px-4 pt-10 sm:px-6 lg:px-8">
        <nav className="text-xs text-slate-500">
          <Link href="/" className="hover:text-gold">Home</Link> ›{" "}
          <Link href="/stock-analysis" className="hover:text-gold">Stocks</Link> › <span className="text-slate-400">{ticker}</span>
        </nav>
        <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
          {ticker}{name ? ` — ${name}` : ""} Stock Analysis
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Live price, valuation snapshot, analyst targets, financial summary, ownership and risks for{" "}
          {name ?? ticker}{sector ? ` · ${sector}` : ""}. Research only — not investment advice.
        </p>
        {company ? (
          <div className="mt-4 flex flex-wrap gap-2 text-xs">
            {company.price ? <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-slate-200">Price {c}{company.price.toFixed(2)}</span> : null}
            {company.targetMean ? <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-slate-200">Analyst target {c}{company.targetMean.toFixed(2)}</span> : null}
            {company.trailingPE ? <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-slate-200">P/E {company.trailingPE.toFixed(1)}</span> : null}
            {company.marketCap ? <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-slate-200">Mkt cap {c}{(company.marketCap / 1e9).toFixed(1)}B</span> : null}
          </div>
        ) : null}
      </section>

      {/* Live interactive analysis */}
      <Suspense fallback={null}>
        <StockExplorer initial={ticker} />
      </Suspense>

      {/* FAQ + links + disclaimer */}
      <section className="mx-auto max-w-3xl px-4 pb-12 sm:px-6 lg:px-8">
        <h2 className="font-display text-xl font-semibold text-white">{ticker} — frequently asked</h2>
        <div className="mt-3 space-y-4">
          {faqs.map((f) => (
            <div key={f.q}>
              <h3 className="text-sm font-semibold text-white">{f.q}</h3>
              <p className="mt-1 text-sm leading-relaxed text-slate-400">{f.a}</p>
            </div>
          ))}
        </div>

        <h2 className="mt-8 font-display text-lg font-semibold text-white">Research tools</h2>
        <div className="mt-3 flex flex-wrap gap-2 text-sm">
          <Link href="/insider-activity" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300 transition hover:border-gold/40 hover:text-gold">Insider Activity (SEC Form 4)</Link>
          <Link href="/tools/dcf-calculator" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300 transition hover:border-gold/40 hover:text-gold">DCF Calculator</Link>
          <Link href="/tools/portfolio-risk-analyzer" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300 transition hover:border-gold/40 hover:text-gold">Portfolio Risk Analyzer</Link>
          <Link href="/screener" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300 transition hover:border-gold/40 hover:text-gold">Stock Screener</Link>
          <Link href="/ideas" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300 transition hover:border-gold/40 hover:text-gold">Research Ideas</Link>
        </div>

        <p className="mt-8 border-t border-white/[0.06] pt-5 text-xs leading-relaxed text-slate-500">
          Research only. Not investment advice. Quantifi does not execute trades or provide guaranteed
          returns. Market data may be delayed and is provided on a best-efforts basis for educational use.
        </p>
      </section>
    </>
  );
}
