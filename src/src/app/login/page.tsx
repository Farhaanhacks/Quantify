import type { Metadata } from "next";
import BrandLogo from "@/components/quantifi/BrandLogo";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to Quantifi to save your portfolio, watchlist and research.",
  robots: { index: false, follow: false },
};

// Google is the only sign-in method this app actually implements (see
// src/lib/auth.ts / src/app/api/auth/login). No password, passkey or other
// provider exists server-side, so this page doesn't show buttons for them —
// a control that doesn't do anything is worse than not having it.
export default function LoginPage() {
  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-16 sm:py-24">
      <div className="w-full max-w-md">
        <div className="glass relative overflow-hidden rounded-3xl border border-white/10 p-8 shadow-panel sm:p-10">
          {/* Soft gold glow, echoing the hero treatment used elsewhere on the site. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-gold/20 blur-3xl"
          />

          <div className="relative flex flex-col items-center text-center">
            <BrandLogo className="h-10" forcePro />

            <h1 className="mt-6 font-display text-2xl font-bold leading-tight tracking-tight text-white sm:text-[1.7rem]">
              Continue to Quantifi
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Sign in to save your portfolio, watchlist and research across devices.
            </p>

            <a
              href="/api/auth/login"
              className="mt-8 flex w-full items-center justify-center gap-3 rounded-full border border-white/15 bg-white px-5 py-3 text-sm font-semibold text-ink-900 transition hover:bg-white/90"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.28 1.48-1.13 2.73-2.4 3.58v2.98h3.89c2.27-2.09 3.53-5.17 3.53-8.8z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.89-2.98c-1.08.72-2.46 1.15-4.04 1.15-3.11 0-5.74-2.1-6.68-4.92H1.3v3.07C3.26 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.32 14.34a7.19 7.19 0 0 1 0-4.68V6.59H1.3a11.99 11.99 0 0 0 0 10.82l4.02-3.07z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.3 6.59l4.02 3.07C6.26 6.85 8.89 4.75 12 4.75z"
                />
              </svg>
              Continue with Google
            </a>

            <p className="mt-6 text-xs leading-relaxed text-slate-500">
              By continuing you agree to Quantifi&rsquo;s{" "}
              <a href="/terms" className="text-slate-300 underline underline-offset-2 hover:text-gold">
                Terms
              </a>{" "}
              and{" "}
              <a href="/privacy" className="text-slate-300 underline underline-offset-2 hover:text-gold">
                Privacy Policy
              </a>
              .
            </p>
          </div>
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          New here?{" "}
          <a href="/" className="font-medium text-gold hover:text-gold-400">
            Explore Quantifi
          </a>
        </p>
      </div>
    </div>
  );
}
