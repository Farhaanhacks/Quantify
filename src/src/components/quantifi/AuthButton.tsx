"use client";

import { useEffect, useRef, useState } from "react";

interface SessionUser {
  name?: string;
  email?: string;
  picture?: string;
}

export default function AuthButton() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d: { user?: SessionUser | null }) => {
        if (!cancelled) {
          setUser(d.user ?? null);
          setReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  if (!ready) return null;

  if (!user) {
    return (
      <a
        href="/api/auth/login"
        className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-white/15 bg-white/[0.04] px-3 py-2 text-sm text-slate-200 transition hover:bg-white/[0.08]"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 12v3.5h4.9c-.2 1.2-1.6 3.6-4.9 3.6A5.1 5.1 0 1 1 12 6.9c1.6 0 2.7.7 3.3 1.3l2.3-2.2C16.1 4.6 14.3 4 12 4a8 8 0 1 0 0 16c4.6 0 7.7-3.2 7.7-7.8 0-.5 0-.9-.1-1.2H12z"
            fill="currentColor"
          />
        </svg>
        <span>Sign in</span>
      </a>
    );
  }

  const label = user.name || user.email || "Account";
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] px-2 py-1.5 text-sm text-slate-200 transition hover:bg-white/[0.08]"
      >
        {user.picture ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.picture} alt="" className="h-6 w-6 rounded-full" referrerPolicy="no-referrer" />
        ) : (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gold/20 text-xs text-gold">
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span className="hidden max-w-[7rem] truncate sm:inline">{label}</span>
      </button>
      {open ? (
        <div className="absolute right-0 mt-2 w-48 rounded-xl border border-white/10 bg-ink-900 p-1 shadow-xl">
          <div className="truncate px-3 py-2 text-xs text-slate-500">{user.email || label}</div>
          <a
            href="/api/auth/logout"
            className="block rounded-lg px-3 py-2 text-sm text-slate-200 hover:bg-white/[0.06]"
          >
            Sign out
          </a>
        </div>
      ) : null}
    </div>
  );
}
