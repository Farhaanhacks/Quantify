#!/usr/bin/env node
// Ingest Indian insider (SEBI PIT Reg 7) disclosures into Redis, from GitHub
// Actions rather than from Vercel.
//
// Why this exists: NSE refuses requests from the IP ranges the app runs on, so
// the in-app fetch cannot work no matter how it is written. A GitHub Actions
// runner is a completely different network, and the app ALREADY prefers the
// Redis store over any live fetch — so if NSE serves the runner, filings appear
// in the product with no change to the app at all.
//
// Whether NSE serves that runner is not something anyone can reason their way
// to. This script prints the exact HTTP status of every attempt, so the first
// workflow run answers it outright.
//
// Writes the same keys the app reads:
//   insider:in:<SYMBOL>   JSON array of disclosures, newest first, capped
//   insider:in:_meta      { lastRun, symbols, rows, source }

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const MAX_PER_SYMBOL = 40; // must match src/lib/insiderStore.ts
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const die = (msg) => {
  console.error(`✗ ${msg}`);
  process.exit(1);
};
if (!KV_URL || !KV_TOKEN) die("KV_REST_API_URL / KV_REST_API_TOKEN are not set.");

// ── Upstash REST ────────────────────────────────────────────────────────────
async function kv(args) {
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  if (!r.ok) throw new Error(`KV ${r.status}: ${(await r.text()).slice(0, 120)}`);
  return (await r.json())?.result ?? null;
}

// ── NSE ─────────────────────────────────────────────────────────────────────
// NSE will not serve its API until its own pages have set cookies, so we keep a
// jar by hand rather than pulling in a dependency.
let jar = "";
function remember(res) {
  const raw = res.headers.getSetCookie?.() ?? [];
  const pairs = raw.map((c) => c.split(";")[0]).filter(Boolean);
  if (!pairs.length) return;
  const map = new Map(jar ? jar.split("; ").map((p) => [p.split("=")[0], p]) : []);
  for (const p of pairs) map.set(p.split("=")[0], p);
  jar = [...map.values()].join("; ");
}

async function nseGet(url, accept = "application/json, text/plain, */*") {
  const res = await fetch(url, {
    headers: {
      "User-Agent": UA,
      Accept: accept,
      "Accept-Language": "en-US,en;q=0.9",
      Referer: "https://www.nseindia.com/companies-listing/corporate-filings-insider-trading",
      ...(jar ? { Cookie: jar } : {}),
    },
    signal: AbortSignal.timeout(25000),
    redirect: "follow",
  });
  remember(res);
  const text = await res.text().catch(() => "");
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* not JSON — a block page, most likely */
  }
  return { status: res.status, json, text };
}

const dd = (d) =>
  `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
const ago = (days) => new Date(Date.now() - days * 864e5);

function normDate(s) {
  const t = Date.parse(s);
  if (isFinite(t)) return new Date(t).toISOString().slice(0, 10);
  const m = String(s).match(/(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : String(s).slice(0, 10);
}
const str = (v) => (typeof v === "string" ? v.trim() : typeof v === "number" ? String(v) : "");

// Mirrors pitRowToDisclosure in src/lib/insiderIndiaNSE.ts — including the id
// format, so rows ingested here dedupe against anything the app stored.
function toDisclosure(row) {
  if (!row || typeof row !== "object") return null;
  const sym = str(row.symbol);
  if (!sym) return null;
  const acq = str(row.acqName);
  const cat = str(row.personCategory);
  const tx = str(row.tdpTransactionType) || str(row.acqMode);
  const secType = str(row.secType) || "shares";
  const secAcq = str(row.secAcq);
  const secVal = str(row.secVal);
  const date = normDate(str(row.date) || str(row.anexDate) || str(row.acqfromDt) || str(row.besdate));

  const secValNum = Number(String(secVal).replace(/[^0-9.]/g, ""));
  const hasValue = Number.isFinite(secValNum) && secValNum > 0;
  const valPart = hasValue
    ? `₹${secValNum.toLocaleString("en-IN")}`
    : secAcq
      ? "no cash consideration"
      : "";
  const parts = [acq, cat, tx, secAcq ? `${secAcq} ${secType}` : "", valPart].filter(Boolean);
  const pdf = [str(row.attchmntFile), str(row.attachmentFile), str(row.attachment)].find(
    (u) => u && /^https?:\/\/\S+\.pdf(\?|$)/i.test(u)
  );
  const xbrl = str(row.xbrl);
  const url = pdf || (/^https?:\/\//.test(xbrl) ? xbrl : undefined);

  return {
    symbol: sym,
    disc: {
      id: `nse-${sym}-${date}-${acq.slice(0, 10)}-${secAcq}-${tx}`.replace(/\s+/g, ""),
      ticker: `${sym}.NS`,
      company: str(row.company) || sym,
      headline: parts.join(" · ") || "Insider / SAST disclosure",
      category: cat || "Insider Trading (PIT Reg 7)",
      date,
      url,
      person: acq || undefined,
      action: tx || undefined,
      sharesText: secAcq ? `${secAcq} ${secType}` : undefined,
      valueText: valPart || undefined,
    },
  };
}

/**
 * Pull the filing rows out of whatever NSE returned.
 *
 * `json.data` is where its insider feed puts them, but that was an assumption
 * carried from code that had never once reached NSE — every attempt had been
 * blocked before it got an answer. So this also accepts a bare top-level array,
 * and falls back to the largest array of objects anywhere in the payload. If
 * NSE names the key differently, the ingest still works instead of reporting a
 * confident zero.
 */
function extractRows(json) {
  if (!json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.data)) return json.data;
  if (typeof json !== "object") return [];
  let best = [];
  for (const v of Object.values(json)) {
    if (Array.isArray(v) && v.length > best.length && v.every((x) => x && typeof x === "object")) {
      best = v;
    }
  }
  return best;
}

async function main() {
  const days = Number(process.env.INSIDER_WINDOW_DAYS) || 7;
  console.log(`→ Warming up on nseindia.com …`);
  const home = await nseGet("https://www.nseindia.com/", "text/html,application/xhtml+xml");
  console.log(`   home: HTTP ${home.status}, ${home.text.length} bytes, cookies: ${jar ? "yes" : "none"}`);
  if (home.status !== 200) {
    console.log(`   body: ${home.text.slice(0, 200).replace(/\s+/g, " ")}`);
    die(
      `NSE refused this runner's IP (HTTP ${home.status}). GitHub's network is blocked too — a vendor feed is the remaining option.`
    );
  }

  // Then the filings page itself. NSE scopes some of its cookies to the section
  // you are browsing, and its APIs hand back an empty payload — not an error —
  // when called with only the homepage's cookies. A 200 carrying no rows is
  // exactly that symptom, so this visit is the first thing to try.
  const page = await nseGet(
    "https://www.nseindia.com/companies-listing/corporate-filings-insider-trading",
    "text/html,application/xhtml+xml"
  );
  console.log(`   filings page: HTTP ${page.status}, ${page.text.length} bytes`);

  // Wide window first; NSE returns empty for over-large ranges, so fall back.
  const base = "https://www.nseindia.com/api/corporates-pit?index=equities";
  const variants = [
    { q: `${days}d`, url: `${base}&from_date=${dd(ago(days))}&to_date=${dd(new Date())}` },
    { q: "3d", url: `${base}&from_date=${dd(ago(3))}&to_date=${dd(new Date())}` },
    { q: "1d", url: `${base}&from_date=${dd(ago(1))}&to_date=${dd(new Date())}` },
    { q: "latest", url: base },
  ];

  let rows = [];
  let wonWith = null;
  for (const v of variants) {
    const res = await nseGet(v.url);
    const data = extractRows(res.json);
    console.log(`   pit[${v.q}]: HTTP ${res.status}, ${data.length} rows`);
    // Show the body whenever it did not yield rows — including on a 200.
    //
    // The first live run returned "HTTP 200, 0 rows" and printed nothing else,
    // because this only logged on a non-200. That hid the one thing worth
    // knowing: a 200 carrying no rows means NSE answered us, so the payload is
    // either shaped differently than assumed or the query is wrong. Neither can
    // be diagnosed without seeing it.
    if (!data.length) {
      const keys = res.json && typeof res.json === "object" ? Object.keys(res.json) : [];
      console.log(`   → top-level keys: ${keys.length ? keys.join(", ") : "(not JSON)"}`);
      console.log(`   → body[0:400]: ${res.text.slice(0, 400).replace(/\s+/g, " ")}`);
    }
    if (data.length) {
      rows = data;
      wonWith = v.q;
      break;
    }
  }

  if (!rows.length) {
    die("NSE served this runner but returned no rows for any window. Nothing written.");
  }

  const bySymbol = new Map();
  for (const row of rows) {
    const parsed = toDisclosure(row);
    if (!parsed) continue;
    const list = bySymbol.get(parsed.symbol) ?? [];
    list.push(parsed.disc);
    bySymbol.set(parsed.symbol, list);
  }

  console.log(`→ ${rows.length} filings across ${bySymbol.size} companies (window ${wonWith})`);

  let written = 0;
  for (const [symbol, fresh] of bySymbol) {
    const key = `insider:in:${symbol.toUpperCase()}`;
    // Merge with whatever is stored so history accumulates across runs, exactly
    // as mergeStoredInsider does in the app.
    let existing = [];
    try {
      const raw = await kv(["GET", key]);
      if (raw) existing = JSON.parse(raw) ?? [];
    } catch {
      /* treat an unreadable key as empty rather than losing the run */
    }
    const seen = new Set(existing.map((d) => d.id));
    const combined = [...fresh.filter((d) => !seen.has(d.id)), ...existing]
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
      .slice(0, MAX_PER_SYMBOL);
    await kv(["SET", key, JSON.stringify(combined)]);
    written++;
  }

  await kv([
    "SET",
    "insider:in:_meta",
    JSON.stringify({
      lastRun: new Date().toISOString(),
      symbols: written,
      rows: rows.length,
      source: "github-actions-nse",
    }),
  ]);

  console.log(`✓ Wrote ${written} symbols to Redis. The app will serve these immediately.`);
}

main().catch((e) => die(String(e)));
