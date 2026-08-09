import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import JsonLd from "@/components/JsonLd";
import { buildMetadata, faqJsonLd, breadcrumbJsonLd, softwareApplicationJsonLd } from "@/lib/seo";
import { HowItWorksTabs, FaqAccordion } from "@/components/quantifi/ToolGuide";

interface Tool {
  title: string;
  h1: string;
  description: string;
  intro: string;
  how: { label: string; body: string }[];
  cta: { label: string; href: string };
  faqs: { q: string; a: string }[];
}

const TOOLS: Record<string, Tool> = {
  "dcf-calculator": {
    title: "DCF Calculator — Discounted Cash Flow Valuation",
    h1: "DCF Calculator: Discounted Cash Flow Valuation",
    description:
      "Estimate a stock's intrinsic value with a discounted-cash-flow model. Quantifi computes a cash-flow-based fair value for any stock with available fundamentals. Research only, not investment advice.",
    intro:
      "A discounted cash flow (DCF) estimates what a company is worth today based on the cash it is expected to generate in the future, discounted back to the present. Quantifi runs a two-stage DCF on every stock with sufficient fundamentals and shows it next to the analyst price target.",
    how: [
      { label: "Open a stock", body: "Open any stock and Quantifi computes a cash-flow-based fair value automatically — no inputs to fill in." },
      { label: "Compare vs price", body: "Compare the model's value against the current price and the analyst mean target, side by side." },
      { label: "Stress the range", body: "Use the bull/base/bear range to see how sensitive the value is to your growth assumptions." },
    ],
    cta: { label: "Run a DCF on any stock →", href: "/stock-analysis" },
    faqs: [
      { q: "What is a DCF valuation?", a: "A discounted cash flow values a business as the present value of its future free cash flows. It's a fundamentals-based estimate of intrinsic value, independent of where the market is pricing the stock today." },
      { q: "Is the DCF a price target?", a: "No. It's a research input — a model-based fair value that can differ widely from the price. Quantifi shows it alongside the analyst target so you can weigh both. Research only, not investment advice." },
    ],
  },
  "portfolio-risk-analyzer": {
    title: "Portfolio Risk Analyzer — Concentration, Sector & Region Exposure",
    h1: "Portfolio Risk Analyzer",
    description:
      "Analyse your portfolio's concentration, sector and regional exposure from your own holdings and live prices. Research only, not investment advice.",
    intro:
      "Quantifi's portfolio analyzer takes the holdings you enter and computes single-name concentration, sector exposure and regional split using live market prices — so you can see where the real risk in your book sits. Your holdings stay in your browser/account; Quantifi never connects to your broker.",
    how: [
      { label: "Add holdings", body: "Add your holdings (ticker, quantity, average cost) — nothing is shared with a broker, and it all stays in your browser." },
      { label: "Live pricing", body: "Quantifi prices them live and computes value, gain/loss and portfolio weights automatically." },
      { label: "See the risk", body: "See concentration risk, sector mix and regional split, computed only from your real holdings." },
    ],
    cta: { label: "Open the Portfolio Risk Analyzer →", href: "/portfolio" },
    faqs: [
      { q: "Does Quantifi connect to my broker?", a: "No. You enter holdings yourself and they stay in your browser/account. Quantifi never connects to or stores broker credentials." },
      { q: "What risks does it analyse?", a: "Single-name concentration, sector concentration and regional exposure, computed from your real holdings and live prices. It is research context, not advice." },
    ],
  },
  "stock-screener": {
    title: "Stock Screener — Filter Stocks by Score, Valuation & Sector",
    h1: "Stock Screener",
    description:
      "Screen stocks live by Quantifi score, valuation gap, sector and region. Every score is computed from current fundamentals. Research only, not investment advice.",
    intro:
      "Quantifi's screener scores a universe of real, liquid names live from current fundamentals and ranks them by valuation gap, financial-health axes, sector and region — a discovery starting point for your own research.",
    how: [
      { label: "Pick a preset", body: "Pick a preset (e.g. undervalued on cash flows, rock-solid balance sheets) or set your own filters." },
      { label: "Live scoring", body: "Every row is scored live from current fundamentals when you load the screen — no static demo data." },
      { label: "Open any name", body: "Open any name for the full analysis, valuation and risks behind its score." },
    ],
    cta: { label: "Open the Stock Screener →", href: "/screener" },
    faqs: [
      { q: "Is the screener data live?", a: "Yes. Scores and fair values are computed live from current fundamentals when you load the screen. A research starting point, not a recommendation list." },
      { q: "Does a high score mean 'buy'?", a: "No. The score is a research summary of fundamentals — not a signal to buy. Research only, not investment advice." },
    ],
  },
  "pe-ratio-comparison": {
    title: "P/E Ratio Comparison — Compare Stock Valuations",
    h1: "P/E Ratio Comparison",
    description:
      "Compare price-to-earnings ratios and valuations across stocks and their peers. Research only, not investment advice.",
    intro:
      "The price-to-earnings (P/E) ratio shows how much investors pay per unit of earnings. Quantifi shows each stock's trailing and forward P/E alongside peers and the sector, so a multiple has context — a high P/E can be justified by growth, or a warning sign.",
    how: [
      { label: "See the P/E", body: "Open any stock to see its trailing and forward P/E, plus how it has moved against its own history." },
      { label: "Compare peers", body: "Compare it against peers and the sector on the same screen, so the multiple has context." },
      { label: "Judge the multiple", body: "Pair the multiple with the growth and cash-flow view to judge whether it's actually justified." },
    ],
    cta: { label: "Compare valuations on any stock →", href: "/stock-analysis" },
    faqs: [
      { q: "What is a good P/E ratio?", a: "There's no universal 'good' P/E — it depends on growth, quality and the sector. A high multiple can be justified by fast growth, or signal over-optimism. Always compare like-for-like." },
      { q: "Is a low P/E always cheap?", a: "No. A low P/E can reflect real problems ('cheap for a reason'). Quantifi pairs the multiple with growth, cash flow and risks. Research only, not investment advice." },
    ],
  },
};

export function generateStaticParams() {
  return Object.keys(TOOLS).map((slug) => ({ slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const tool = TOOLS[params.slug];
  if (!tool) return { title: "Tool not found" };
  return buildMetadata({ title: tool.title, description: tool.description, path: `/tools/${params.slug}`, type: "article" });
}

export default function ToolPage({ params }: { params: { slug: string } }) {
  const tool = TOOLS[params.slug];
  if (!tool) notFound();

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Tools", path: "/tools" },
            { name: tool.h1, path: `/tools/${params.slug}` },
          ]),
          softwareApplicationJsonLd(),
          faqJsonLd(tool.faqs),
        ]}
      />

      <nav className="text-xs text-slate-500">
        <Link href="/" className="hover:text-gold">Home</Link> ›{" "}
        <Link href="/tools" className="hover:text-gold">Tools</Link> › <span className="text-slate-400">{tool.h1}</span>
      </nav>

      <h1 className="mt-4 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">{tool.h1}</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-300">{tool.intro}</p>

      <h2 className="mt-8 font-display text-xl font-semibold text-white">How it works</h2>
      <HowItWorksTabs steps={tool.how} />

      <div className="mt-6">
        <Link href={tool.cta.href} className="inline-flex rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-5 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90">
          {tool.cta.label}
        </Link>
      </div>

      <h2 className="mt-10 font-display text-xl font-semibold text-white">FAQ</h2>
      <FaqAccordion faqs={tool.faqs} />

      <h2 className="mt-10 font-display text-lg font-semibold text-white">More tools</h2>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {Object.entries(TOOLS)
          .filter(([s]) => s !== params.slug)
          .map(([s, t]) => (
            <Link key={s} href={`/tools/${s}`} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300 transition hover:border-gold/40 hover:text-gold">
              {t.h1}
            </Link>
          ))}
      </div>

      <p className="mt-10 border-t border-white/[0.06] pt-5 text-xs leading-relaxed text-slate-500">
        Research only. Not investment advice. Quantifi does not execute trades or provide guaranteed returns.
      </p>
    </article>
  );
}
