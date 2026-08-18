import Link from "next/link";
// PRO_PRICE_LABEL/NOTE rather than a hardcoded figure: Pro is free during the
// launch offer, and the file these come from documents a surface having drifted
// out of sync with that once already.
import { PRO_PRICE_LABEL, PRO_PRICE_NOTE } from "@/data/plans";
import LandingSearch from "@/components/quantifi/LandingSearch";

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
        company&apos;s beta and an equity risk premium, not a fixed 9% applied to every market.
      </p>
    </div>
  );
}

// Line icons, drawn here rather than pulled from an icon set: three svgs is not
// worth a dependency, and a stroked outline sits better with the serif than the
// filled glyph-in-a-circle that every template ships with.
const iconProps = {
  width: 26,
  height: 26,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

const PinIcon = () => (
  <svg {...iconProps}>
    <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" />
    <circle cx="12" cy="10" r="2.5" />
  </svg>
);

const PulseIcon = () => (
  <svg {...iconProps}>
    <path d="M2 12h4l2.5-7 4 14L15.5 12H22" />
  </svg>
);

const ShieldIcon = () => (
  <svg {...iconProps}>
    <path d="M12 3 5 6v5.5c0 4.3 3 8.2 7 9.5 4-1.3 7-5.2 7-9.5V6l-7-3Z" />
    <path d="m9.5 12 1.8 1.8 3.4-3.6" />
  </svg>
);

// A portfolio at a glance, in the same house style as the other previews.
function PortfolioPreview() {
  const rows = [
    ["RELIANCE.NS", "Reliance", "+18.4%", true],
    ["TCS.NS", "Tata Consultancy", "+6.1%", true],
    ["NVDA", "NVIDIA", "+42.7%", true],
    ["ASML", "ASML Holding", "-3.2%", false],
  ] as const;
  return (
    <div className="rounded-xl border border-white/[0.08] bg-ink-900 p-5">
      <div className="flex items-baseline justify-between">
        <span className="text-[0.6rem] uppercase tracking-[0.16em] text-slate-500">
          Portfolio value
        </span>
        <span className="text-[0.6rem] uppercase tracking-[0.16em] text-slate-500">
          4 holdings
        </span>
      </div>
      <div className="mt-1 flex items-baseline gap-3">
        <span className="font-mono text-2xl text-white">₹18,42,600</span>
        <span className="text-sm font-medium text-up">+14.2%</span>
      </div>
      <div className="mt-4 space-y-2 border-t border-white/[0.07] pt-3">
        {rows.map(([sym, name, chg, up]) => (
          <div key={sym} className="flex items-center gap-3 text-[0.8rem]">
            <span className="font-mono text-[0.68rem] text-slate-500">{sym}</span>
            <span className="min-w-0 flex-1 truncate text-slate-300">{name}</span>
            <span className={up ? "text-up" : "text-down"}>{chg}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-white/[0.07] pt-3">
        <div className="text-[0.6rem] uppercase tracking-[0.16em] text-slate-500">
          Concentration
        </div>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full">
          <span className="w-[46%] bg-gold/70" />
          <span className="w-[24%] bg-teal/60" />
          <span className="w-[18%] bg-up/50" />
          <span className="w-[12%] bg-white/15" />
        </div>
        <p className="mt-2 text-[0.7rem] text-slate-500">
          46% of the book sits in one name.
        </p>
      </div>
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
              shows you the working: the valuation, the debt, the insider trades and the headlines
              that actually move the name. Every figure traces back to a source you can open.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="inline-flex items-center gap-2.5 rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90"
              >
                Create your free account
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center rounded-lg border border-white/15 px-6 py-3 text-sm font-medium text-slate-200 transition hover:border-gold/40 hover:text-gold"
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
              Free to start. No card required.
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
              reaches: the supplier and the index fund, not only the company in the title.
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
              the document itself, not a summary of it.
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
                  <circle cx={x} cy={y} r="4.5" fill="#16181D" stroke="#D4AF37" strokeWidth="2" />
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

      {/* ── Find your next Money Maker ───────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <h2 className="font-editorial text-[2.1rem] leading-tight text-white sm:text-[2.6rem]">
              Find your next Money Maker.
            </h2>
            <p className="mt-5 max-w-xl leading-relaxed text-slate-300">
              Screen the US and Indian markets on the numbers that decide an outcome: cash
              generation, debt, growth and what the shares already cost. Every name comes with the
              valuation worked through, so you can tell a cheap company from a broken one.
            </p>
            <ul className="mt-6 space-y-2.5">
              {[
                "A fair value per share, with the assumptions shown",
                "Insider buying and selling, straight from the filings",
                "Peers ranked beside it on the same measures",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[0.9rem] text-slate-400">
                  <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-gold" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
          <ValuationPreview />
        </div>
      </section>

      {/* ── Master your portfolio ────────────────────────────────────────── */}
      <section className="border-y border-white/[0.07] bg-white/[0.015] py-20">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8">
          <div className="order-2 lg:order-1">
            <PortfolioPreview />
          </div>
          <div className="order-1 lg:order-2">
            <h2 className="font-editorial text-[2.1rem] leading-tight text-white sm:text-[2.6rem]">
              Master your portfolio.
            </h2>
            <p className="mt-5 max-w-xl leading-relaxed text-slate-300">
              Your holdings priced live, with the concentration you&apos;ve actually taken on, the
              sectors you&apos;ve drifted into, and the debt sitting inside the companies you own.
            </p>
            <ul className="mt-6 space-y-2.5">
              {[
                "Gain and loss per holding, and across the whole book",
                "Where you are concentrated, before it matters",
                "The same valuation work applied to what you already hold",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-[0.9rem] text-slate-400">
                  <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-gold" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Three supporting features ────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="grid gap-10 md:grid-cols-3">
          {[
            [
              <PinIcon key="i" />,
              "All of your portfolios in one place.",
              "Track several portfolios side by side, each priced live.",
            ],
            [
              <PulseIcon key="i" />,
              "Never miss your moment.",
              "News Impact traces each headline to the names it moves, as it lands.",
            ],
            [
              <ShieldIcon key="i" />,
              "Your holdings stay yours.",
              "Kept to your account. Quantifi never connects to your broker and never places a trade.",
            ],
          ].map(([icon, h, b]) => (
            <div key={h as string}>
              <div className="text-gold">{icon}</div>
              <h3 className="mt-4 border-t border-white/[0.09] pt-4 font-editorial text-[1.3rem] leading-tight text-white">
                {h as string}
              </h3>
              <p className="mt-2 text-[0.86rem] leading-relaxed text-slate-400">{b as string}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Search the market ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <LandingSearch />
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
              className="inline-flex items-center rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-7 py-3 text-sm font-semibold text-ink transition hover:opacity-90"
            >
              Create your free account
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center rounded-lg border border-white/15 px-7 py-3 text-sm font-medium text-slate-200 transition hover:border-gold/40 hover:text-gold"
            >
              Pro is {PRO_PRICE_LABEL.toLowerCase()} {PRO_PRICE_NOTE}
            </Link>
          </div>
          <p className="mt-5 text-xs text-slate-500">
            Market data may be delayed. For research and education, not investment advice.
          </p>
        </div>
      </section>
    </div>
  );
}
