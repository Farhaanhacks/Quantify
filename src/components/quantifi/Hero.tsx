import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-4xl px-4 pb-14 pt-20 text-center sm:px-6 lg:pb-20 lg:pt-28">
        <h1 className="font-display text-5xl font-semibold leading-[1.03] tracking-tight text-white sm:text-6xl lg:text-7xl">
          Markets move.{" "}
          <span className="text-gradient-gold">Know why.</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl font-display text-xl font-medium leading-snug text-slate-200 sm:text-2xl">
          See what&apos;s shifting, why it&apos;s breaking, and how.
        </p>

        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/stock-analysis"
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-6 py-3 text-sm font-semibold text-ink transition hover:opacity-90"
          >
            Analyse Stocks
            <span aria-hidden>→</span>
          </Link>
          <Link
            href="/news"
            className="inline-flex items-center gap-2 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white transition hover:border-gold/40"
          >
            View News Impact
          </Link>
        </div>

        <p className="mt-8 text-sm text-slate-500">Educational research signals, not advice.</p>
      </div>
    </section>
  );
}
