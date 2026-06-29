import Link from "next/link";

const QUESTIONS = [
  "What changed?",
  "Who is affected?",
  "What's already priced in?",
  "What would prove the thesis right?",
  "What would break it?",
];

const FLOW: { label: string; href: string; desc: string }[] = [
  { label: "News Impact", href: "/news", desc: "A headline → the names it moves" },
  { label: "Ideas", href: "/ideas", desc: "The research map behind a theme" },
  { label: "Research Playbooks", href: "/ideas", desc: "Major frameworks, decoded" },
  { label: "Portfolio", href: "/portfolio", desc: "How it lands on what you own" },
];

export default function ResearchPriming() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 sm:p-9">
        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-gold">
          Quantifi is not stock tips. It's research maps.
        </p>
        <h2 className="mt-3 max-w-2xl font-display text-2xl font-semibold leading-tight text-white sm:text-3xl">
          Stop asking only “what should I buy?”
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">Start asking the questions research actually answers:</p>

        <div className="mt-5 flex flex-wrap gap-2">
          {QUESTIONS.map((q) => (
            <span
              key={q}
              className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-sm text-slate-200"
            >
              {q}
            </span>
          ))}
        </div>

        <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW.map((f, i) => (
            <Link
              key={f.label}
              href={f.href}
              className="group relative rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition hover:border-gold/40"
            >
              <div className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full border border-gold/30 bg-gold/10 text-[0.65rem] font-semibold text-gold">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-white">{f.label}</span>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-slate-400">{f.desc}</p>
              <span className="mt-2 inline-block text-[0.7rem] text-gold opacity-0 transition group-hover:opacity-100">
                Open →
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
