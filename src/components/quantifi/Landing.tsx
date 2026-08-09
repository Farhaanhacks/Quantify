import Link from "next/link";
// PRO_PRICE_LABEL/NOTE rather than a hardcoded figure: Pro is free during the
// launch offer, and the file these come from documents a surface having drifted
// out of sync with that once already.
import { PRO_PRICE_LABEL, PRO_PRICE_NOTE } from "@/data/plans";

// The signed-out front door. Everything a visitor sees before they have an
// account, and the only page on the site that is not the product.
//
// Two rules held throughout this file:
//
// 1. No invented proof. There are no testimonials, star ratings, review counts,
//    user numbers or logos here, because Quantifi has none to quote yet and a
//    fabricated one is a lie printed on the front page. What stands in for it is
//    verifiable: the actual data sources, the actual method, the actual price.
// 2. No claim the product doesn't make good on. Every feature named below is a
//    surface that exists in this repository.

function Rule({ n, children }: { n: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3 border-t border-white/[0.09] pt-4">
      <span className="font-mono text-[0.65rem] tabular-nums text-gold/70">{n}</span>
      <h3 className="font-editorial text-[1.35rem] leading-tight text-white">{children}</h3>
    </div>
  );
}

// A miniature of the real impact map, drawn in markup rather than dropped in as
// a screenshot so it stays sharp and readable at any width.
function ImpactPreview() {
  const chain = [
    "Earnings beat lands",
    "Sector sentiment lifts",
    "Read-through to suppliers",
    "4 other names affected",
  ];
  return (
    <div className="rounded-xl border border-white/[0.08] bg-ink-900 p-5">
      <div className="flex items-center gap-2 text-[0.65rem] text-slate-500">
        <span className="text-teal">Reuters</span>
        <span>·</span>
        <span>12m ago</span>
        <span className="ml-auto rounded-full border border-up/30 px-2 py-0.5 text-up">positive</span>
      </div>
      <p className="mt-2 text-sm font-medium leading-snug text-white">
        Chipmaker lifts full-year guidance on data-centre demand
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[0.65rem]">
        <span className="rounded-full border border-up/30 px-2 py-0.5 text-up">High impact</span>
        <span className="text-slate-500">78% confidence</span>
      </div>
      <ol className="mt-4 space-y-0">
        {chain.map((s, i) => (
          <li key={s} className="relative pl-7">
            <span className="absolute left-0 top-0.5 grid h-5 w-5 place-items-center rounded-full border border-gold/30 bg-gold/10 text-[0.6rem] font-semibold text-gold">
              {i + 1}
            </span>
            {i < chain.length - 1 ? (
              <span className="absolute left-[9px] top-6 h-[calc(100%-1.25rem)] w-px bg-gradient-to-b from-gold/40 to-transparent" />
            ) : null}
            <p className={`pb-3.5 text-[0.82rem] leading-snug ${i === chain.length - 1 ? "text-white" : "text-slate-300"}`}>
              {s}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function ValuationPreview() {
  return (
    <div className="rounded-xl border border-white/[0.08] bg-ink-900 p-5">
      <div className="text-[0.6rem] uppercase tracking-[0.16em] text-slate-500">
        Share price vs fair value
      </div>
      <div className="mt-3">
        <div className="text-2xl font-semibold text-up">38.4%</div>
        <div className="text-xs text-up/80">Undervalued</div>
      </div>
      <div className="mt-4 space-y-2">
        <div className="relative h-11 overflow-hidden rounded-md border border-white/[0.07] bg-white/[0.02]">
          <div className="absolute inset-y-0 left-0 w-[61%] bg-gradient-to-r from-up/50 to-up/20" />
          <div className="relative flex h-full items-center justify-between px-3">
            <span className="text-[0.58rem] uppercase tracking-[0.14em] text-slate-400">Current price</span>
            <span className="font-mono text-sm text-white">₹1,284</span>
          </div>
        </div>
        <div className="relative h-11 overflow-hidden rounded-md border border-white/[0.07] bg-white/[0.02]">
          <div className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-up/45 to-up/15" />
          <div className="relative flex h-full items-center justify-between px-3">
            <span className="text-[0.58rem] uppercase tracking-[0.14em] text-slate-400">Fair value</span>
            <span className="font-mono text-sm text-white">₹2,085</span>
          </div>
        </div>
      </div>
      <p className="mt-3 text-[0.68rem] leading-relaxed text-slate-500">
        Discounted cash flow, with the discount rate built from the local bond yield, the
        company&apos;s beta and an equity risk premium — not a fixed 9% applied to every market.
      </p>
    </div>
  );
}

export default function Landing() {
  return (
    <div className="pb-24">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-14 sm:px-6 sm:pt-20 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <h1 className="font-editorial text-[2.6rem] font-normal leading-[1.06] tracking-tight text-white sm:text-[3.4rem] lg:text-[3.9rem]">
              Know what a company is
              <br className="hidden sm:block" /> worth, and{" "}
              <span className="text-gold">why</span>.
            </h1>
            <p className="mt-6 max-w-xl text-[1.02rem] leading-relaxed text-slate-300">
              Quantifi reads the filings, the cash flows and the day&apos;s news for a company and
              shows you the working — the valuation, the debt, the insider trades and the headlines
              that actually move the name. Every figure traces back to a source you can open.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90"
              >
                Create your free account
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-gold/40 hover:text-gold"
              >
                See what&apos;s included
              </Link>
            </div>
            {/* No allowance quoted here on purpose. The figure this used to
                print came from FREE_LIMITS.analysesPerDay, which the app
                enforces as a per-day quota, and that does not describe what a
                free account actually gets. Rather than restate a number the
                product might contradict, the page sends people to /pricing,
                where the plan is set out in one place. */}
            <p className="mt-3 text-xs text-slate-500">
              Free to start — no card required.
            </p>
          </div>

          <div className="relative">
            {/* A restrained wash behind the panels — enough to lift them off the
                page, not the usual blurred blob doing the work of a design. */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -inset-8 rounded-[2rem] bg-gold/[0.05] blur-2xl"
            />
            <div className="relative grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <ImpactPreview />
              <ValuationPreview />
            </div>
          </div>
        </div>
      </section>

      {/* ── Where the numbers come from ──────────────────────────────────── */}
      <section className="border-y border-white/[0.07] bg-white/[0.015]">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:grid-cols-3 sm:px-6 lg:px-8">
          {[
            ["Market data", "Prices, fundamentals and estimates from Yahoo Finance, across US and Indian listings."],
            ["Filings", "Insider trades from SEC Form 4 and corporate events from Form 8-K, read straight from EDGAR."],
            ["Your holdings", "Entered by you and kept to your account. Quantifi never connects to your broker."],
          ].map(([h, b]) => (
            <div key={h}>
              <div className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-gold/70">{h}</div>
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-slate-400">{b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Three pillars ────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <h2 className="max-w-2xl font-editorial text-[2rem] leading-tight text-white sm:text-[2.5rem]">
          Three questions, answered properly.
        </h2>
        <div className="mt-12 grid gap-10 md:grid-cols-3">
          <div>
            <Rule n="01">What just happened, and to whom?</Rule>
            <p className="mt-3 text-[0.88rem] leading-relaxed text-slate-400">
              Every headline is traced into what changed, why it matters and the chain of names it
              reaches — the supplier and the index fund, not only the company in the title.
            </p>
          </div>
          <div>
            <Rule n="02">What is it actually worth?</Rule>
            <p className="mt-3 text-[0.88rem] leading-relaxed text-slate-400">
              A cash-flow valuation you can argue with: the discount rate comes from the local bond
              yield, the company&apos;s beta and an equity risk premium, and the assumptions are
              printed next to the answer.
            </p>
          </div>
          <div>
            <Rule n="03">What am I actually holding?</Rule>
            <p className="mt-3 text-[0.88rem] leading-relaxed text-slate-400">
              Your portfolio priced live, with concentration, sector drift and the debt and cash
              position of each name you own.
            </p>
          </div>
        </div>
      </section>

      {/* ── Filings ──────────────────────────────────────────────────────── */}
      <section className="border-y border-white/[0.07] bg-white/[0.015] py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.2em] text-gold/70">
              Corporate events
            </p>
            <h2 className="mt-4 font-editorial text-[2rem] leading-tight text-white sm:text-[2.4rem]">
              The filing, on the day the price moved.
            </h2>
            <p className="mt-5 max-w-xl leading-relaxed text-slate-300">
              Results, executive changes, acquisitions and delisting notices are pinned to the
              price chart on the date they were filed. Open one and you get the relevant section of
              the document itself — not a summary of it.
            </p>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-slate-500">
              Events are classified from the 8-K item codes the company filed under. A code we
              can&apos;t map is dropped rather than guessed at, so a marker on the chart always
              means the filing actually said so.
            </p>
          </div>
          <div className="rounded-xl border border-white/[0.08] bg-ink-900 p-5">
            <div className="flex items-center justify-between text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
              <span>Price · 6 months</span>
              <span className="text-gold/70">4 events</span>
            </div>
            <svg viewBox="0 0 420 150" className="mt-3 w-full" role="img" aria-label="Price chart with filing markers">
              <polyline
                points="6,116 46,104 86,110 126,84 166,90 206,62 246,70 286,44 326,52 366,30 414,24"
                fill="none"
                stroke="#4FD1C5"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
              {[
                [126, 84],
                [206, 62],
                [286, 44],
                [366, 30],
              ].map(([x, y]) => (
                <g key={x}>
                  <line x1={x} y1={y} x2={x} y2={140} stroke="rgba(212,175,55,0.28)" strokeWidth="1" />
                  <circle cx={x} cy={y} r="4.5" fill="#05070D" stroke="#D4AF37" strokeWidth="2" />
                </g>
              ))}
            </svg>
            <div className="mt-3 space-y-2 border-t border-white/[0.07] pt-3">
              {[
                ["2.02", "Results of operations"],
                ["5.02", "Departure of directors or officers"],
                ["1.01", "Entry into a material agreement"],
              ].map(([code, label]) => (
                <div key={code} className="flex items-baseline gap-3 text-[0.78rem]">
                  <span className="font-mono text-[0.68rem] text-gold/80">{code}</span>
                  <span className="text-slate-300">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── The honesty section ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
          <div>
            <h2 className="font-editorial text-[2rem] leading-tight text-white sm:text-[2.4rem]">
              What Quantifi won&apos;t do.
            </h2>
            <p className="mt-5 leading-relaxed text-slate-300">
              Most of the work in a research tool is deciding what to show when the data is thin.
              The easy answer is to fill the gap and hope nobody checks. These are the places
              Quantifi refuses to.
            </p>
          </div>
          <div className="space-y-6">
            {[
              [
                "No invented history",
                "A chart of past valuations is only drawn from figures that were actually reported. Where a company's record can't support it, the panel says which requirement it failed instead of drawing a plausible line.",
              ],
              [
                "No guessed classifications",
                "A filing whose item code isn't in the SEC's published taxonomy is dropped, not labelled with the nearest-looking category.",
              ],
              [
                "No borrowed credibility",
                "There are no testimonials, star ratings or user counts on this page, because there are none to quote yet. When there are, they will be real ones.",
              ],
              [
                "No advice",
                "Quantifi is research tooling, not a broker or an adviser. It never tells you to buy anything, and it never touches your money.",
              ],
            ].map(([h, b]) => (
              <div key={h} className="border-t border-white/[0.09] pt-4">
                <h3 className="font-editorial text-[1.2rem] text-white">{h}</h3>
                <p className="mt-1.5 text-[0.86rem] leading-relaxed text-slate-400">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Close ────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-gold/20 bg-gradient-to-b from-gold/[0.08] to-transparent px-6 py-14 text-center sm:px-12">
          <h2 className="mx-auto max-w-2xl font-editorial text-[2rem] leading-tight text-white sm:text-[2.6rem]">
            Start with one company you already own.
          </h2>
          <p className="mx-auto mt-4 max-w-xl leading-relaxed text-slate-300">
            See whether the numbers agree with the reason you bought it.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-7 py-3 text-sm font-semibold text-ink transition hover:opacity-90"
            >
              Create your free account
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center rounded-full border border-white/15 px-7 py-3 text-sm font-medium text-slate-200 transition hover:border-gold/40 hover:text-gold"
            >
              Pro is {PRO_PRICE_LABEL.toLowerCase()} {PRO_PRICE_NOTE}
            </Link>
          </div>
          <p className="mt-5 text-xs text-slate-500">
            Market data may be delayed. For research and education — not investment advice.
          </p>
        </div>
      </section>
    </div>
  );
}
