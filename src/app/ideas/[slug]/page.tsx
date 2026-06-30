import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { tradingIdeas } from "@/data/ideas";
import JsonLd from "@/components/JsonLd";
import {
  buildMetadata,
  articleJsonLd,
  faqJsonLd,
  breadcrumbJsonLd,
} from "@/lib/seo";

// Slug aliases → existing theme ids, and special slugs that redirect to a
// long-form research memo. No fabricated content: a slug only renders if it
// maps to a real theme.
const ALIASES: Record<string, string> = {
  "ai-infrastructure": "ai-power-bottleneck",
  "jeremy-grantham-ai-bubble": "great-company-dangerous-price",
};
const REDIRECTS: Record<string, string> = {
  "situational-awareness": "/research/situational-awareness",
  "openai-public-market-proxies": "/research/situational-awareness",
  "anthropic-public-market-proxies": "/research/situational-awareness",
};

function resolve(slug: string) {
  const id = ALIASES[slug] ?? slug;
  return tradingIdeas.find((i) => i.id === id);
}

export function generateStaticParams() {
  return [
    ...tradingIdeas.map((i) => ({ slug: i.id })),
    ...Object.keys(ALIASES).map((slug) => ({ slug })),
    ...Object.keys(REDIRECTS).map((slug) => ({ slug })),
  ];
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  if (REDIRECTS[params.slug]) {
    return buildMetadata({
      title: "Research",
      description: "Quantifi research.",
      path: `/ideas/${params.slug}`,
    });
  }
  const idea = resolve(params.slug);
  if (!idea) return { title: "Idea not found" };
  return buildMetadata({
    title: `${idea.title}: Thesis, Key Stocks & Risks`,
    description: idea.tagline || idea.description.slice(0, 155),
    path: `/ideas/${params.slug}`,
    type: "article",
  });
}

function faqsFor(title: string, tickers: string[]): { q: string; a: string }[] {
  const names = tickers.slice(0, 6).join(", ");
  return [
    {
      q: `What is the ${title} theme?`,
      a: `${title} is a research framework Quantifi uses to study a market theme — its core thesis, the companies exposed to it, the bull and bear case, and what would prove or break it. It is educational research, not a recommendation.`,
    },
    {
      q: `Which stocks are linked to ${title}?`,
      a: names
        ? `Names studied within this theme include ${names}. These are shown as thematic exposure for research, not as a buy list.`
        : `Quantifi groups names by their role in the theme rather than as a buy list.`,
    },
    {
      q: `What are the risks of the ${title} theme?`,
      a: `Every theme carries risk — valuations move daily, the thesis can break, and a name being central to a theme does not make it a good investment. See the bear case and "what to watch" on this page.`,
    },
    {
      q: `Is this investment advice?`,
      a: `No. Quantifi is research and education only — not investment advice. Quantifi does not execute trades or provide guaranteed returns. Always do your own research and consult a licensed professional.`,
    },
  ];
}

export default function IdeaSlugPage({ params }: { params: { slug: string } }) {
  if (REDIRECTS[params.slug]) redirect(REDIRECTS[params.slug]);
  const idea = resolve(params.slug);
  if (!idea) notFound();

  const tickers = idea.tickers.slice(0, 10);
  const faqs = faqsFor(idea.title, tickers);
  const related = tradingIdeas.filter((i) => i.id !== idea.id).slice(0, 4);

  return (
    <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: "Home", path: "/" },
            { name: "Ideas", path: "/ideas" },
            { name: idea.title, path: `/ideas/${params.slug}` },
          ]),
          articleJsonLd({
            title: `${idea.title}: Thesis, Key Stocks & Risks`,
            description: idea.tagline || idea.description.slice(0, 155),
            path: `/ideas/${params.slug}`,
          }),
          faqJsonLd(faqs),
        ]}
      />

      {/* Breadcrumb */}
      <nav className="text-xs text-slate-500">
        <Link href="/" className="hover:text-gold">Home</Link> ›{" "}
        <Link href="/ideas" className="hover:text-gold">Ideas</Link> › <span className="text-slate-400">{idea.title}</span>
      </nav>

      <p className="mt-4 text-[0.7rem] uppercase tracking-[0.16em] text-gold">{idea.category} · Research theme</p>
      <h1 className="mt-2 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">{idea.title}</h1>
      <p className="mt-3 text-base leading-relaxed text-slate-300">{idea.tagline}</p>

      {/* Thesis */}
      <h2 className="mt-8 font-display text-xl font-semibold text-white">The thesis</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-300">{idea.description}</p>
      {idea.whyNow ? (
        <>
          <h3 className="mt-5 font-display text-base font-semibold text-white">Why it matters now</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{idea.whyNow}</p>
        </>
      ) : null}

      {/* Key stocks */}
      {tickers.length ? (
        <>
          <h2 className="mt-8 font-display text-xl font-semibold text-white">Key stocks &amp; ETFs</h2>
          <p className="mt-1 text-xs text-slate-500">Thematic exposure studied within this theme — not a buy list.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tickers.map((t) => (
              <Link
                key={t}
                href={`/stocks/${encodeURIComponent(t)}`}
                className="rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 font-mono text-sm text-slate-200 transition hover:border-gold/40 hover:text-gold"
              >
                {t}
              </Link>
            ))}
          </div>
        </>
      ) : null}

      {/* Bull / bear */}
      <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-up/20 bg-up/5 p-4">
          <h2 className="text-[0.62rem] uppercase tracking-[0.16em] text-up/80">Bull case</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{idea.bullCase}</p>
        </div>
        <div className="rounded-xl border border-down/20 bg-down/5 p-4">
          <h2 className="text-[0.62rem] uppercase tracking-[0.16em] text-down/80">Bear case &amp; risks</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-300">{idea.bearCase}</p>
        </div>
      </div>

      {/* What to watch */}
      {idea.watch?.length ? (
        <>
          <h2 className="mt-8 font-display text-xl font-semibold text-white">What to watch</h2>
          <ul className="mt-2 space-y-1.5">
            {idea.watch.map((w) => (
              <li key={w} className="flex gap-2 text-sm leading-relaxed text-slate-300">
                <span className="mt-1 flex-none text-gold">›</span>
                <span>{w}</span>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {/* Open the interactive theme */}
      <div className="mt-8 rounded-xl border border-gold/20 bg-gold/[0.05] p-4">
        <Link href={`/ideas?theme=${encodeURIComponent(idea.id)}`} className="text-sm font-medium text-gold hover:underline">
          Open the full interactive research map for {idea.title} →
        </Link>
      </div>

      {/* FAQ */}
      <h2 className="mt-10 font-display text-xl font-semibold text-white">FAQ</h2>
      <div className="mt-3 space-y-4">
        {faqs.map((f) => (
          <div key={f.q}>
            <h3 className="text-sm font-semibold text-white">{f.q}</h3>
            <p className="mt-1 text-sm leading-relaxed text-slate-400">{f.a}</p>
          </div>
        ))}
      </div>

      {/* Internal links */}
      <h2 className="mt-10 font-display text-xl font-semibold text-white">Related research &amp; tools</h2>
      <div className="mt-3 flex flex-wrap gap-2 text-sm">
        {related.map((r) => (
          <Link key={r.id} href={`/ideas/${r.id}`} className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300 transition hover:border-gold/40 hover:text-gold">
            {r.title}
          </Link>
        ))}
        <Link href="/tools/dcf-calculator" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300 transition hover:border-gold/40 hover:text-gold">DCF Calculator</Link>
        <Link href="/tools/portfolio-risk-analyzer" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300 transition hover:border-gold/40 hover:text-gold">Portfolio Risk Analyzer</Link>
        <Link href="/screener" className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-slate-300 transition hover:border-gold/40 hover:text-gold">Stock Screener</Link>
      </div>

      <p className="mt-10 border-t border-white/[0.06] pt-5 text-xs leading-relaxed text-slate-500">
        Research only. Not investment advice. Quantifi does not execute trades or provide guaranteed
        returns. This page studies a market theme for educational purposes; it is not a recommendation to
        buy, sell or hold any security.
      </p>
    </article>
  );
}
