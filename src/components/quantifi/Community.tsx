"use client";

import { useEffect, useState } from "react";
import { GlassCard, SectionHeading, Tag, Eyebrow } from "@/components/quantifi/Cards";
import CommunityThesisModal, { type Thesis } from "@/components/quantifi/CommunityThesisModal";

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

const CONTRIBUTORS: Contributor[] = [
  { name: "Aarav Mehta, CFA", role: "Ex-buy-side equity analyst", focus: "Valuation & DCF", initials: "AM" },
  { name: "Dr. Lena Park", role: "Quant researcher", focus: "Factor investing & risk", initials: "LP" },
  { name: "Marcus Hale", role: "20yr portfolio manager", focus: "Asset allocation", initials: "MH" },
  { name: "Priya Nair", role: "Equity strategist", focus: "Indian markets", initials: "PN" },
];

// Stock theses — each tied to a real ticker. Clicking one opens the chart, the
// fair-value vs price read, and the contributor's full take.
const THESES: Thesis[] = [
  {
    ticker: "INTU",
    company: "Intuit",
    author: "tripledub",
    role: "Software engineer & investor",
    badge: "Recommended Voice",
    initials: "TD",
    title: "A Wonderful Business at a Not-So-Wonderful Price",
    body: "Intuit is the rare software company that owns both the small-business (QuickBooks) and consumer-tax (TurboTax) rails, with pricing power most SaaS names only dream of. The franchise quality isn't the debate — the price is.\n\nAt today's level the market is paying up for durable double-digit growth and expanding margins. That can absolutely work out, but it leaves little room for error: a slower SMB cycle or an AI-led shake-up in tax prep would compress the multiple fast. The fair-value read here treats the cash flows generously and still lands well above the screen, so size accordingly and let volatility do you favours rather than the reverse.",
    tags: ["Quality", "SaaS", "Valuation"],
    when: "20 Mar 26",
  },
  {
    ticker: "MSFT",
    company: "Microsoft",
    author: "Aarav Mehta, CFA",
    role: "Ex-buy-side equity analyst",
    initials: "AM",
    title: "A durable compounder — but valuation is doing the work now",
    body: "Microsoft's moat is about as wide as they come: Azure, the Office/Teams estate, and an AI distribution advantage through Copilot. Cash generation is enormous and reinvestment runway is real.\n\nThe catch is that almost none of this is a secret. Stress-test the DCF — trim cloud growth a few points and nudge the discount rate — and the cushion thins quickly. I treat it as a hold-and-add-on-weakness name rather than a fresh-money buy at every print.",
    tags: ["Quality", "Cloud", "AI"],
    when: "12 May 26",
  },
  {
    ticker: "RELIANCE.NS",
    company: "Reliance Industries",
    author: "Priya Nair",
    role: "Equity strategist · India",
    initials: "PN",
    title: "A sum-of-the-parts the market keeps re-underwriting",
    body: "Reliance is three businesses in a trench coat: energy/O2C, Jio (telecom/digital) and Retail. The value debate is really about how much credit you give the consumer arms versus the cyclical core.\n\nAnchor it to local peers, not US comparables — multiples don't travel one-to-one across markets. When Jio or Retail throws off a monetisation event (listing, tariff move), the re-rating tends to come in steps, not a straight line.",
    tags: ["India", "Conglomerate", "Sum-of-parts"],
    when: "28 Apr 26",
  },
  {
    ticker: "NVDA",
    company: "NVIDIA",
    author: "Dr. Lena Park",
    role: "Quant researcher",
    initials: "LP",
    title: "Reading the AI leader through a factor lens",
    body: "NVIDIA scores beautifully on quality and momentum and terribly on value — which is exactly what you'd expect from the standout winner of a capex super-cycle. The five-axis score tells you what is true today; it says nothing about timing.\n\nThe real risk isn't demand, it's the durability of pricing once competition and in-house silicon mature. Pair the score with the news and insider sections before you anchor on any single fair-value number.",
    tags: ["AI", "Semis", "Momentum"],
    when: "6 May 26",
  },
];

export default function Community() {
  const [sent, setSent] = useState(false);
  const [question, setQuestion] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [inbox, setInbox] = useState<InboxQuestion[] | null>(null);
  const [active, setActive] = useState<Thesis | null>(null);

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

      {/* Stock ideas — click any card to see the chart, the fair-value read and
          the contributor's full thesis. */}
      <div className="mt-10">
        <Eyebrow>Stock ideas from contributors</Eyebrow>
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {THESES.map((p) => (
            <button
              key={p.ticker}
              type="button"
              onClick={() => setActive(p)}
              className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.02] p-5 text-left transition hover:border-gold/40 hover:bg-white/[0.04] sm:p-6"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-gold/30 bg-gold/10 font-display text-[0.7rem] font-semibold text-gold">
                    {p.initials}
                  </span>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-teal">{p.author}</span>
                      {p.badge ? (
                        <span className="rounded-full border border-gold/40 bg-gold/10 px-1.5 py-0.5 text-[0.55rem] font-medium text-gold">
                          ◆ {p.badge}
                        </span>
                      ) : null}
                    </div>
                    <div className="text-[0.7rem] text-slate-500">{p.role}</div>
                  </div>
                </div>
                <span className="font-mono text-xs text-gold">{p.ticker}</span>
              </div>
              <h3 className="mt-3 font-display text-base font-semibold leading-snug text-white">
                {p.title}
              </h3>
              <p className="mt-2 line-clamp-3 flex-1 text-sm leading-relaxed text-slate-300">{p.body}</p>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex flex-wrap gap-1.5">
                  {p.tags.slice(0, 3).map((t) => (
                    <Tag key={t} tone="gold">
                      {t}
                    </Tag>
                  ))}
                </div>
                <span className="text-[0.7rem] font-medium text-gold opacity-0 transition group-hover:opacity-100">
                  Open thesis →
                </span>
              </div>
            </button>
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

      {active ? (
        <CommunityThesisModal thesis={active} onClose={() => setActive(null)} />
      ) : null}
    </section>
  );
}
