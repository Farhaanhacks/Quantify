"use client";

import { useEffect, useState } from "react";
import { GlassCard, SectionHeading, Tag, Eyebrow } from "@/components/quantifi/Cards";
import PlaybookModal from "@/components/quantifi/PlaybookModal";
import { playbooks, type Playbook } from "@/data/playbooks";

interface InboxQuestion {
  q: string;
  email?: string;
  name?: string;
  ts: number;
}

const TABS = [
  "Research Playbooks",
  "Market Maps",
  "Source Packs",
  "Bull vs Bear",
  "Stock Deep Dives",
] as const;
type Tab = (typeof TABS)[number];

function ComingSoon({ label }: { label: string }) {
  return (
    <GlassCard className="mt-6 p-10 text-center">
      <p className="text-sm text-slate-300">{label} are being curated.</p>
      <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-slate-500">
        Each surface is built from the same source-backed playbooks. New modules are added here as
        they&apos;re researched — not auto-generated, and never a recommendation.
      </p>
    </GlassCard>
  );
}

function PlaybookCard({ playbook, onOpen }: { playbook: Playbook; onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen} className="w-full text-left">
      <GlassCard hover className="flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-full border border-teal/30 bg-teal/10 px-2 py-0.5 text-[0.62rem] font-medium text-teal">
            {playbook.type}
          </span>
          <span className="rounded-full border border-gold/25 bg-gold/10 px-2 py-0.5 text-[0.6rem] text-gold/90">
            {playbook.status}
          </span>
        </div>

        <h3 className="mt-3 font-display text-lg font-semibold leading-snug text-white">{playbook.title}</h3>
        <p className="mt-1 text-sm text-slate-400">{playbook.subtitle}</p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {playbook.tags.map((t) => (
            <Tag key={t} tone="gold">
              {t}
            </Tag>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5 text-[0.65rem]">
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">⏱ {playbook.timeHorizon}</span>
          <span className="rounded-full border border-down/25 bg-down/10 px-2 py-0.5 text-down/90">Risk: {playbook.riskLens}</span>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-slate-300">Best for: {playbook.bestFor}</span>
        </div>

        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <div className="text-[0.6rem] uppercase tracking-[0.14em] text-slate-500">Linked Quantifi Ideas</div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {playbook.linkedIdeas.map((i) => (
              <span key={i.ideaId} className="rounded-md border border-white/10 bg-white/[0.03] px-1.5 py-0.5 text-[0.7rem] text-slate-300">
                {i.title}
              </span>
            ))}
          </div>
        </div>

        <div className="mt-auto pt-4 text-xs font-medium text-gold/80">Open playbook →</div>
      </GlassCard>
    </button>
  );
}

export default function Community() {
  const [tab, setTab] = useState<Tab>("Research Playbooks");
  const [active, setActive] = useState<Playbook | null>(null);

  const [sent, setSent] = useState(false);
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inbox, setInbox] = useState<InboxQuestion[] | null>(null);

  // Owners (PRO_EMAILS) get a 200 with the questions; everyone else gets 403.
  useEffect(() => {
    fetch("/api/community/ask")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { questions?: InboxQuestion[] } | null) => {
        if (d?.questions) setInbox(d.questions);
      })
      .catch(() => {});
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || submitting) return;
    setSubmitting(true);
    try {
      await fetch("/api/community/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q }),
      });
    } catch {
      /* even if storage fails, acknowledge to the user */
    } finally {
      setSubmitting(false);
      setSent(true);
    }
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <SectionHeading
        eyebrow="Community"
        title="Community Research"
        subtitle="Curated playbooks, market maps and source-backed analysis — built for study, not recommendations."
      />

      {/* Tabs */}
      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full border px-3 py-1.5 text-xs transition ${
              tab === t
                ? "border-gold/50 bg-gold/15 text-gold"
                : "border-white/10 bg-white/[0.03] text-slate-400 hover:text-white"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Research Playbooks */}
      {tab === "Research Playbooks" ? (
        <div className="mt-6">
          <Eyebrow>Featured research playbooks</Eyebrow>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {playbooks.map((p) => (
              <PlaybookCard key={p.id} playbook={p} onOpen={() => setActive(p)} />
            ))}
          </div>
        </div>
      ) : null}

      {tab === "Market Maps" ? <ComingSoon label="Market maps" /> : null}
      {tab === "Source Packs" ? <ComingSoon label="Source packs" /> : null}
      {tab === "Bull vs Bear" ? <ComingSoon label="Bull-vs-bear breakdowns" /> : null}
      {tab === "Stock Deep Dives" ? <ComingSoon label="Stock deep dives" /> : null}

      {/* Ask a research question — real submissions, no fake contributors */}
      <GlassCard className="mt-10 border-gold/20 bg-gold/[0.04] p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
          <div>
            <h3 className="font-display text-xl font-semibold text-white">Request a playbook or ask a research question</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Want a framework decoded, or a theme mapped to public markets? Tell us what you&apos;d
              like researched. Requests are queued and shape which playbooks we build next.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Educational research only — never personalised investment advice.
            </p>
          </div>
          <div>
            {sent ? (
              <div className="rounded-xl border border-up/30 bg-up/10 px-4 py-6 text-center text-sm text-up">
                Thanks — your request is in the queue. We&apos;ll surface new playbooks here as
                they&apos;re researched.
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. Decode how the energy-transition thesis maps to public markets."
                  className="min-h-[110px] w-full resize-y rounded-lg border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-white outline-none focus:border-gold/40"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-5 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
                >
                  {submitting ? "Posting…" : "Submit request"}
                </button>
              </form>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Owner-only inbox: submitted requests land here */}
      {inbox ? (
        <div className="mt-10">
          <Eyebrow>Request inbox · owner only</Eyebrow>
          <GlassCard className="mt-4 p-5 sm:p-6">
            {inbox.length === 0 ? (
              <p className="text-sm text-slate-500">No requests submitted yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {inbox.map((item, i) => (
                  <li key={i} className="py-3">
                    <p className="text-sm text-slate-200">{item.q}</p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      {item.name || item.email || "Anonymous"}
                      {item.email ? ` · ${item.email}` : ""} · {new Date(item.ts).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>
      ) : null}

      <p className="mt-6 text-center text-xs text-slate-600">
        Quantifi research is educational framework analysis — never a recommendation to buy, sell or
        hold, and not personalised advice.
      </p>

      {active ? <PlaybookModal playbook={active} onClose={() => setActive(null)} /> : null}
    </section>
  );
}
