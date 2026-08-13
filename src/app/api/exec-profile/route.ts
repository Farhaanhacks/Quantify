import { NextResponse } from "next/server";
import { kvGet, kvSet, kvConfigured } from "@/lib/kv";
import {
  allNames,
  buildProfile,
  isSubstantive,
  leadershipIds,
  referencedIds,
  samePerson,
  verifyMatch,
  type ExecProfile,
  type WikidataEntity,
} from "@/lib/execProfile";

// A named executive's actual biography — education, career, portrait.
//
// Yahoo's roster carries none of that, so this reaches for the two open sources
// that do: Wikidata for structured claims (`educated at`, `academic degree`,
// `employer`, `position held`) and Wikipedia for the written summary and photo.
// Both are free, keyless and openly licensed; neither needs an account.
//
// Fetched on demand, one person at a time, because the reader expands one row
// at a time and each lookup costs several upstream calls. Cached in Redis
// afterwards — including the misses, which are the common case for a mid-cap
// CFO nobody has written an article about.
//
// The identity rules live in lib/execProfile and are tested there. The short
// version: a candidate must be a human AND corroborated as belonging to this
// company. Name similarity alone is refused, because attaching the wrong
// biography to a named officer of a real company is a false statement about a
// real person, and an empty card is not.

export const dynamic = "force-dynamic";
export const maxDuration = 20;

const UA = "Quantifi/1.0 (stock research; contact via site)";
const WD_API = "https://www.wikidata.org/w/api.php";
const WIKI_REST = "https://en.wikipedia.org/api/rest_v1";

interface Payload {
  found: boolean;
  profile?: ExecProfile;
  extract?: string;
  /** Wikipedia article URL — required by CC BY-SA, and useful anyway. */
  source?: string;
  /** Why nothing is shown, so the UI never has to guess. */
  reason?: "no-candidate" | "unverified" | "too-thin" | "upstream-error";
  /** Only with ?debug=1 — which step ran and what it saw. */
  debug?: Record<string, unknown>;
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
  try {
    const r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: AbortSignal.timeout(7000),
      next: { revalidate: 86400 },
    });
    if (!r.ok) return null;
    return (await r.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Wikidata QIDs for the company itself, so a person's claims can be matched to it. */
async function companyQids(company: string): Promise<string[]> {
  const url = `${WD_API}?action=wbsearchentities&search=${encodeURIComponent(
    company
  )}&language=en&type=item&limit=5&format=json&origin=*`;
  const j = await getJson(url);
  const list = Array.isArray(j?.search) ? (j.search as { id?: string }[]) : [];
  return list.map((x) => x.id).filter((x): x is string => Boolean(x));
}

async function entitiesById(ids: string[]): Promise<Record<string, WikidataEntity>> {
  if (!ids.length) return {};
  const url = `${WD_API}?action=wbgetentities&ids=${ids.slice(0, 40).join(
    "|"
  )}&props=labels|aliases|descriptions|claims|sitelinks&languages=en&sitefilter=enwiki&format=json&origin=*`;
  const j = await getJson(url);
  const ents = (j?.entities ?? {}) as Record<string, WikidataEntity>;
  return ents;
}

/** Labels only — a second, cheaper call for the QIDs a profile references. */
async function labelsFor(ids: string[]): Promise<Record<string, string>> {
  if (!ids.length) return {};
  const out: Record<string, string> = {};
  // wbgetentities accepts 50 ids per call; a person never needs more than one page.
  const url = `${WD_API}?action=wbgetentities&ids=${ids.slice(0, 50).join(
    "|"
  )}&props=labels&languages=en&format=json&origin=*`;
  const j = await getJson(url);
  const ents = (j?.entities ?? {}) as Record<string, { labels?: Record<string, { value: string }> }>;
  for (const [id, e] of Object.entries(ents)) {
    const v = e.labels?.en?.value;
    if (v) out[id] = v;
  }
  return out;
}

async function wikiSummary(title: string): Promise<{ extract?: string; url?: string } | null> {
  const j = await getJson(`${WIKI_REST}/page/summary/${encodeURIComponent(title)}`);
  if (!j) return null;
  const extract = typeof j.extract === "string" ? j.extract : undefined;
  const pages = j.content_urls as { desktop?: { page?: string } } | undefined;
  return { extract, url: pages?.desktop?.page };
}

export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const person = (sp.get("name") || "").trim();
  const company = (sp.get("company") || "").trim();
  if (!person || person.length > 80 || !company || company.length > 120) {
    return NextResponse.json({ found: false, reason: "no-candidate" } as Payload);
  }

  const key = `exec:${company.toLowerCase()}:${person.toLowerCase()}`.slice(0, 200);
  if (kvConfigured()) {
    const cached = await kvGet(key);
    if (cached) {
      try {
        return NextResponse.json(JSON.parse(cached) as Payload);
      } catch {
        /* fall through and re-fetch */
      }
    }
  }

  const finish = async (p: Payload) => {
    // Cache misses too. Most executives have no article, and re-asking
    // Wikidata about them on every expand is a cost with a known answer.
    if (kvConfigured()) await kvSet(key, JSON.stringify(p));
    return NextResponse.json(p);
  };

  // Yahoo writes names as "Mr. Eee Boss" / "Ms. A. B. Sharma"; Wikidata does not.
  const cleaned = person.replace(/^(mr|mrs|ms|dr|prof|shri|smt)\.?\s+/i, "").trim();
  const debug: Record<string, unknown> = {};
  const wantDebug = sp.get("debug") === "1";
  const done = (p: Payload) => finish(wantDebug ? { ...p, debug } : p);

  const orgIds = await companyQids(company);
  debug.companyQids = orgIds;

  // ── 1. Ask the COMPANY who its people are ────────────────────────────────
  //
  // This is the path that matters and the one that was missing. Wikidata
  // records corporate leadership on the company's item — NVIDIA holds
  // "chief executive officer → Jensen Huang" — and very often the person's own
  // item has no employer claim at all. Searching by name and then looking for a
  // link back to the company therefore fails for exactly the best-documented
  // executives.
  //
  // Starting here also settles the name problem for free: NVIDIA files its CEO
  // as "Jen-Hsun Huang" and Wikidata labels him "Jensen Huang", so no string
  // search on the filed name reliably finds him. Reading the company's own
  // claim and matching surnames does.
  const orgEntities = await entitiesById(orgIds);
  const peopleIds = new Set<string>();
  for (const qid of orgIds) {
    const org = orgEntities[qid];
    if (org) for (const pid of leadershipIds(org)) peopleIds.add(pid);
  }
  debug.leadershipCandidates = [...peopleIds];

  if (peopleIds.size) {
    const people = await entitiesById([...peopleIds]);
    for (const pid of peopleIds) {
      const ent = people[pid];
      if (!ent) continue;
      const names = allNames(ent);
      if (!names.some((n) => samePerson(person, n))) continue;

      debug.matchedVia = "company-names-them";
      debug.matchedNames = names;
      const labels = await labelsFor(referencedIds(ent));
      const profile = buildProfile(ent, "company-names-them", labels);
      const summary = profile.wikiTitle ? await wikiSummary(profile.wikiTitle) : null;
      if (!isSubstantive(profile, summary?.extract)) return done({ found: false, reason: "too-thin" });
      return done({ found: true, profile, extract: summary?.extract, source: summary?.url });
    }
  }

  // ── 2. Fall back to searching by name ────────────────────────────────────
  const searchUrl = `${WD_API}?action=wbsearchentities&search=${encodeURIComponent(
    cleaned
  )}&language=en&type=item&limit=5&format=json&origin=*`;
  const search = await getJson(searchUrl);
  if (!search) return done({ found: false, reason: "upstream-error" });
  const candidates = (Array.isArray(search.search) ? search.search : []) as { id?: string }[];
  const ids = candidates.map((c) => c.id).filter((x): x is string => Boolean(x));
  debug.nameSearchCandidates = ids;
  if (!ids.length) return done({ found: false, reason: "no-candidate" });

  const entities = await entitiesById(ids);

  // Try each candidate in the order Wikidata ranked them, but accept only a
  // corroborated one.
  for (const id of ids) {
    const ent = entities[id];
    if (!ent) continue;

    let matched = verifyMatch(ent, company, orgIds);
    let summary: { extract?: string; url?: string } | null = null;

    // Only pay for the article when the claims did not already settle it.
    const title = ent.sitelinks?.enwiki?.title;
    if (!matched && title) {
      summary = await wikiSummary(title);
      matched = verifyMatch(ent, company, orgIds, summary?.extract);
    }
    if (!matched) continue;

    debug.matchedVia = matched;
    const labels = await labelsFor(referencedIds(ent));
    const profile = buildProfile(ent, matched, labels);
    if (!summary && profile.wikiTitle) summary = await wikiSummary(profile.wikiTitle);

    if (!isSubstantive(profile, summary?.extract)) {
      return done({ found: false, reason: "too-thin" });
    }
    return done({
      found: true,
      profile,
      extract: summary?.extract,
      source: summary?.url,
    });
  }

  return done({ found: false, reason: "unverified" });
}
