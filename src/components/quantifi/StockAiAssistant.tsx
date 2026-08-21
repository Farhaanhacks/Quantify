"use client";

import { useEffect, useRef, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "What is the valuation saying?",
  "What are the biggest risks?",
  "Explain the balance-sheet score.",
  "What should I watch next?",
];

export default function StockAiAssistant({
  ticker,
  name,
  brief,
  open,
  onOpenChange,
  showLauncher = true,
}: {
  ticker: string;
  name?: string;
  brief?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  showLauncher?: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const label = name ?? ticker;

  useEffect(() => {
    setMessages([]);
    setInput("");
    setLoading(false);
  }, [ticker]);

  useEffect(() => {
    if (!brief) return;
    setMessages((current) =>
      current.length ? current : [{ role: "assistant", content: brief }]
    );
  }, [brief]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const ask = async (raw: string) => {
    const question = raw.trim();
    if (!question || loading) return;

    const history = messages.slice(-8);
    setInput("");
    setLoading(true);
    setMessages((current) => [
      ...current,
      { role: "user", content: question },
      { role: "assistant", content: "" },
    ]);

    try {
      const response = await fetch("/api/ai/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: ticker,
          mode: "chat",
          question,
          messages: history,
        }),
      });

      if (!response.ok || !response.body) {
        const error = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(error?.error || "Quantifi AI is temporarily unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setMessages((current) => {
          const next = [...current];
          next[next.length - 1] = { role: "assistant", content: answer };
          return next;
        });
      }

      if (!answer.trim()) throw new Error("Quantifi AI returned an empty response. Please try again.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Quantifi AI is temporarily unavailable.";
      setMessages((current) => {
        const next = [...current];
        next[next.length - 1] = { role: "assistant", content: message };
        return next;
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {showLauncher && !open ? (
        <button
          type="button"
          onClick={() => onOpenChange(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full border border-gold/35 bg-ink-800 px-4 py-3 text-sm font-semibold text-white shadow-2xl shadow-black/40 transition hover:-translate-y-0.5 hover:border-gold/60 hover:bg-ink-700"
          aria-label={`Ask Quantifi AI about ${label}`}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/15 text-gold" aria-hidden>
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3Z" strokeLinejoin="round" />
              <path d="m18.5 14 .8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" strokeLinejoin="round" />
            </svg>
          </span>
          Ask Quantifi AI
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label={`Quantifi AI for ${label}`}>
          <button
            type="button"
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={() => onOpenChange(false)}
            aria-label="Close Quantifi AI"
          />
          <aside className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col overflow-hidden rounded-t-2xl border border-white/10 bg-ink-900 shadow-2xl sm:inset-y-0 sm:left-auto sm:right-0 sm:h-full sm:max-h-none sm:w-[430px] sm:rounded-none sm:border-y-0 sm:border-r-0">
            <header className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[0.65rem] font-semibold uppercase tracking-[0.16em] text-gold">Quantifi AI</span>
                  <span className="rounded-full border border-up/20 bg-up/[0.07] px-1.5 py-px text-[0.55rem] uppercase tracking-wider text-up">Context on</span>
                </div>
                <h2 className="mt-1 truncate font-display text-lg font-semibold text-white">{label}</h2>
                <p className="font-mono text-xs text-slate-500">{ticker}</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-white/10 text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
                </svg>
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              {!messages.length ? (
                <div className="rounded-xl border border-gold/15 bg-gold/[0.05] p-4">
                  <p className="text-sm leading-relaxed text-slate-300">
                    I already know you are analysing <span className="font-medium text-white">{label}</span>. Ask about its valuation, risks, financial health or the figures shown on this page.
                  </p>
                </div>
              ) : null}

              <div className="space-y-3">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={
                      message.role === "user"
                        ? "ml-10 rounded-2xl rounded-br-md bg-gold/15 px-4 py-3 text-sm leading-relaxed text-white"
                        : "mr-6 rounded-2xl rounded-bl-md border border-white/[0.07] bg-white/[0.035] px-4 py-3 text-sm leading-relaxed text-slate-200"
                    }
                  >
                    {message.content ? (
                      <p className="whitespace-pre-wrap">{message.content}</p>
                    ) : (
                      <span className="inline-flex gap-1" aria-label="Quantifi AI is responding">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold [animation-delay:150ms]" />
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-gold [animation-delay:300ms]" />
                      </span>
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-5">
                <div className="text-[0.6rem] uppercase tracking-[0.14em] text-slate-600">Suggested questions</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => ask(suggestion)}
                      disabled={loading}
                      className="rounded-full border border-white/10 bg-white/[0.025] px-3 py-1.5 text-left text-xs text-slate-400 transition hover:border-gold/30 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
              <div ref={endRef} />
            </div>

            <form
              className="border-t border-white/[0.07] bg-ink-900 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void ask(input);
              }}
            >
              <div className="flex items-end gap-2 rounded-xl border border-white/10 bg-ink-800 p-2 focus-within:border-gold/35">
                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value.slice(0, 600))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void ask(input);
                    }
                  }}
                  rows={2}
                  placeholder={`Ask about ${label}…`}
                  className="max-h-28 min-h-[2.75rem] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-white outline-none placeholder:text-slate-600"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading}
                  className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-gold text-ink transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Send question"
                >
                  <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2">
                    <path d="m5 12 14-7-5 14-2.5-5.5L5 12Z" strokeLinejoin="round" />
                    <path d="m11.5 13.5 3.5-3.5" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <p className="mt-2 text-center text-[0.6rem] leading-relaxed text-slate-600">
                Grounded in this page&apos;s Quantifi snapshot. Educational research only.
              </p>
            </form>
          </aside>
        </div>
      ) : null}
    </>
  );
}
