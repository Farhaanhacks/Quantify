"use client";

import { useCallback } from "react";
import { useSyncedState } from "@/lib/useSyncedState";

export type AlertKind = "News" | "Event" | "Insider" | "Price";

export interface WatchAlert {
  id: string;
  ticker: string;
  text: string;
  kind: AlertKind;
  on: boolean;
}

export interface WatchData {
  stocks: string[];
  themes: string[];
  alerts: WatchAlert[];
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

const EMPTY: WatchData = { stocks: [], themes: [], alerts: [] };

function norm(v: WatchData | null | undefined): WatchData {
  return {
    stocks: v?.stocks ?? [],
    themes: v?.themes ?? [],
    alerts: v?.alerts ?? [],
  };
}

export function useWatchlist() {
  const { value, setValue, ready, scope } = useSyncedState<WatchData>("watchlist", EMPTY);
  const data = norm(value);

  const addStock = useCallback(
    (t: string) => {
      const tk = t.trim().toUpperCase();
      if (!tk) return;
      setValue((prev) => {
        const p = norm(prev);
        if (p.stocks.includes(tk)) return p;
        return { ...p, stocks: [...p.stocks, tk] };
      });
    },
    [setValue]
  );

  const removeStock = useCallback(
    (t: string) => {
      setValue((prev) => {
        const p = norm(prev);
        return { ...p, stocks: p.stocks.filter((s) => s !== t) };
      });
    },
    [setValue]
  );

  const addTheme = useCallback(
    (label: string) => {
      const l = label.trim();
      if (!l) return;
      setValue((prev) => {
        const p = norm(prev);
        if (p.themes.some((x) => x.toLowerCase() === l.toLowerCase())) return p;
        return { ...p, themes: [...p.themes, l] };
      });
    },
    [setValue]
  );

  const removeTheme = useCallback(
    (label: string) => {
      setValue((prev) => {
        const p = norm(prev);
        return { ...p, themes: p.themes.filter((t) => t !== label) };
      });
    },
    [setValue]
  );

  const addAlert = useCallback(
    (a: Omit<WatchAlert, "id" | "on">) => {
      setValue((prev) => {
        const p = norm(prev);
        return { ...p, alerts: [...p.alerts, { ...a, id: uid(), on: true }] };
      });
    },
    [setValue]
  );

  const toggleAlert = useCallback(
    (id: string) => {
      setValue((prev) => {
        const p = norm(prev);
        return { ...p, alerts: p.alerts.map((al) => (al.id === id ? { ...al, on: !al.on } : al)) };
      });
    },
    [setValue]
  );

  const removeAlert = useCallback(
    (id: string) => {
      setValue((prev) => {
        const p = norm(prev);
        return { ...p, alerts: p.alerts.filter((al) => al.id !== id) };
      });
    },
    [setValue]
  );

  return {
    data,
    ready,
    scope,
    addStock,
    removeStock,
    addTheme,
    removeTheme,
    addAlert,
    toggleAlert,
    removeAlert,
  };
}
