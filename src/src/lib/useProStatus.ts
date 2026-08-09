"use client";

import { useEffect, useState } from "react";

interface SessionInfo {
  ready: boolean;
  pro: boolean;
  user: { name?: string; email?: string; picture?: string } | null;
}

// Small client hook around /api/auth/session that also exposes whether the
// signed-in user is a Quantifi Pro subscriber. Used to pick the gold (paid) vs
// white (free) logo and anywhere the client needs to know plan status.
export function useProStatus(): SessionInfo {
  const [state, setState] = useState<SessionInfo>({ ready: false, pro: false, user: null });

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((d: { user?: SessionInfo["user"]; pro?: boolean }) => {
        if (!cancelled) setState({ ready: true, pro: Boolean(d.pro), user: d.user ?? null });
      })
      .catch(() => {
        if (!cancelled) setState((s) => ({ ...s, ready: true }));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
