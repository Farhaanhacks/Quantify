import Link from "next/link";

export default function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto max-w-4xl px-4 pb-14 pt-20 text-center sm:px-6 lg:pb-20 lg:pt-28">
        {/* Lead with the thing no quote screen does: the map from a headline to
            the names it moves. "Markets move, know why" is what every terminal
            claims — this says what Quantifi actually builds. */}
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gold/90">
          Research maps, not stock tips
        </p>

        <h1 className="mt-5 font-display text-[2.5rem] font-semibold leading-[1.06] tracking-tight text-white sm:text-[3.1rem] lg:text-[3.6rem]">
          Every headline,{" "}
          <span className="text-gradient-gold">mapped to the stocks it moves.</span>
        </h1>

        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
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
            See a headline mapped
          </Link>
        </div>

        <p className="mt-8 text-sm text-slate-500">Educational research signals, not advice.</p>
      </div>
    </section>
  );
}
