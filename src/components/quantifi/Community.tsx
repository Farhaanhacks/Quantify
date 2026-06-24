"use client";

import { useEffect, useState } from "react";
import { GlassCard, SectionHeading, Tag, Eyebrow } from "@/components/quantifi/Cards";

interface InboxQuestion {
  q: string;
  email?: string;
  name?: string;
  ts: number;
}

interface Contributor {
  name: string;
  role: string;
  focus: string;
  initials: string;
}

interface Post {
  author: string;
  role: string;
  title: string;
  body: string;
  tags: string[];
  when: string;
}

const CONTRIBUTORS: Contributor[] = [
  { name: "Aarav Mehta, CFA", role: "Ex-buy-side equity analyst", focus: "Valuation & DCF", initials: "AM" },
  { name: "Dr. Lena Park", role: "Quant researcher", focus: "Factor investing & risk", initials: "LP" },
  { name: "Marcus Hale", role: "20yr portfolio manager", focus: "Asset allocation", initials: "MH" },
  { name: "Priya Nair", role: "Equity strategist", focus: "Indian markets", initials: "PN" },
];

const POSTS: Post[] = [
  {
    author: "Aarav Mehta, CFA",
    role: "Ex-buy-side analyst",
    title: "How to read a discounted-cash-flow estimate without fooling yourself",
    body: "A DCF is only as good as its assumptions. Treat the cash-flow value on a stock page as one lens, not a verdict — stress-test the growth rate and discount rate, and compare it against the analyst target before drawing any conclusion.",
    tags: ["Valuation", "DCF", "Beginners"],
    when: "2d ago",
  },
  {
    author: "Marcus Hale",
    role: "Portfolio manager",
    title: "Position sizing beats stock picking more often than people admit",
    body: "Most retail damage comes from concentration, not bad names. A simple rule: no single position should be able to take more than ~5% off your whole portfolio in a bad week. Use the watchlist and portfolio tools to check your real exposure.",
    tags: ["Risk", "Portfolio"],
    when: "5d ago",
  },
  {
    author: "Priya Nair",
    role: "Equity strategist",
    title: "Reading Indian large-caps vs US mega-caps",
    body: "Valuation multiples don't travel one-to-one across markets — growth expectations, rates and currency all shift the goalposts. When you screen NSE names, anchor to local peers, not to a US comparable.",
    tags: ["India", "Screening"],
    when: "1w ago",
  },
  {
    author: "Dr. Lena Park",
    role: "Quant researcher",
    title: "What the five-axis score is — and isn't — telling you",
    body: "The Quantifi Score is a checklist summary, not a prediction. A high score reflects quality and value today; it says nothing about timing. Pair it with the news and insider sections before you form a thesis.",
    tags: ["Education", "Method"],
    when: "1w ago",
  },
];

export default function Community() {
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
        title="Learn from people who do this for a living"
        subtitle="Guidance from verified industry professionals — analysts, portfolio managers and quants — to help you read the data on Quantifi with more context. Educational only; never personalised investment advice."
      />

      {/* Contributors */}
      <div className="mt-8">
        <Eyebrow>Verified contributors</Eyebrow>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CONTRIBUTORS.map((c) => (
            <GlassCard key={c.name} className="flex items-center gap-3 p-4">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full border border-gold/30 bg-gold/10 font-display text-sm font-semibold text-gold">
                {c.initials}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-white">{c.name}</div>
                <div className="truncate text-xs text-slate-500">{c.role}</div>
                <div className="mt-0.5 text-[0.7rem] text-teal">{c.focus}</div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Latest guidance */}
      <div className="mt-10">
        <Eyebrow>Latest guidance</Eyebrow>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {POSTS.map((p) => (
            <GlassCard key={p.title} className="flex flex-col p-5 sm:p-6">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-teal">{p.author}</span>
                <span className="text-[0.7rem] text-slate-500">{p.when}</span>
              </div>
              <div className="text-[0.7rem] text-slate-500">{p.role}</div>
              <h3 className="mt-2 font-display text-base font-semibold leading-snug text-white">
                {p.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-300">{p.body}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {p.tags.map((t) => (
                  <Tag key={t} tone="gold">
                    {t}
                  </Tag>
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* Ask the community */}
      <GlassCard className="mt-10 border-gold/20 bg-gold/[0.04] p-6 sm:p-8">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
          <div>
            <h3 className="font-display text-xl font-semibold text-white">Ask the community</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Stuck on how to read a metric or weigh up a name? Post a question and a verified
              contributor can pick it up. We&apos;re onboarding contributors now — submissions are
              queued and answered as the program rolls out.
            </p>
            <p className="mt-3 text-xs text-slate-500">
              Are you an analyst, PM or quant who wants to contribute?{" "}
              <a href="mailto:hello@quantifiapp.com" className="text-gold hover:underline">
                Apply to join →
              </a>
            </p>
          </div>
          <div>
            {sent ? (
              <div className="rounded-xl border border-up/30 bg-up/10 px-4 py-6 text-center text-sm text-up">
                Thanks — your question is in the queue. We&apos;ll surface answers here as
                contributors come online.
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <textarea
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  placeholder="e.g. How should I weigh a high P/E against strong cash-flow value?"
                  className="min-h-[110px] w-full resize-y rounded-lg border border-white/10 bg-ink-800 px-3 py-2.5 text-sm text-white outline-none focus:border-gold/40"
                />
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full rounded-lg bg-gradient-to-r from-gold-400 to-gold-600 px-5 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90 disabled:opacity-60"
                >
                  {submitting ? "Posting…" : "Post question"}
                </button>
              </form>
            )}
          </div>
        </div>
      </GlassCard>

      {/* Owner-only inbox: submitted questions land here */}
      {inbox ? (
        <div className="mt-10">
          <Eyebrow>Question inbox · owner only</Eyebrow>
          <GlassCard className="mt-4 p-5 sm:p-6">
            {inbox.length === 0 ? (
              <p className="text-sm text-slate-500">No questions submitted yet.</p>
            ) : (
              <ul className="divide-y divide-white/[0.06]">
                {inbox.map((item, i) => (
                  <li key={i} className="py-3">
                    <p className="text-sm text-slate-200">{item.q}</p>
                    <p className="mt-1 text-[0.7rem] text-slate-500">
                      {item.name || item.email || "Anonymous"}
                      {item.email ? ` · ${item.email}` : ""} ·{" "}
                      {new Date(item.ts).toLocaleString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </GlassCard>
        </div>
      ) : null}

      <p className="mt-6 text-center text-xs text-slate-600">
        Community guidance is educational and reflects contributors&apos; own views — not advice from
        Quantifi, and never a recommendation to buy, sell or hold.
      </p>
    </section>
  );
}
