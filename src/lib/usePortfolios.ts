"use client";

import { useCallback, useEffect, useState } from "react";
import { stockByTicker } from "@/data/demo";

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

const KEY = "quantifi.portfolios.v1";

const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);

// Resolve a current price from the bundled universe when the ticker is known.
export const resolvePrice = (ticker: string, fallback = 0): number =>
  stockByTicker[ticker.toUpperCase()]?.price ?? fallback;

export const resolveName = (ticker: string): string | undefined =>
  stockByTicker[ticker.toUpperCase()]?.name;

function seedPortfolios(): UserPortfolio[] {
  const sample = [
    { ticker: "NVDA", shares: 12, avgCost: 110 },
    { ticker: "MSFT", shares: 5, avgCost: 410 },
    { ticker: "AMD", shares: 20, avgCost: 120 },
  ].map((h) => ({
    id: uid(),
    ticker: h.ticker,
    shares: h.shares,
    avgCost: h.avgCost,
    price: resolvePrice(h.ticker, h.avgCost),
  }));
  return [{ id: uid(), name: "My Portfolio", holdings: sample, createdAt: Date.now() }];
}

export function usePortfolios() {
  const [portfolios, setPortfolios] = useState<UserPortfolio[]>([]);
  const [ready, setReady] = useState(false);

  // Load once on mount (localStorage is only available in the browser).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      const parsed = raw ? (JSON.parse(raw) as UserPortfolio[]) : null;
      setPortfolios(parsed && parsed.length ? parsed : seedPortfolios());
    } catch {
      setPortfolios(seedPortfolios());
    }
    setReady(true);
  }, []);

  // Persist on every change once loaded.
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(portfolios));
    } catch {
      /* storage full or blocked — ignore */
    }
  }, [portfolios, ready]);

  const createPortfolio = useCallback((name: string) => {
    const p: UserPortfolio = {
      id: uid(),
      name: name.trim() || "Untitled portfolio",
      holdings: [],
      createdAt: Date.now(),
    };
    setPortfolios((prev) => [...prev, p]);
    return p.id;
  }, []);

  const renamePortfolio = useCallback((id: string, name: string) => {
    setPortfolios((prev) =>
      prev.map((p) => (p.id === id ? { ...p, name: name.trim() || p.name } : p))
    );
  }, []);

  const deletePortfolio = useCallback((id: string) => {
    setPortfolios((prev) => prev.filter((p) => p.id !== id));
  }, []);

  const addHolding = useCallback((pid: string, h: Omit<UserHolding, "id">) => {
    setPortfolios((prev) =>
      prev.map((p) =>
        p.id === pid ? { ...p, holdings: [...p.holdings, { ...h, id: uid() }] } : p
      )
    );
  }, []);

  const removeHolding = useCallback((pid: string, hid: string) => {
    setPortfolios((prev) =>
      prev.map((p) =>
        p.id === pid ? { ...p, holdings: p.holdings.filter((h) => h.id !== hid) } : p
      )
    );
  }, []);

  return {
    portfolios,
    ready,
    createPortfolio,
    renamePortfolio,
    deletePortfolio,
    addHolding,
    removeHolding,
  };
}
