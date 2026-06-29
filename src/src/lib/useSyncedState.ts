"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Keeps a JSON value in sync with the signed-in user's account (via /api/store)
// when logged in, and with browser localStorage otherwise — so data follows the
// email across devices.
//
// Conflict handling: every value is stored inside an envelope { v, t } where t
// is the time it was last changed (ms). On load we compare the device copy and
// the account copy and keep whichever changed most recently (last-write-wins).
// A device that still holds data will push it back up rather than be overwritten
// by an empty account, which fixes the "one browser wiped the other" problem.

type Updater<T> = T | ((prev: T) => T);

interface Envelope<T> {
  v: T;
  t: number;
}

function isEnvelope<T>(x: unknown): x is Envelope<T> {
  return (
    typeof x === "object" &&
    x !== null &&
    "v" in x &&
    typeof (x as { t?: unknown }).t === "number"
  );
}

export function useSyncedState<T>(key: string, initial: T) {
  const [value, setValueState] = useState<T>(initial);
  const [ready, setReady] = useState(false);
  const [scope, setScope] = useState<"account" | "device">("device");
  const authedRef = useRef(false);
  const tRef = useRef(0);
  const LS = `quantifi.${key}.v1`;

  const writeLocal = useCallback(
    (env: Envelope<T>) => {
      try {
        localStorage.setItem(LS, JSON.stringify(env));
      } catch {
        /* ignore */
      }
    },
    [LS]
  );

  const putServer = useCallback(
    (env: Envelope<T>) => {
      fetch(`/api/store/${key}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: env }),
      }).catch(() => {});
    },
    [key]
  );

  useEffect(() => {
    let cancelled = false;

    // device copy (supports legacy raw values stored before envelopes existed)
    let local: Envelope<T> | null = null;
    try {
      const raw = localStorage.getItem(LS);
      if (raw) {
        const parsed = JSON.parse(raw);
        local = isEnvelope<T>(parsed) ? parsed : { v: parsed as T, t: 0 };
      }
    } catch {
      local = null;
    }

    (async () => {
      let server: Envelope<T> | null = null;
      let authed = false;
      try {
        const r = await fetch(`/api/store/${key}`);
        const d = (await r.json()) as { ok?: boolean; authed?: boolean; data?: unknown };
        if (d?.ok && d?.authed) {
          authed = true;
          if (d.data != null) {
            server = isEnvelope<T>(d.data) ? (d.data as Envelope<T>) : { v: d.data as T, t: 0 };
          }
        }
      } catch {
        /* offline — fall back to local */
      }
      if (cancelled) return;

      authedRef.current = authed;
      setScope(authed ? "account" : "device");

      const localT = local ? local.t : -1;
      const serverT = server ? server.t : -1;

      let chosen: Envelope<T> | null = null;
      let source: "local" | "server" | "none" = "none";
      if (serverT > localT) {
        chosen = server;
        source = "server";
      } else if (localT > serverT) {
        chosen = local;
        source = "local";
      } else if (local) {
        // tie (including both legacy t=0) — trust this device's own copy
        chosen = local;
        source = "local";
      } else if (server) {
        chosen = server;
        source = "server";
      }

      if (chosen) {
        setValueState(chosen.v);
        tRef.current = chosen.t;
        if (source === "server") {
          writeLocal(chosen);
        } else if (source === "local" && authed) {
          // server is stale/empty/missing — restore from this device
          const stamped: Envelope<T> = { v: chosen.v, t: chosen.t || Date.now() };
          tRef.current = stamped.t;
          if (!chosen.t) writeLocal(stamped);
          putServer(stamped);
        }
      } else {
        setValueState(initial);
        tRef.current = 0;
      }
      setReady(true);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const setValue = useCallback(
    (updater: Updater<T>) => {
      setValueState((prev) => {
        const resolved =
          typeof updater === "function" ? (updater as (p: T) => T)(prev) : (updater as T);
        const t = Date.now();
        tRef.current = t;
        const env: Envelope<T> = { v: resolved, t };
        writeLocal(env);
        if (authedRef.current) putServer(env);
        return resolved;
      });
    },
    [writeLocal, putServer]
  );

  return { value, setValue, ready, scope };
}
