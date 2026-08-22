"use client";

import { useState } from "react";
import { GlassCard } from "@/components/quantifi/Cards";

// Putting a filing into the system without touching a terminal.
//
// The pipeline behind this works and has been empty since the day it shipped,
// because filling it meant downloading an XBRL file, setting an admin cookie in
// an environment variable and running a script with five flags. Every one of
// those is a step that can go wrong quietly, and the symptom of any of them
// failing is identical: a company page that goes on saying its bad-loan figures
// are not in the current data source.
//
// So: choose the file, name the company, press the button. The response is
// rendered in full rather than summarised, because the interesting part of a
// first ingest is not whether it succeeded but WHAT IT DID NOT UNDERSTAND. The
// unmapped tags are the list of concepts the alias table is missing for this
// filer, and they are the fastest route to making the next filing parse
// completely.

const INDUSTRIES = [
  { key: "bank", label: "Bank" },
  { key: "nbfc", label: "Non-bank lender (NBFC)" },
  { key: "life-insurer", label: "Life insurer" },
  { key: "general-insurer", label: "General insurer" },
  { key: "ordinary", label: "Ordinary company" },
] as const;

interface HealthLink {
  step: string;
  ok: boolean;
  detail: string;
  fix?: string;
  notes?: string[];
}

interface HealthResponse {
  symbol?: string;
  verdict?: string;
  links?: HealthLink[];
  error?: string;
}

interface IngestResponse {
  ok?: boolean;
  duplicate?: boolean;
  filingId?: string;
  contentHash?: string;
  facts?: number;
  rejected?: number;
  unmapped?: string[];
  issues?: { concept: string; reason: string }[];
  rawStored?: boolean;
  rawStoreReason?: string;
  error?: string;
}

export default function FilingsUpload() {
  const [symbol, setSymbol] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [industry, setIndustry] = useState<string>("bank");
  const [periodEnd, setPeriodEnd] = useState("");
  const [scope, setScope] = useState("consolidated");
  const [content, setContent] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestResponse | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [checking, setChecking] = useState(false);

  // The company is keyed on its ISIN or CIN where one is given, and on the
  // symbol otherwise. Both work; only the first survives a rename, so the field
  // says so rather than quietly accepting the weaker one.
  const companyId = identifier.trim()
    ? /^[A-Z]{2}[A-Z0-9]{9}\d$/i.test(identifier.trim())
      ? `isin:${identifier.trim().toUpperCase()}`
      : `cin:${identifier.trim().toUpperCase()}`
    : symbol.trim()
      ? `provisional:${/\.BO$/i.test(symbol.trim()) ? "bse" : "nse"}:${symbol
          .trim()
          .toUpperCase()
          .replace(/\.(NS|BO)$/i, "")}`
      : "";

  async function readFile(file: File) {
    setFileName(file.name);
    setContent(await file.text());
    setResult(null);
  }

  async function submit() {
    if (!content.trim() || !companyId) return;
    setBusy(true);
    setResult(null);
    try {
      const res = await fetch("/api/filings/ingest", {
        method: "POST",
        // Names this as a fetch from our own page. A cross-site form post
        // cannot set a custom header, so the endpoint requires one before it
        // will accept a session cookie at all.
        headers: { "Content-Type": "application/json", "X-Quantifi-Ingest": "1" },
        body: JSON.stringify({
          companyId,
          industry,
          content,
          format: "xbrl",
          source: "manual",
          periodEnd: periodEnd || undefined,
          scope,
          symbols: symbol.trim() ? [symbol.trim().toUpperCase()] : undefined,
          sourceUrl: fileName ? `upload://${fileName}` : undefined,
        }),
      });
      setResult((await res.json()) as IngestResponse);
    } catch (e) {
      setResult({ error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  /**
   * Walk the chain and say where it breaks.
   *
   * The question this answers had been asked four times and answered in prose
   * every time, which was the wrong instrument: the chain has seven links and
   * any one of them failing produces the same symptom at the far end, a bank
   * card reading four of eight. This asks the deployment instead of reasoning
   * about it.
   */
  async function runHealth() {
    setChecking(true);
    setHealth(null);
    try {
      const target = symbol.trim() || "HDFCBANK.NS";
      const res = await fetch(`/api/filings/health?symbol=${encodeURIComponent(target)}`);
      setHealth((await res.json()) as HealthResponse);
    } catch (e) {
      setHealth({ error: (e as Error).message });
    } finally {
      setChecking(false);
    }
  }

  const field =
    "w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-gold/40 focus:outline-none";
  const labelCls = "block text-[0.65rem] uppercase tracking-[0.14em] text-slate-500";

  return (
    <GlassCard className="mt-4 p-5 sm:p-6">
      <div className="text-[0.7rem] uppercase tracking-[0.16em] text-gold/90">Filings</div>
      <h2 className="mt-1 font-display text-lg font-semibold text-white">Ingest a filing</h2>
      <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-400">
        An XBRL results document from the NSE or the BSE. The measures a bank is actually judged
        on, its bad loans, its provision coverage and its capital adequacy, are published here and
        in no general market feed, so a company page cannot score them until a filing has been read.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls} htmlFor="fu-symbol">Symbol</label>
          <input
            id="fu-symbol"
            className={`mt-1 ${field}`}
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="HDFCBANK.NS"
          />
          <p className="mt-1 text-[0.65rem] text-slate-600">
            How the page finds it. Without this the filing is stored and read by nothing.
          </p>
        </div>
        <div>
          <label className={labelCls} htmlFor="fu-identifier">ISIN or CIN</label>
          <input
            id="fu-identifier"
            className={`mt-1 ${field}`}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="INE040A01034"
          />
          <p className="mt-1 text-[0.65rem] text-slate-600">
            Optional, and worth filling in: an identifier survives a rename, a ticker does not.
          </p>
        </div>
        <div>
          <label className={labelCls} htmlFor="fu-industry">What kind of company</label>
          <select
            id="fu-industry"
            className={`mt-1 ${field}`}
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          >
            {INDUSTRIES.map((i) => (
              <option key={i.key} value={i.key} className="bg-ink-900">
                {i.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[0.65rem] text-slate-600">
            Decides which tags mean what. It cannot be read from the document: a filing full of
            deposit tags does not prove the filer is a bank, only that the document says so.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls} htmlFor="fu-period">Period end</label>
            <input
              id="fu-period"
              className={`mt-1 ${field}`}
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              placeholder="2026-03-31"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="fu-scope">Scope</label>
            <select
              id="fu-scope"
              className={`mt-1 ${field}`}
              value={scope}
              onChange={(e) => setScope(e.target.value)}
            >
              <option value="consolidated" className="bg-ink-900">Consolidated</option>
              <option value="standalone" className="bg-ink-900">Standalone</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <label className={labelCls} htmlFor="fu-file">The document</label>
        <input
          id="fu-file"
          type="file"
          accept=".xml,.xbrl,text/xml,application/xml"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void readFile(f);
          }}
          className="mt-1 block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-gold/15 file:px-3 file:py-2 file:text-sm file:font-medium file:text-gold hover:file:bg-gold/25"
        />
        <textarea
          className={`mt-2 h-32 font-mono text-xs ${field}`}
          value={content}
          onChange={(e) => {
            setContent(e.target.value);
            setFileName("");
          }}
          placeholder="or paste the XBRL here"
          spellCheck={false}
        />
        {content ? (
          <p className="mt-1 text-[0.65rem] text-slate-500">
            {fileName ? `${fileName}, ` : ""}
            {content.length.toLocaleString()} characters
          </p>
        ) : null}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={busy || !content.trim() || !companyId}
          onClick={submit}
          className="rounded-lg bg-gold/20 px-4 py-2 text-sm font-medium text-gold transition hover:bg-gold/30 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {busy ? "Reading…" : "Ingest"}
        </button>
        <button
          type="button"
          disabled={checking}
          onClick={runHealth}
          className="rounded-lg border border-white/15 px-3 py-2 text-sm text-slate-300 transition hover:border-gold/40 hover:text-gold disabled:opacity-40"
        >
          {checking ? "Checking…" : "Where is it broken?"}
        </button>
        {companyId ? (
          <span className="font-mono text-[0.65rem] text-slate-500">stored as {companyId}</span>
        ) : (
          <span className="text-[0.65rem] text-slate-600">Give it a symbol or an identifier.</span>
        )}
      </div>

      {health ? <HealthReport health={health} /> : null}
      {result ? <IngestReport result={result} /> : null}
    </GlassCard>
  );
}

/**
 * The chain, link by link, with the first break called out.
 *
 * Everything after the first failure is a consequence of it, so the verdict
 * names one step rather than listing four red rows and leaving the reader to
 * work out which one to fix.
 */
function HealthReport({ health }: { health: HealthResponse }) {
  if (health.error) {
    return (
      <div className="mt-5 rounded-lg border border-down/30 bg-down/[0.06] p-4 text-sm text-slate-200">
        {health.error}
      </div>
    );
  }
  const broken = (health.links ?? []).some((l) => !l.ok);
  return (
    <div
      className={`mt-5 rounded-lg border p-4 ${
        broken ? "border-gold/30 bg-gold/[0.06]" : "border-up/25 bg-up/[0.05]"
      }`}
    >
      <p className="text-sm leading-relaxed text-slate-100">{health.verdict}</p>
      <ul className="mt-3 space-y-2">
        {(health.links ?? []).map((l, i) => (
          <li key={i} className="flex items-start gap-2.5 text-xs">
            <span className={`mt-0.5 flex-none ${l.ok ? "text-up" : "text-down/80"}`}>
              {l.ok ? "\u2713" : "\u2715"}
            </span>
            <span className="min-w-0">
              <span className="text-slate-200">{l.step}</span>
              <span className="text-slate-400">: {l.detail}</span>
              {l.fix ? <span className="mt-0.5 block text-slate-500">{l.fix}</span> : null}
              {l.notes?.length ? (
                <ul className="mt-1 space-y-0.5 font-mono text-[0.65rem] text-slate-600">
                  {l.notes.map((n, j) => (
                    <li key={j}>{n}</li>
                  ))}
                </ul>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The response, in full.
 *
 * Deliberately not summarised down to a tick. The useful part of a first ingest
 * is what the parser did NOT understand, because those tags are precisely the
 * gaps in the alias table for this filer, and a green tick would hide them.
 */
function IngestReport({ result }: { result: IngestResponse }) {
  const failed = result.ok === false;
  return (
    <div
      className={`mt-5 rounded-lg border p-4 ${
        failed ? "border-down/30 bg-down/[0.06]" : "border-up/25 bg-up/[0.05]"
      }`}
    >
      {result.duplicate ? (
        <p className="text-sm text-slate-200">
          Already held. This exact document has been ingested before, which is what should happen
          when the same results arrive from both exchanges.
        </p>
      ) : failed ? (
        <p className="text-sm text-slate-200">{result.error ?? "The document could not be read."}</p>
      ) : (
        <p className="text-sm text-slate-200">
          <span className="font-mono text-white">{result.facts ?? 0}</span> facts published,{" "}
          <span className="font-mono text-white">{result.rejected ?? 0}</span> read and refused.
        </p>
      )}

      {result.rawStored === false ? (
        <p className="mt-2 text-xs leading-relaxed text-slate-400">
          The original was not kept: {result.rawStoreReason} Facts can still be shown, but they
          cannot be checked against the document they came from later.
        </p>
      ) : null}

      {result.unmapped?.length ? (
        <div className="mt-3">
          <div className="text-[0.6rem] uppercase tracking-[0.14em] text-gold/80">
            Tags nothing maps ({result.unmapped.length})
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-400">
            These are concepts this filer uses that the alias table does not know. Each one is a
            figure the document contains and the site is not reading.
          </p>
          <ul className="mt-2 max-h-48 space-y-0.5 overflow-y-auto font-mono text-[0.68rem] text-slate-400">
            {result.unmapped.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.issues?.length ? (
        <div className="mt-3">
          <div className="text-[0.6rem] uppercase tracking-[0.14em] text-slate-500">
            Refused, and why ({result.issues.length})
          </div>
          <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto text-xs text-slate-400">
            {result.issues.map((i, n) => (
              <li key={n}>
                <span className="font-mono text-slate-300">{i.concept}</span>: {i.reason}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {result.filingId ? (
        <p className="mt-3 font-mono text-[0.62rem] text-slate-600">{result.filingId}</p>
      ) : null}
    </div>
  );
}
