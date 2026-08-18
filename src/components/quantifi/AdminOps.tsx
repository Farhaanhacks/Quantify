"use client";

import { useCallback, useEffect, useState } from "react";
import { GlassCard } from "@/components/quantifi/Cards";

// The operations panel. Rendered only inside /admin, which has already checked
// the session on the server — this component holds no authority of its own, and
// every endpoint it calls re-checks.

interface DatasetRow {
  dataset: string;
  ok: boolean;
  rowsIn: number;
  httpStatus?: number;
  error?: string;
  seenColumns?: string[];
}

interface Ops {
  ok: boolean;
  you: string;
  env: Record<string, boolean>;
  ingest: {
    india: { lastRun: string; symbols: number; rows: number; source: string } | null;
    taiwan: {
      lastRun: string;
      lastCompleteRun?: string;
      companies: number;
      records: number;
      datasets: DatasetRow[];
    } | null;
  };
  search: { indiaCompanies: number };
  now: string;
}

const ago = (iso?: string) => {
  if (!iso) return "never";
  const h = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (!isFinite(h)) return iso;
  if (h < 1) return `${Math.max(1, Math.round(h * 60))} min ago`;
  if (h < 48) return `${Math.round(h)} h ago`;
  return `${Math.round(h / 24)} d ago`;
};

function Dot({ on, label }: { on: boolean; label: string }) {
  return (
    <span className="flex items-center gap-2 py-1">
      <span
        className={`h-2 w-2 flex-none rounded-full ${on ? "bg-up" : "bg-down"}`}
        aria-hidden
      />
      <span className={`text-xs ${on ? "text-slate-300" : "text-slate-500"}`}>{label}</span>
      <span className="sr-only">{on ? "configured" : "not configured"}</span>
    </span>
  );
}

export default function AdminOps() {
  const [ops, setOps] = useState<Ops | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/ops", { cache: "no-store" });
      if (!r.ok) throw new Error(`status ${r.status}`);
      setOps(await r.json());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "failed");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (job: string) => {
    setRunning(job);
    setResult(null);
    try {
      const r = await fetch(`/api/admin/run/${job}`, { method: "POST" });
      const d = await r.json();
      // The job's own JSON, verbatim. A dashboard that summarises a failure into
      // "something went wrong" is a dashboard you have to leave to debug.
      setResult(JSON.stringify(d, null, 2));
      await load();
    } catch (e) {
      setResult(e instanceof Error ? e.message : "failed");
    } finally {
      setRunning(null);
    }
  };

  if (error) {
    return (
      <GlassCard className="mt-6 p-5 text-sm text-slate-400">
        Couldn&apos;t load operations data ({error}).
      </GlassCard>
    );
  }
  if (!ops) {
    return <GlassCard className="mt-6 p-5 text-sm text-slate-500">Loading…</GlassCard>;
  }

  const tw = ops.ingest.taiwan;
  const inMeta = ops.ingest.india;

  return (
    <div className="mt-6 space-y-4">
      <GlassCard className="p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-white">Configuration</h2>
        <p className="mt-1 text-xs text-slate-500">
          Whether each integration has credentials — never what they are.
        </p>
        <div className="mt-3 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(ops.env).map(([k, v]) => (
            <Dot key={k} on={v} label={k} />
          ))}
        </div>
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">Taiwan insider ingest</h2>
            <p className="mt-1 text-xs text-slate-500">
              Six TWSE / TPEx open-data files → Redis. Stock pages read the store.
            </p>
          </div>
          <button
            type="button"
            onClick={() => run("insider-tw")}
            disabled={running != null}
            className="rounded-lg border border-gold/30 bg-gold/10 px-3 py-1.5 text-xs font-medium text-gold transition hover:bg-gold/20 disabled:opacity-50"
          >
            {running === "insider-tw" ? "Running…" : "Run now"}
          </button>
        </div>

        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-slate-500">Last run</dt>
            <dd className="font-mono text-sm text-slate-200">{ago(tw?.lastRun)}</dd>
          </div>
          <div>
            <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-slate-500">
              Last complete
            </dt>
            <dd className={`font-mono text-sm ${tw?.lastCompleteRun ? "text-slate-200" : "text-down"}`}>
              {ago(tw?.lastCompleteRun)}
            </dd>
          </div>
          <div>
            <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-slate-500">Companies</dt>
            <dd className="font-mono text-sm text-slate-200">{tw?.companies ?? 0}</dd>
          </div>
        </dl>

        {tw?.datasets?.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="text-left text-[0.62rem] uppercase tracking-[0.14em] text-slate-500">
                  <th className="py-2 font-normal">Dataset</th>
                  <th className="py-2 font-normal">Status</th>
                  <th className="py-2 text-right font-normal">Rows</th>
                  <th className="py-2 font-normal">Detail</th>
                </tr>
              </thead>
              <tbody>
                {tw.datasets.map((d) => (
                  <tr key={d.dataset} className="border-t border-white/[0.05] align-top">
                    <td className="py-2 font-mono text-slate-300">{d.dataset}</td>
                    <td className={`py-2 ${d.ok ? "text-up" : "text-down"}`}>
                      {d.ok ? "ok" : d.httpStatus ?? "failed"}
                    </td>
                    <td className="py-2 text-right font-mono tnum text-slate-300">{d.rowsIn}</td>
                    <td className="py-2 text-slate-500">
                      {d.error ?? ""}
                      {/* The payload's real column names. This is what turns a
                          schema change from an invisible outage into a one-line
                          fix — the parser refuses to guess, and this is where
                          the truth shows up. */}
                      {d.seenColumns?.length ? (
                        <span className="mt-1 block font-mono text-[0.6rem] text-slate-600">
                          {d.seenColumns.join(" · ")}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-3 text-xs text-slate-500">
            No run recorded yet. Until one completes, every .TW / .TWO page reports “source
            temporarily unavailable”.
          </p>
        )}
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold text-white">India insider ingest</h2>
            <p className="mt-1 text-xs text-slate-500">SEBI PIT disclosures → Redis.</p>
          </div>
          <button
            type="button"
            onClick={() => run("insider-in")}
            disabled={running != null}
            className="rounded-lg border border-white/15 bg-white/[0.05] px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-white/10 disabled:opacity-50"
          >
            {running === "insider-in" ? "Running…" : "Run now"}
          </button>
        </div>
        <dl className="mt-4 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-slate-500">Last run</dt>
            <dd className="font-mono text-sm text-slate-200">{ago(inMeta?.lastRun)}</dd>
          </div>
          <div>
            <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-slate-500">Symbols</dt>
            <dd className="font-mono text-sm text-slate-200">{inMeta?.symbols ?? 0}</dd>
          </div>
          <div>
            <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-slate-500">Source</dt>
            <dd className="font-mono text-sm text-slate-200">{inMeta?.source ?? "—"}</dd>
          </div>
        </dl>
      </GlassCard>

      <GlassCard className="p-5 sm:p-6">
        <h2 className="font-display text-lg font-semibold text-white">Search index</h2>
        <p className="mt-2 text-sm text-slate-300">
          <span className="font-mono tnum">{ops.search.indiaCompanies.toLocaleString()}</span>{" "}
          Indian listings held locally.{" "}
          {ops.search.indiaCompanies === 0 ? (
            <span className="text-down">Empty — NSE&apos;s list could not be fetched.</span>
          ) : null}
        </p>
      </GlassCard>

      {result ? (
        <GlassCard className="p-5 sm:p-6">
          <h2 className="font-display text-sm font-semibold text-white">Last job output</h2>
          <pre className="mt-2 max-h-80 overflow-auto rounded-lg bg-black/40 p-3 font-mono text-[0.68rem] leading-relaxed text-slate-300">
            {result}
          </pre>
        </GlassCard>
      ) : null}

      <div className="flex flex-wrap gap-3 text-xs">
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg border border-white/15 px-3 py-1.5 text-slate-300 transition hover:bg-white/[0.06]"
        >
          Refresh
        </button>
        <a
          href="/api/insider/status?probe=1"
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-white/15 px-3 py-1.5 text-slate-300 transition hover:bg-white/[0.06]"
        >
          Full insider diagnosis (JSON)
        </a>
      </div>
    </div>
  );
}
