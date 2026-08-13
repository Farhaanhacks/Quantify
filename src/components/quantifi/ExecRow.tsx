"use client";

import { useState } from "react";
import type { Officer } from "@/lib/officers";
import type { ExecProfile } from "@/lib/execProfile";

// One executive: always the filed facts, and on request whatever verified
// background exists for them.
//
// The profile is fetched only when a row is opened. Most executives of most
// listed companies have no published biography, so eagerly fetching twelve of
// them per page would spend a dozen upstream calls to render eleven "nothing
// found" states.

interface Payload {
  found: boolean;
  profile?: ExecProfile;
  extract?: string;
  source?: string;
  reason?: "no-candidate" | "unverified" | "too-thin" | "upstream-error";
}

/** Said in the reader's terms, not the API's. */
const REASON_TEXT: Record<NonNullable<Payload["reason"]>, string> = {
  "no-candidate": "No published biography found for this person.",
  unverified:
    "A person of this name exists in public records, but nothing confirms they are this company's officer — so no profile is shown rather than risk the wrong one.",
  "too-thin": "The only public record found carries no background worth showing.",
  "upstream-error": "Couldn't reach the biography sources just now.",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mt-3">
      <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-1 text-sm text-slate-300">{children}</div>
    </div>
  );
}

export default function ExecRow({
  officer,
  company,
  symbol,
  fmtPay,
}: {
  officer: Officer;
  company: string;
  /** The listing's ticker — an exact handle on the company where its filed name is an abbreviation. */
  symbol?: string;
  fmtPay: (n: number) => string;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<Payload | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (!next || data || loading) return;
    setLoading(true);
    try {
      const r = await fetch(
        `/api/exec-profile?name=${encodeURIComponent(officer.name)}&company=${encodeURIComponent(
          company
        )}${symbol ? `&symbol=${encodeURIComponent(symbol)}` : ""}`
      );
      setData((await r.json()) as Payload);
    } catch {
      setData({ found: false, reason: "upstream-error" });
    } finally {
      setLoading(false);
    }
  };

  const p = data?.profile;

  return (
    <li>
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="grid w-full grid-cols-1 gap-1 px-5 py-3.5 text-left transition hover:bg-white/[0.03] sm:grid-cols-[1.3fr_1.6fr_0.5fr_0.8fr_auto] sm:items-center sm:gap-3"
      >
        <span className="font-display text-sm font-semibold text-white">{officer.name}</span>
        <span className="text-xs text-slate-400">{officer.title}</span>
        <span className="text-xs text-slate-400 sm:text-right">
          <span className="text-slate-600 sm:hidden">Age · </span>
          {officer.age != null ? officer.age : "—"}
        </span>
        <span className="font-mono text-xs tnum text-slate-300 sm:text-right">
          <span className="font-sans text-slate-600 sm:hidden">Pay · </span>
          {officer.totalPay != null ? fmtPay(officer.totalPay) : "—"}
          {officer.totalPay != null && officer.fiscalYear ? (
            <span className="ml-1 font-sans text-[0.65rem] text-slate-600">FY{officer.fiscalYear}</span>
          ) : null}
        </span>
        <span className="hidden justify-end text-slate-500 sm:flex">
          <svg
            viewBox="0 0 24 24"
            className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      {open ? (
        <div className="border-t border-white/[0.05] bg-white/[0.015] px-5 py-4">
          {loading ? (
            <p className="text-sm text-slate-500">Looking for a published profile…</p>
          ) : !data?.found ? (
            <p className="text-sm leading-relaxed text-slate-500">
              {REASON_TEXT[data?.reason ?? "no-candidate"]}
            </p>
          ) : (
            <div className="flex flex-col gap-4 sm:flex-row">
              {p?.image ? (
                <span className="h-28 w-24 flex-none overflow-hidden rounded-lg border border-white/10 bg-white/[0.04]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- relayed
                      through /api/portrait so the CSP stays closed; next/image
                      would add a second optimiser hop for a 160px photo. */}
                  <img
                    src={`/api/portrait?file=${encodeURIComponent(p.image)}&w=192`}
                    alt={`Portrait of ${p.name}`}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </span>
              ) : null}

              <div className="min-w-0 flex-1">
                {p?.description ? (
                  <p className="text-sm font-medium text-white">{p.description}</p>
                ) : null}

                {p?.education?.length ? (
                  <Field label="Education">
                    {p.education.join(" · ")}
                    {p.degrees.length ? (
                      <span className="text-slate-500"> — {p.degrees.join(", ")}</span>
                    ) : null}
                  </Field>
                ) : null}

                {!p?.education?.length && p?.degrees?.length ? (
                  <Field label="Qualification">{p.degrees.join(", ")}</Field>
                ) : null}

                {data.extract ? <Field label="Background">{data.extract}</Field> : null}

                {p?.birthYear ? (
                  <p className="mt-3 text-[0.72rem] text-slate-500">Born {p.birthYear}</p>
                ) : null}

                {/* Where this came from and why we believe it is the right
                    person. Both are the reader's business: the first is
                    required by the licence, the second is the difference
                    between a profile and a guess. */}
                <p className="mt-3 border-t border-white/[0.06] pt-2 text-[0.68rem] leading-relaxed text-slate-500">
                  From Wikidata
                  {data.source ? (
                    <>
                      {" and "}
                      <a
                        href={data.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-400 underline decoration-white/20 underline-offset-2 hover:text-white"
                      >
                        Wikipedia
                      </a>
                      , CC BY-SA
                    </>
                  ) : null}
                  {p?.matchedOn === "company-names-them"
                    ? " · matched because this company's own record names them"
                    : p?.matchedOn === "summary-mentions-company"
                      ? " · matched because the article names this company"
                      : " · matched on a recorded link to this company"}
                  . Not filed by the company; treat as background, not disclosure.
                </p>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </li>
  );
}
