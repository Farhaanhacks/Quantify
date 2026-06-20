"use client";

import { useCallback } from "react";
import { stockByTicker } from "@/data/demo";
import { useSyncedState } from "@/lib/useSyncedState";

export interface UserHolding {
  id: string;
  ticker: string;
  shares: number;
  avgCost: number;
  price: number; // current price (auto-resolved from universe, or user-entered)
}

export interface UserPortfolio {
  id: string;
  name: string;
  holdings: UserHolding[];
  createdAt: number;
}

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

// Resolve a current price from the bundled universe when the ticker is known.
export const resolvePrice = (ticker: string, fallback = 0): number =>
  stockByTicker[ticker.toUpperCase()]?.price ?? fallback;

export const resolveName = (ticker: string): string | undefined =>
  stockByTicker[ticker.toUpperCase()]?.name;

export function usePortfolios() {
  const { value: portfolios, setValue, ready, scope } = useSyncedState<UserPortfolio[]>(
    "portfolios",
    []
  );

  const createPortfolio = useCallback(
    (name: string) => {
      const p: UserPortfolio = {
        id: uid(),
        name: name.trim() || "Untitled portfolio",
        holdings: [],
        createdAt: Date.now(),
      };
      setValue((prev) => [...prev, p]);
      return p.id;
    },
    [setValue]
  );

  const renamePortfolio = useCallback(
    (id: string, name: string) => {
      setValue((prev) => prev.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p)));
    },
    [setValue]
  );

  const deletePortfolio = useCallback(
    (id: string) => {
      setValue((prev) => prev.filter((p) => p.id !== id));
    },
    [setValue]
  );

  const addHolding = useCallback(
    (pid: string, h: Omit<UserHolding, "id">) => {
      setValue((prev) =>
        prev.map((p) => (p.id === pid ? { ...p, holdings: [...p.holdings, { ...h, id: uid() }] } : p))
      );
    },
    [setValue]
  );

  const removeHolding = useCallback(
    (pid: string, hid: string) => {
      setValue((prev) =>
        prev.map((p) =>
          p.id === pid ? { ...p, holdings: p.holdings.filter((h) => h.id !== hid) } : p
        )
      );
    },
    [setValue]
  );

  return {
    portfolios,
    ready,
    scope,
    createPortfolio,
    renamePortfolio,
    deletePortfolio,
    addHolding,
    removeHolding,
  };
}
