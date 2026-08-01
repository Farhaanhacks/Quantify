"use client";

import { useEffect, useState } from "react";
import { CATEGORY_COLOR, type CompanyEvent } from "@/lib/companyEvents";

// Detail for every event filed on one date, opened by clicking a marker on the
// price chart. For an 8-K we pull the filing's own text from EDGAR so the reason
// for the marker is readable in place; dividends and splits have no document, so
// they show their figures and nothing more.
export default function EventDetailModal({
  date,
  events,
  onClose,
}: {
  date: string;
  events: CompanyEvent[];
  onClose: () => void;
}) {
  // Lock background scroll + close on Escape while open — same as the other
  // modals on the site.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const heading = new Date(`${date}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Company events on ${heading}`}
      className="fixed inset-0 z-[120] flex items-start justify-center overflow-y-auto p-3 sm:p-6"
    >
      <button aria-label="Close" onClick={onClose} className="fixed inset-0 bg-ink/80 backdrop-blur-sm" />

      <div className="relative my-4 w-full max-w-2xl overflow-hidden rounded-lg border border-white/10 bg-ink-900 shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4 sm:px-6">
          <h2 className="font-display text-base font-semibold text-white">
            {events.length} {events.length === 1 ? "event" : "events"} · {heading}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-md px-2 py-0.5 text-lg leading-none text-slate-500 transition hover:bg-white/[0.06] hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="max-h-[70vh] overflow-y-auto px-5 py-4 sm:px-6">
          {events.map((e, i) => (
            <EventBlock key={`${e.date}-${e.label}-${i}`} event={e} first={i === 0} />
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-white/[0.06] px-5 py-3 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300 transition hover:border-white/30 hover:text-white"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function EventBlock({ event, first }: { event: CompanyEvent; first: boolean }) {
  const [text, setText] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "empty">("idle");
  const [copied, setCopied] = useState(false);

  // Only 8-K events carry a filing URL; fetch its text once the modal opens.
  useEffect(() => {
    if (!event.url) return;
    let cancelled = false;
    setState("loading");
    (async () => {
      try {
        const r = await fetch(`/api/filing?url=${encodeURIComponent(event.url as string)}`);
        const d = await r.json();
        if (cancelled) return;
        const body = typeof d?.text === "string" ? d.text.trim() : "";
        // Short bodies are cover pages that just point at an exhibit — not worth
        // showing as if they were the announcement.
        if (d?.ok && body.length > 200) {
          setText(body);
          setState("idle");
        } else {
          setState("empty");
        }
      } catch {
        if (!cancelled) setState("empty");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [event.url]);

  const copyLink = async () => {
    if (!event.url) return;
    try {
      await navigator.clipboard.writeText(event.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked — the link is visible anyway */
    }
  };

  return (
    <section className={first ? "" : "mt-6 border-t border-white/[0.06] pt-6"}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="h-2.5 w-2.5 flex-none rounded-full"
          style={{ backgroundColor: CATEGORY_COLOR[event.category] }}
        />
        <h3 className="font-display text-lg font-semibold leading-snug text-white">{event.label}</h3>
        {event.item ? (
          <span className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 font-mono text-[0.62rem] text-slate-400">
            8-K Item {event.item}
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-sm leading-relaxed text-slate-400">{event.detail}</p>

      {event.url ? (
        <>
          {state === "loading" ? (
            <p className="mt-4 text-xs text-slate-500">Loading the filing from SEC EDGAR…</p>
          ) : null}

          {text ? (
            <div className="mt-4 max-h-72 overflow-y-auto rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="whitespace-pre-wrap text-[0.82rem] leading-relaxed text-slate-300">{text}</p>
            </div>
          ) : null}

          {state === "empty" ? (
            <p className="mt-4 text-xs leading-relaxed text-slate-500">
              This filing&apos;s text couldn&apos;t be read inline — the announcement itself is often
              an exhibit attached to the 8-K. Open it on SEC.gov to read the full document.
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <a
              href={event.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-gold/40 hover:text-white"
            >
              View on SEC.gov
              <span aria-hidden>↗</span>
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-300 transition hover:border-gold/40 hover:text-white"
            >
              {copied ? "Copied" : "Copy link"}
            </button>
          </div>
        </>
      ) : (
        <p className="mt-3 text-xs text-slate-500">
          Reported as a corporate action on the price feed — there is no filing document for it.
        </p>
      )}
    </section>
  );
}
