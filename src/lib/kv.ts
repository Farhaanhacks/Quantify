// Per-account storage via the Upstash Redis REST API (the KV database connected
// in Vercel). Plain fetch against the REST endpoint — no client library, so it
// can't break the build. Every call is wrapped: if the DB isn't configured or a
// request fails, callers fall back to browser storage.

const REST_URL = process.env.KV_REST_API_URL || "";
const REST_TOKEN = process.env.KV_REST_API_TOKEN || "";

export const kvConfigured = (): boolean => !!(REST_URL && REST_TOKEN);

async function command(args: string[]): Promise<unknown> {
  if (!kvConfigured()) return null;
  const res = await fetch(REST_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${REST_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { result?: unknown };
  return data?.result ?? null;
}

export async function kvGet(key: string): Promise<string | null> {
  try {
    const r = await command(["GET", key]);
    return typeof r === "string" ? r : null;
  } catch {
    return null;
  }
}

/**
 * Write a key, optionally with an expiry in seconds.
 *
 * The expiry matters most for NEGATIVE results. A cached "we found nothing"
 * with no TTL is permanent, so every later improvement to the code that
 * produced it is invisible: the lookup returns the old failure before doing any
 * work. That is not a hypothetical — it is what happened to the executive
 * profiles, where an early version's misses outlived three rounds of fixes.
 */
export async function kvSet(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
  try {
    const args =
      ttlSeconds && ttlSeconds > 0
        ? ["SET", key, value, "EX", String(Math.floor(ttlSeconds))]
        : ["SET", key, value];
    const r = await command(args);
    return r === "OK";
  } catch {
    return false;
  }
}

// SET ... NX EX — claim a key only if nobody holds it, and let it expire on its
// own. Returns true only for the caller that actually claimed it, which makes
// it a one-round-trip "have we already done this today?" guard.
export async function kvClaim(key: string, ttlSeconds: number): Promise<boolean> {
  try {
    const r = await command(["SET", key, "1", "NX", "EX", String(ttlSeconds)]);
    return r === "OK";
  } catch {
    return false;
  }
}

// List helpers (used for the community question inbox).
export async function kvRPush(key: string, value: string): Promise<boolean> {
  try {
    const r = await command(["RPUSH", key, value]);
    return typeof r === "number";
  } catch {
    return false;
  }
}

export async function kvLRange(key: string, start = 0, stop = -1): Promise<string[]> {
  try {
    const r = await command(["LRANGE", key, String(start), String(stop)]);
    return Array.isArray(r) ? r.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export async function kvLTrim(key: string, start: number, stop: number): Promise<void> {
  try {
    await command(["LTRIM", key, String(start), String(stop)]);
  } catch {
    /* ignore */
  }
}


// ── Counters and sets, for the usage analytics on /admin ────────────────────
//
// The REST wrapper takes arbitrary Redis commands, so these need no new
// transport — only the small surface the analytics actually uses. Every one is
// wrapped like the rest of this file: a failure is silent and the caller
// carries on, because a metric is never worth failing a page over.

export async function kvIncr(key: string): Promise<number | null> {
  try {
    const r = await command(["INCR", key]);
    return typeof r === "number" ? r : null;
  } catch {
    return null;
  }
}

export async function kvExpire(key: string, seconds: number): Promise<void> {
  try {
    await command(["EXPIRE", key, String(Math.floor(seconds))]);
  } catch {
    /* best effort */
  }
}

export async function kvMGet(keys: string[]): Promise<(string | null)[]> {
  if (!keys.length) return [];
  try {
    const r = await command(["MGET", ...keys]);
    return Array.isArray(r) ? (r as (string | null)[]) : keys.map(() => null);
  } catch {
    return keys.map(() => null);
  }
}

/**
 * HyperLogLog — counts DISTINCT values without storing them.
 *
 * The right structure for "how many people visited today": it answers the
 * question to within ~1% while keeping no record of who any of them were, which
 * a set of identifiers would.
 */
export async function kvPfAdd(key: string, value: string): Promise<void> {
  try {
    await command(["PFADD", key, value]);
  } catch {
    /* best effort */
  }
}

export async function kvPfCount(keys: string[]): Promise<number> {
  if (!keys.length) return 0;
  try {
    const r = await command(["PFCOUNT", ...keys]);
    return typeof r === "number" ? r : 0;
  } catch {
    return 0;
  }
}

/** A capped, expiring set — used for "which accounts were active today". */
export async function kvSAdd(key: string, value: string): Promise<void> {
  try {
    await command(["SADD", key, value]);
  } catch {
    /* best effort */
  }
}

export async function kvSMembers(key: string): Promise<string[]> {
  try {
    const r = await command(["SMEMBERS", key]);
    return Array.isArray(r) ? (r as string[]) : [];
  } catch {
    return [];
  }
}

export async function kvZIncrBy(key: string, member: string, by = 1): Promise<void> {
  try {
    await command(["ZINCRBY", key, String(by), member]);
  } catch {
    /* best effort */
  }
}

/** Highest-scoring members of a sorted set, with their scores. */
export async function kvZTop(key: string, count: number): Promise<{ member: string; score: number }[]> {
  try {
    const r = await command(["ZRANGE", key, "0", String(Math.max(0, count - 1)), "REV", "WITHSCORES"]);
    if (!Array.isArray(r)) return [];
    const out: { member: string; score: number }[] = [];
    for (let i = 0; i < r.length; i += 2) {
      out.push({ member: String(r[i]), score: Number(r[i + 1]) || 0 });
    }
    return out;
  } catch {
    return [];
  }
}

/** SET key value NX EX ttl, returning whether this caller set it. */
export async function kvSetNx(key: string, value: string, ttlSeconds: number): Promise<boolean> {
  try {
    const r = await command(["SET", key, value, "NX", "EX", String(Math.floor(ttlSeconds))]);
    return r === "OK";
  } catch {
    return false;
  }
}
