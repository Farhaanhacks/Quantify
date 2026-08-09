"use client";

import { useEffect, useState } from "react";

// The sign-up prompt a signed-out visitor meets partway down a stock page.
//
// It deliberately arrives late. The page above it is real — the company, its
// price, the live chart — so by the time this appears the visitor has already
// seen the product do something for a name they chose. Asking before that is
// asking a stranger to take it on faith.
//
// The fade is slow on purpose (700ms): a panel that snaps over the page reads
// as an interruption, one that arrives gently reads as the next step.
export default function SignUpModal({
  label,
  open,
  onClose,
}: {
  /** What to call the listing — its company name where we have one, not its
      ticker. "0P0000OQWJ" is an identifier, not something to say to a reader. */
  label: string;
  open: boolean;
  onClose: () => void;
}) {
  // Mount first, paint the transparent state, then flip to visible on the next
  // frame — otherwise the browser has nothing to animate from.
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (!open) {
      setShown(false);
      return;
    }
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // The page behind must not scroll while this is up, or dismissing it
    // returns you somewhere you didn't choose.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  const rows: [string, string, boolean][] = [
    ["RELIANCE.NS", "21% undervalued", true],
    ["NVDA", "74% overvalued", false],
    ["TCS.NS", "11% undervalued", true],
  ];

  return (
    <div
      className={`fixed inset-0 z-[120] flex items-center justify-center p-4 transition-opacity duration-700 ease-out ${
        shown ? "opacity-100" : "opacity-0"
      }`}
      role="dialog"
      aria-modal="true"
      aria-label={`Create a free account to continue analysing ${label}`}
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 h-full w-full cursor-default bg-ink/80"
      />

      <div
        className={`relative grid w-full max-w-3xl overflow-hidden rounded-2xl border border-white/12 bg-ink-900 shadow-2xl transition-all duration-700 ease-out md:grid-cols-2 ${
          shown ? "translate-y-0 scale-100" : "translate-y-3 scale-[0.98]"
        }`}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
        >
          ✕
        </button>

        {/* Left: what they're being let into. */}
        <div className="hidden border-r border-white/[0.08] bg-white/[0.02] p-7 md:block">
          <h3 className="font-editorial text-[1.5rem] leading-tight text-white">
            Safeguard and grow your portfolio.
          </h3>
          <p className="mt-2.5 text-[0.82rem] leading-relaxed text-slate-400">
            Valuation, financial health and insider activity on every name you follow — in one
            place.
          </p>
          <div className="mt-5 rounded-lg border border-white/[0.08] bg-ink p-3">
            <div className="mb-2 flex items-center justify-between text-[0.58rem] uppercase tracking-[0.14em] text-slate-500">
              <span>Name</span>
              <span>Fair value</span>
            </div>
            {rows.map(([sym, verdict, under]) => (
              <div key={sym} className="flex items-center justify-between border-t border-white/[0.06] py-2">
                <span className="font-mono text-[0.72rem] text-slate-300">{sym}</span>
                <span className={`text-[0.72rem] ${under ? "text-up" : "text-down"}`}>{verdict}</span>
              </div>
            ))}
            <p className="mt-2 text-[0.6rem] leading-relaxed text-slate-600">
              Illustrative — your own figures are computed live.
            </p>
          </div>
        </div>

        {/* Right: the ask. */}
        <div className="p-7 text-center sm:p-9">
          <p className="text-[0.62rem] uppercase tracking-[0.2em] text-gold/80">Quantifi</p>
          <h2 className="mt-3 font-display text-xl font-semibold leading-snug text-white sm:text-2xl">
            Sign up free and keep analysing{" "}
            <span className="text-gold">{label}</span>
          </h2>
          <p className="mt-2.5 text-[0.82rem] leading-relaxed text-slate-400">
            The score, the fundamentals, the debt and the insider trades are on the other side.
          </p>

          <a
            href="/api/auth/login"
            className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-ink-900 transition hover:bg-white/90"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.28 1.48-1.13 2.73-2.4 3.58v2.98h3.89c2.27-2.09 3.53-5.17 3.53-8.8z" />
              <path fill="#34A853" d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.89-2.98c-1.08.72-2.46 1.15-4.04 1.15-3.11 0-5.74-2.1-6.68-4.92H1.3v3.07C3.26 21.3 7.31 24 12 24z" />
              <path fill="#FBBC05" d="M5.32 14.34a7.19 7.19 0 0 1 0-4.68V6.59H1.3a11.99 11.99 0 0 0 0 10.82l4.02-3.07z" />
              <path fill="#EA4335" d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.3 6.59l4.02 3.07C6.26 6.85 8.89 4.75 12 4.75z" />
            </svg>
            Continue with Google
          </a>

          <p className="mt-4 text-[0.78rem] text-slate-500">
            Already have an account?{" "}
            <a href="/api/auth/login" className="font-medium text-gold hover:text-gold-400">
              Sign in
            </a>
          </p>

          <p className="mt-5 text-[0.68rem] leading-relaxed text-slate-600">
            By continuing you agree to Quantifi&apos;s{" "}
            <a href="/terms" className="underline underline-offset-2 hover:text-slate-400">Terms</a>{" "}
            and{" "}
            <a href="/privacy" className="underline underline-offset-2 hover:text-slate-400">
              Privacy Policy
            </a>
            . Research and education only — not investment advice.
          </p>
        </div>
      </div>
    </div>
  );
}
