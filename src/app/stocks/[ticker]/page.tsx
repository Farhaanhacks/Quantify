import Link from "next/link";
import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import StockExplorer from "@/components/quantifi/StockExplorer";
import JsonLd from "@/components/JsonLd";
import { buildMetadata, faqJsonLd, breadcrumbJsonLd } from "@/lib/seo";
import { getYahooCompany } from "@/lib/yahooCompany";

export const dynamic = "force-dynamic";

function clean(t: string): string {
  return t.toUpperCase().replace(/[^A-Z0-9.\-]/g, "").slice(0, 12);
}

export function generateMetadata({ params }: { params: { ticker: string } }): Metadata {
  const t = clean(params.ticker);
  return buildMetadata({
    title: `${t} Stock Analysis — Price, Valuation, Financials & Research`,
    description: `${t} stock analysis on Quantifi — live price, valuation snapshot, analyst targets, financial summary, ownership and risks. Research only, not investment advice.`,
    path: `/stocks/${t}`,
    type: "article",
  });
}

export default async function StockSeoPage({ params }: { params: { ticker: string } }) {
  const ticker = clean(params.ticker);
  if (!ticker) notFound();

  // Server-render real company facts for SEO (best-effort; live widgets below
  // hydrate the interactive analysis).
  const company = await getYahooCompany(ticker).catch(() => null);
  const name = company?.name;
  const sector = company?.sector;
  const c = company?.currency === "INR" || /\.(NS|BO)$/i.test(ticker) ? "₹" : "$";

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
