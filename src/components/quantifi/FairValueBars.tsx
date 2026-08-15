"use client";

import { useEffect, useState } from "react";
import { fmtPrice } from "@/data/demo";

interface Point {
  d: string;
  v: number;
  p: number;
  // Reconstructed from that year's reported cash flow rather than recorded on
  // the day. See lib/fairValueBackfill for exactly what is and isn't historical.
  modelled?: boolean;
}

// Share price against the cash-flow (DCF) value, drawn as two bars on one scale
// so the gap between them is the message. The longer bar is the bigger number;
// the shaded strip between the two marks the over/undervaluation.
export function FairValueBars({
  price,
  fair,
  cur,
  outOfRange = false,
  fairLabel = "Fair Value",
  note,
  outOfRangeTitle = "Beyond a 10-year DCF horizon",
  outOfRangeNote = "Shown as context — the model can't support an over/under call here.",
}: {
  price: number;
  fair: number;
  cur: string;
  outOfRange?: boolean;
  /** What the second bar is called — "Fair Value", "Sector Fair Value", … */
  fairLabel?: string;
  /** Method footnote under the bars. Omit to show none. */
  note?: string;
  outOfRangeTitle?: string;
  outOfRangeNote?: string;
}) {
  const max = Math.max(price, fair) || 1;
  // Never let the smaller bar vanish entirely — at extreme ratios a 0.5% bar is
  // invisible, and the reader loses the anchor for the label sitting on it.
  const pct = (v: number) => Math.max(4, (v / max) * 100);
  const over = price > fair;
  const gapPct = fair > 0 ? ((price - fair) / fair) * 100 : 0;

  return (
    <div>
      {!outOfRange ? (
        <div className="mb-3">
          <div className={`font-display text-3xl font-semibold ${over ? "text-down" : "text-up"}`}>
            {Math.abs(gapPct).toFixed(1)}%
          </div>
          <div className={`text-sm font-medium ${over ? "text-down" : "text-up"}`}>
            {over ? "Overvalued" : "Undervalued"}
          </div>
        </div>
      ) : (
        <div className="mb-3">
          <div className="font-display text-lg font-semibold text-slate-300">{outOfRangeTitle}</div>
          <div className="text-sm text-slate-500">{outOfRangeNote}</div>
        </div>
      )}

      <div className="space-y-2">
        <Bar
          label="Current Price"
          value={price}
          cur={cur}
          widthPct={pct(price)}
          tone={outOfRange ? "neutral" : over ? "down" : "up"}
        />
        <Bar label={fairLabel} value={fair} cur={cur} widthPct={pct(fair)} tone="fair" />
      </div>

      {note ? (
        <p className="mt-3 text-[0.7rem] leading-relaxed text-slate-500">{note}</p>
      ) : null}
    </div>
  );
}

function Bar({
  label,
  value,
  cur,
  widthPct,
  tone,
}: {
  label: string;
  value: number;
  cur: string;
  widthPct: number;
  tone: "up" | "down" | "fair" | "neutral";
}) {
  const fill =
    tone === "fair"
      ? "bg-gradient-to-r from-up/70 to-up/25"
      : tone === "down"
      ? "bg-gradient-to-r from-down/60 to-down/20"
      : tone === "up"
      ? "bg-gradient-to-r from-up/60 to-up/20"
      : "bg-gradient-to-r from-white/15 to-white/[0.06]";

  return (
    <div className="relative h-14 overflow-hidden rounded-md bg-white/[0.03]">
      <div className={`absolute inset-y-0 left-0 ${fill}`} style={{ width: `${widthPct}%` }} />
      {/* The label sits inside the bar when there's room, and just outside it
          when the bar is too short to hold the text. */}
      <div
        className={`absolute inset-y-0 flex flex-col justify-center ${
          widthPct > 34 ? "items-end pr-3" : "items-start pl-3"
        }`}
        style={widthPct > 34 ? { left: 0, width: `${widthPct}%` } : { left: `${widthPct}%` }}
      >
        <span className="whitespace-nowrap text-[0.68rem] uppercase tracking-[0.12em] text-slate-400">
          {label}
        </span>
        <span className="whitespace-nowrap font-mono text-base font-semibold tnum text-white">
          {cur}
          {fmtPrice(value)}
        </span>
      </div>
    </div>
  );
}

// The recorded history of the cash-flow value against the share price. The
// series accumulates one point per day and cannot be back-filled, so until it
// has a few days in it we say so rather than drawing a line from one point.
export function FairValueHistoryChart({
  symbol,
  cur,
}: {
  symbol: string;
  cur: string;
}) {
  const [points, setPoints] = useState<Point[] | null>(null);
  // Whether the deployment can record history at all (KV configured server-side).
  const [recording, setRecording] = useState(true);
  // Why the reconstruction produced nothing, when it did.
  const [reason, setReason] = useState("");

  useEffect(() => {
    let cancelled = false;
    setPoints(null);
    fetch(`/api/fair-value-history/${encodeURIComponent(symbol)}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setPoints(Array.isArray(d?.points) ? d.points : []);
        setRecording(d?.recording !== false);
        setReason(typeof d?.reason === "string" ? d.reason : "");
      })
      .catch(() => !cancelled && setPoints([]));
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  if (points == null) {
    return <div className="mt-4 h-32 animate-pulse rounded-lg bg-white/[0.03]" />;
  }

  const latest = points[points.length - 1];
  const gap = latest && latest.v > 0 ? ((latest.v - latest.p) / latest.v) * 100 : 0;

  const modelledCount = points.filter((p) => p.modelled).length;
  const recordedCount = points.length - modelledCount;
  const spanDays =
    points.length >= 2
      ? (Date.parse(points[points.length - 1].d) - Date.parse(points[0].d)) / 86_400_000
      : 0;

  // Two points a day apart are not a history. Drawn, they became two flat
  // parallel lines carrying no information at all, which is worse than an empty
  // state: it looks like a chart and says nothing. Wait for a reconstruction, a
  // couple of weeks of drift, or a handful of readings before drawing anything.
  const worthDrawing =
    points.length >= 2 && (modelledCount > 0 || points.length >= 5 || spanDays >= 14);

  if (!worthDrawing) {
    // Nowhere to write to means the series can never fill, however long you
    // wait. Say that plainly instead of repeating "starts building from today"
    // every day forever.
    if (!recording) {
      return (
        <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-5 text-center">
          <p className="text-sm text-slate-300">History isn&apos;t being recorded.</p>
          <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
            This deployment has no storage connected, so each day&apos;s cash-flow value is
            computed and then discarded. Connect a KV database and set{" "}
            <span className="font-mono text-slate-400">KV_REST_API_URL</span> and{" "}
            <span className="font-mono text-slate-400">KV_REST_API_TOKEN</span>, and the series
            will start filling from that day on.
          </p>
        </div>
      );
    }
    // Say which of the reconstruction's requirements this company fails, rather
    // than showing the same sentence to everyone and leaving them to guess.
    const why: Record<string, string> = {
      "no-statements":
        "There are fewer than two years of reported cash-flow statements for this company, so there is no cycle to reconstruct from.",
      "no-prices":
        "Price history isn't available for this listing, so past years can't be paired with what the shares actually cost.",
      "cash-negative":
        "This company's cash flow was negative through the cycle in every year on record — the model has no positive base to value those years on. Today's estimate comes from consensus forward earnings instead, which isn't available for past years.",
      "no-book":
        "This is a lender, so it's valued on book value and return on equity rather than cash flow — and fewer than two years of reported shareholders' equity are available to reconstruct from.",
      "too-few":
        "Only one past year could be valued, and a single point isn't a line.",
      unavailable:
        "The financial statements couldn't be reached just now, so the earlier years haven't been reconstructed.",
    };
    return (
      <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-5 text-center">
        <p className="text-sm text-slate-300">
          {recordedCount > 0
            ? `${recordedCount} reading${recordedCount === 1 ? "" : "s"} recorded so far.`
            : "History starts building from today."}
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
          {why[reason] ??
            "Each day's cash-flow value is recorded as it's computed, and past years are reconstructed from reported statements where the data allows."}{" "}
          {recordedCount > 0
            ? "A chart appears once there is enough of a run to show movement — two readings a day apart would just be two flat lines."
            : "From here it's recorded daily, so the line fills in as the valuation is recomputed."}
        </p>
      </div>
    );
  }

  const W = 720;
  const H = 140;
  const pad = 8;
  const all = points.flatMap((p) => [p.v, p.p]);
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = hi - lo || 1;
  // Spaced by date, not by index. The series now mixes annual reconstructed
  // points with daily recorded ones, and on an index axis a twelve-month gap
  // drew the same width as an overnight one — which made a year of drift look
  // like a single day's move.
  const t = (d: string) => Date.parse(d);
  const t0 = t(points[0].d);
  const tSpan = Math.max(1, t(points[points.length - 1].d) - t0);
  const X = (d: string) => pad + ((t(d) - t0) / tSpan) * (W - 2 * pad);
  const Y = (v: number) => H - pad - ((v - lo) / span) * (H - 2 * pad);
  const seg = (key: "v" | "p", from: number, to: number) =>
    points
      .slice(from, to)
      .map((p) => `${X(p.d)},${Y(p[key])}`)
      .join(" ");

  return (
    <div className="mt-4 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h4 className="font-display text-sm font-semibold text-white">
          Future cash flow value history
        </h4>
        <div className="flex flex-wrap items-center gap-4 text-[0.7rem]">
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-gold" /> Share price
            <span className="font-mono text-slate-300">
              {cur}
              {fmtPrice(latest.p)}
            </span>
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="h-2 w-2 rounded-full bg-teal" /> Cash flow value
            <span className="font-mono text-slate-300">
              {cur}
              {fmtPrice(latest.v)}
            </span>
          </span>
          <span className={gap > 0 ? "text-up" : "text-down"}>
            {Math.abs(gap).toFixed(1)}% {gap > 0 ? "undervalued" : "overvalued"}
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label="Cash flow value history">
        {/* Reconstructed years are dashed, recorded days solid, so the chart
            never passes a back-test off as an observation. The two share a
            point at the join so the line doesn't break. */}
        {modelledCount > 0 ? (
          <>
            <polyline
              points={seg("v", 0, modelledCount)}
              fill="none"
              stroke="#4FD1C5"
              strokeWidth="2"
              strokeDasharray="4 3"
              strokeOpacity="0.75"
            />
            <polyline
              points={seg("p", 0, modelledCount)}
              fill="none"
              stroke="#D4AF37"
              strokeWidth="2"
              strokeDasharray="4 3"
              strokeOpacity="0.75"
            />
          </>
        ) : null}
        {recordedCount > 0 ? (
          <>
            <polyline
              points={seg("v", Math.max(0, modelledCount - 1), points.length)}
              fill="none"
              stroke="#4FD1C5"
              strokeWidth="2"
            />
            <polyline
              points={seg("p", Math.max(0, modelledCount - 1), points.length)}
              fill="none"
              stroke="#D4AF37"
              strokeWidth="2"
            />
          </>
        ) : null}
      </svg>

      <p className="mt-2 text-[0.62rem] leading-relaxed text-slate-600">
        {modelledCount > 0 ? (
          <>
            {modelledCount} point{modelledCount === 1 ? "" : "s"} reconstructed from reported
            financial years — each year&apos;s own free cash flow, valued by the same model,
            against the share price on the day that year closed. Today&apos;s share count and
            rates are used throughout, so read them as a back-test, not as what the model showed
            at the time.
            {recordedCount > 0
              ? ` ${recordedCount} recorded live since then.`
              : " Recorded points are added daily from here."}
          </>
        ) : (
          <>
            {points.length} day{points.length === 1 ? "" : "s"} recorded · builds as the valuation
            is recomputed
          </>
        )}
      </p>
    </div>
  );
}
