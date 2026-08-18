import Link from "next/link";
import TradingIdeas from "@/components/quantifi/TradingIdeas";
import DiscoverNav from "@/components/quantifi/DiscoverNav";
import UndervaluedFinds from "@/components/quantifi/UndervaluedFinds";
import RareFinds from "@/components/quantifi/RareFinds";
import ProGate from "@/components/quantifi/ProGate";
import { Eyebrow } from "@/components/quantifi/Cards";
import { playbooks } from "@/data/playbooks";
import { buildMetadata } from "@/lib/seo";

export const metadata = buildMetadata({
  title: "Research Ideas & Market Themes",
  description:
    "Global market-theme research from Quantifi, the investment question, value chain, key stocks, bull/base/bear case, thesis tests and sources. Research only, not investment advice.",
  path: "/ideas",
});

// Rare Finds is gated on the signed-in user's subscription, so this page is now
// rendered per request rather than at build time.
export const dynamic = "force-dynamic";

export default function IdeasPage() {
  const pb = playbooks[0];
  return (
    <>
      <DiscoverNav />
      {pb ? (
        <section className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8">
          <Eyebrow>Featured research playbook</Eyebrow>
          <Link
            href={`/research/${pb.id}`}
            className="group mt-3 block rounded-lg border border-gold/25 bg-gold/[0.05] p-5 transition hover:border-gold/50 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="rounded-full border border-teal/30 bg-teal/10 px-2 py-0.5 text-[0.62rem] font-medium uppercase tracking-wide text-teal">
                  {pb.type}
                </span>
                <h2 className="mt-2 font-display text-xl font-semibold text-white sm:text-2xl">
                  {pb.memoTitle ?? pb.title}
                </h2>
                <p className="mt-1 max-w-2xl text-sm text-slate-400">{pb.memoSubtitle ?? pb.subtitle}</p>
              </div>
              <span className="flex-none self-center text-sm font-medium text-gold/90 transition group-hover:text-gold">
                Open research memo →
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[0.65rem]">
              {pb.detailTags.slice(0, 6).map((t) => (
                <span key={t} className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">
                  {t}
                </span>
              ))}
            </div>
          </Link>
        </section>
      ) : null}
      <TradingIdeas showFilter limit={undefined} />

      {/* Rare Finds lives here now rather than on a page of its own with no way
          in. It is the same two sections /rare-finds still serves — that URL
          keeps working — and the same Pro gate around them. */}
      <div className="border-t border-white/[0.06]">
        <ProGate feature="Rare Finds">
          <UndervaluedFinds />
          <RareFinds />
        </ProGate>
      </div>
    </>
  );
}
