import Link from "next/link";

const QUESTIONS = [
  "What changed?",
  "Who is affected?",
  "What's already priced in?",
  "What would prove the thesis right?",
  "What would break it?",
];

// Ideas and Research Playbooks are no longer surfaced anywhere in the product —
// they were dropped from the nav when that content moved to the community page,
// so they don't belong in the flow either. News Impact leads.
const FLOW: { label: string; href: string; desc: string }[] = [
  { label: "News Impact", href: "/news", desc: "A headline → the names it moves" },
  { label: "Portfolio", href: "/portfolio", desc: "How it lands on what you own" },
];

export default function ResearchPriming() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] p-6 sm:p-9">
        {/* The hero already says "research maps, not stock tips" — this section
            shows what that means in practice rather than repeating the claim. */}
        <p className="text-[0.7rem] uppercase tracking-[0.18em] text-gold">
          What a research map answers
        </p>
        <p className="mt-3 max-w-2xl text-sm text-slate-400">
          Every map on Quantifi is built around the same five questions:
        </p>

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

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FLOW.map((f, i) => (
            <Link
              key={f.label}
              href={f.href}
              className="group relative rounded-lg border border-white/[0.08] bg-white/[0.02] p-4 transition hover:border-gold/40"
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
