"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Keeps a JSON value in sync with the signed-in user's account (via /api/store)
// when logged in, and with browser localStorage otherwise. This is what makes
// data follow the email across devices instead of being stuck on one device.

type Updater<T> = T | ((prev: T) => T);

export function useSyncedState<T>(key: string, initial: T) {
  const [value, setValueState] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const [scope, setScope] = useState<"account" | "device">("device");
  const authedRef = useRef(false);
  const LS = `quantifi.${key}.v1`;

  useEffect(() => {
    let cancelled = false;

    let local: T | null = null;
    try {
      const raw = localStorage.getItem(LS);
      if (raw) local = JSON.parse(raw) as T;
    } catch {
      /* ignore */
    }

    (async () => {
      try {
        const r = await fetch(`/api/store/${key}`);
        const d = (await r.json()) as { ok?: boolean; authed?: boolean; data?: T | null };
        if (cancelled) return;
        if (d.ok && d.authed) {
          authedRef.current = true;
          setScope("account");
          if (d.data != null) {
            setValueState(d.data);
          } else if (local != null) {
            // First time on this account — migrate whatever is on the device up.
            setValueState(local);
            fetch(`/api/store/${key}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ data: local }),
            }).catch(() => {});
          } else {
            setValueState(initial);
          }
        } else {
          authedRef.current = false;
          setScope("device");
          setValueState(local != null ? local : initial);
        }
      } catch {
        if (!cancelled) {
          authedRef.current = false;
          setValueState(local != null ? local : initial);
        }
      }
      if (!cancelled) setReady(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setValue = useCallback(
    (updater: Updater<T>) => {
      setValueState((prev) => {
        const next =
          typeof updater === "function" ? (updater as (p: T) => T)(prev) : updater;
        try {
          localStorage.setItem(LS, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        if (authedRef.current) {
          fetch(`/api/store/${key}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ data: next }),
          }).catch(() => {});
        }
        return next;
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [key]
  );

  return { value, setValue, ready, scope };
}
