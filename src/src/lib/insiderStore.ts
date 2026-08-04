// Redis-backed store for Indian insider disclosures. This is the layer that makes
// the feature RELIABLE: a daily cron ingests the whole market's insider filings
// once (off the user path, with hard retries) and writes them here; every user
// request then reads from here instantly and deterministically — no per-request
// scraping of a bot-hostile exchange. Falls back to nothing (caller then does a
// live fetch) when the store isn't configured or a key is missing.

import { kvGet, kvSet, kvConfigured } from "@/lib/kv";
import type { IndiaDisclosure } from "@/lib/insiderIndia";

export { kvConfigured };

const bare = (ticker: string): string =>
  ticker.toUpperCase().replace(/\.(NS|BO)$/i, "").trim();
const keyFor = (ticker: string): string => `insider:in:${bare(ticker)}`;
const META_KEY = "insider:in:_meta";
const MAX_PER_SYMBOL = 40;

export interface IngestMeta {
  lastRun: string; // ISO timestamp of the last successful ingest
  symbols: number; // symbols written
  rows: number; // raw rows parsed
  source: string; // "vendor" | "nse-market-wide"
}

export async function getStoredInsider(ticker: string): Promise<IndiaDisclosure[] | null> {
  const raw = await kvGet(keyFor(ticker));
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? (arr as IndiaDisclosure[]) : null;
  } catch {
    return null;
  }
}

export async function setStoredInsider(
  ticker: string,
  rows: IndiaDisclosure[]
): Promise<boolean> {
  return kvSet(keyFor(ticker), JSON.stringify(rows.slice(0, MAX_PER_SYMBOL)));
}

// Merge fresh rows into whatever is already stored (dedupe by id, newest first),
// so history accumulates across daily runs instead of being overwritten.
export async function mergeStoredInsider(
  ticker: string,
  fresh: IndiaDisclosure[]
): Promise<number> {
  const existing = (await getStoredInsider(ticker)) ?? [];
  const seen = new Set(existing.map((d) => d.id));
  const combined = [...fresh.filter((d) => !seen.has(d.id)), ...existing]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, MAX_PER_SYMBOL);
  await setStoredInsider(ticker, combined);
  return combined.length;
}

export async function getIngestMeta(): Promise<IngestMeta | null> {
  const raw = await kvGet(META_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as IngestMeta;
  } catch {
    return null;
  }
}

export async function setIngestMeta(meta: IngestMeta): Promise<void> {
  await kvSet(META_KEY, JSON.stringify(meta));
}
