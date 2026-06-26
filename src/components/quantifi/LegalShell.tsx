import Link from "next/link";
import { Eyebrow } from "@/components/quantifi/Cards";

// Shared layout for the trust & compliance pages (privacy, terms, refund,
// contact, about). Clean, readable, and consistent — these pages exist to make
// Quantifi transparent and verifiable, not to look like a marketing funnel.
export default function LegalShell({
  eyebrow,
  title,
  updated,
  children,
}: {
  eyebrow: string;
  title: string;
  updated?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8">
      <Eyebrow>{eyebrow}</Eyebrow>
      <h1 className="mt-3 font-display text-3xl font-semibold leading-tight text-white sm:text-4xl">
        {title}
      </h1>
      {updated ? <p className="mt-2 text-xs text-slate-500">Last updated {updated}</p> : null}

      <div className="legal-body mt-8 space-y-6 text-sm leading-relaxed text-slate-300">
        {children}
      </div>

      <div className="mt-10 rounded-xl border border-white/[0.08] bg-white/[0.02] p-4 text-xs leading-relaxed text-slate-400">
        <strong className="text-slate-200">Quantifi is for research and education only. Not investment advice.</strong>{" "}
        Nothing on Quantifi is a recommendation to buy, sell or hold any security. We are not a broker,
        exchange, or registered investment adviser, and we are not affiliated with any broker or
        exchange. Always do your own research and consult a licensed professional before investing.
      </div>

      <div className="mt-6 flex flex-wrap gap-x-4 gap-y-2 text-xs text-slate-500">
        {[
          { href: "/about", label: "About" },
          { href: "/privacy", label: "Privacy" },
          { href: "/terms", label: "Terms" },
          { href: "/refund-policy", label: "Refund & Cancellation" },
          { href: "/contact", label: "Contact" },
        ].map((l) => (
          <Link key={l.href} href={l.href} className="transition hover:text-gold">
            {l.label}
          </Link>
        ))}
      </div>
    </section>
  );
}

// Small helpers for consistent section structure inside legal pages.
export function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg font-semibold text-white">{children}</h2>;
}
