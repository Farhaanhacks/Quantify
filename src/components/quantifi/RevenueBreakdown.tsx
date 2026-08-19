"use client";

import { useEffect, useMemo, useState } from "react";
import { GlassCard } from "@/components/quantifi/Cards";
import { currencySymbol } from "@/data/demo";
import { layoutFlow, type IncomeFlow, type FlowKind } from "@/lib/incomeFlow";

// Revenue and expenses, drawn as a flow.
//
// The whole point of the picture is that width means money, so hovering a ribbon
// dims the rest and names both ends: a reader who wants the number should not
// have to estimate it from a thickness. Everything drawn comes from the reported
// annual statement, and anything the statement does not contain is either absent
// or labelled, never filled in.

const NODE_W = 13;
const CANVAS_H = 380;

// How wide the drawing is, in its own coordinates.
//
// A bank's account is six columns where an industrial one is four, and a label
// is drawn beside its node rather than under it, so the same canvas that reads
// cleanly for four columns runs "Profit before tax" straight through "Net
// profit" for six. Widening the viewBox rather than shrinking the text keeps
// the labels legible: the SVG scales to its container either way, so the effect
// is that a longer account is drawn at a smaller scale, which is what a longer
// account needs.
const COLUMN_WIDTH = 190;
const MIN_WIDTH = 900;
const canvasWidth = (columns: number) =>
  Math.max(MIN_WIDTH, columns * COLUMN_WIDTH + 140);

const FILL: Record<FlowKind, string> = {
  revenue: "#4F93F7",
  cost: "#E0A63C",
  profit: "#4FD1C5",
  expense: "#E0A63C",
  loss: "#F87171",
};

interface Payload {
  available: boolean;
  message?: string;
  name?: string;
  currency?: string;
  periodEnd?: string;
  model?: "industrial" | "bank";
  industry?: string;
  flow?: IncomeFlow;
  /** The reported lines, so a table can stand in where a diagram cannot. */
  statement?: Record<string, number | undefined>;
}

// What each reported line is called, for the fallback table. Ordered as the
// statement reads rather than alphabetically, so it can be followed downwards.
const LINE_LABELS: [string, string][] = [
  ["interestIncome", "Interest earned"],
  ["interestExpense", "Interest expended"],
  ["netInterestIncome", "Net interest income"],
  ["nonInterestIncome", "Other income"],
  ["revenue", "Total income"],
  ["costOfRevenue", "Cost of sales"],
  ["grossProfit", "Gross profit"],
  ["researchAndDevelopment", "Research & development"],
  ["sellingGeneralAdmin", "Selling, general & admin"],
  ["operatingExpense", "Operating expenses"],
  ["provisionForLoanLosses", "Provisions & contingencies"],
  ["operatingIncome", "Operating income"],
  ["pretaxIncome", "Profit before tax"],
  ["taxProvision", "Tax"],
  ["netIncome", "Net profit"],
];

function money(n: number, sym: string): string {
  const a = Math.abs(n);
  const s = n < 0 ? "-" : "";
  if (a >= 1e12) return `${s}${sym}${(a / 1e12).toFixed(2)}t`;
  if (a >= 1e9) return `${s}${sym}${(a / 1e9).toFixed(2)}b`;
  if (a >= 1e6) return `${s}${sym}${(a / 1e6).toFixed(1)}m`;
  if (a >= 1e3) return `${s}${sym}${(a / 1e3).toFixed(1)}k`;
  return `${s}${sym}${Math.round(a)}`;
}

/** A ribbon: a cubic curve whose thickness is the flow's value. */
function ribbonPath(x0: number, y0: number, x1: number, y1: number, t: number): string {
  const cx = (x0 + x1) / 2;
  const half = t / 2;
  return [
    `M${x0},${y0 - half}`,
    `C${cx},${y0 - half} ${cx},${y1 - half} ${x1},${y1 - half}`,
    `L${x1},${y1 + half}`,
    `C${cx},${y1 + half} ${cx},${y0 + half} ${x0},${y0 + half}`,
    "Z",
  ].join(" ");
}

export default function RevenueBreakdown({ symbol, name }: { symbol: string; name?: string }) {
  const [data, setData] = useState<Payload | null | undefined>(undefined);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(undefined);
    setHover(null);
    (async () => {
      try {
        const res = await fetch(`/api/income-flow/${encodeURIComponent(symbol)}`);
        const json = (await res.json()) as Payload;
        if (!cancelled) setData(json);
      } catch {
        if (!cancelled) setData(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [symbol]);

  const laid = useMemo(() => {
    if (!data?.flow?.ok) return null;
    const columns = new Set(data.flow.nodes.map((n) => n.depth)).size;
    return layoutFlow(data.flow, {
      width: canvasWidth(columns),
      height: CANVAS_H,
      nodeWidth: NODE_W,
      gap: 20,
    });
  }, [data]);

  if (data === undefined) {
    return (
      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <div className="h-72 animate-pulse rounded-lg border border-white/[0.06] bg-white/[0.02]" />
      </section>
    );
  }
  if (!data || !data.available || !laid) {
    // A diagram that cannot be drawn is not a reason to show nothing. Where the
    // statement came back but its shape defeats every model we have, the lines
    // themselves are still the answer to the question the section asks.
    const rows = data?.statement
      ? LINE_LABELS.filter(([k]) => data.statement?.[k] != null)
      : [];
    const fallbackSym = currencySymbol(data?.currency);
    return (
      <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
        <h3 className="font-display text-lg font-semibold text-white">Revenue &amp; expenses breakdown</h3>
        <GlassCard className="mt-3 p-5">
          <p className="text-sm text-slate-400">
            {data?.message ?? "The income statement for this listing isn't available right now."}
          </p>
          {rows.length ? (
            <>
              <table className="mt-4 w-full border-collapse text-sm">
                <tbody>
                  {rows.map(([k, label]) => (
                    <tr key={k} className="border-b border-white/[0.05]">
                      <td className="py-1.5 pr-4 text-slate-400">{label}</td>
                      <td className="py-1.5 text-right font-mono tnum text-slate-200">
                        {money(data!.statement![k]!, fallbackSym)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-[0.65rem] text-slate-500">
                The reported lines for {data?.periodEnd ?? "the latest year"}, shown as filed.
              </p>
            </>
          ) : null}
        </GlassCard>
      </section>
    );
  }

  const sym = currencySymbol(data.currency);
  const who = data.name ?? name ?? symbol;
  const byId = new Map(laid.nodes.map((n) => [n.id, n]));

  // Label positions, nudged apart within each column.
  //
  // A node's label wants to sit at its middle, which works until two thin nodes
  // are neighbours: tax at 620m and non-operating at 66m are a few pixels tall,
  // and their two-line labels land on top of each other. Walking each column top
  // to bottom and pushing every label at least LABEL_MIN below the previous one
  // keeps the text readable while leaving the ribbons, which carry the actual
  // quantities, exactly where they are.
  const LABEL_MIN = 30;
  const labelY = new Map<string, number>();
  for (const depth of Array.from(new Set(laid.nodes.map((n) => n.depth)))) {
    const col = laid.nodes.filter((n) => n.depth === depth).sort((a, b) => a.y - b.y);
    let floor = -Infinity;
    for (const n of col) {
      const y = Math.max(n.y + n.height / 2, floor + LABEL_MIN);
      labelY.set(n.id, y);
      floor = y;
    }
  }
  // Labels sit outside the first and last columns and inside the middle ones, so
  // nothing overlaps the ribbons at either edge.
  const lastX = Math.max(...laid.nodes.map((n) => n.x));

  return (
    <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
      <h3 className="font-display text-lg font-semibold text-white">Revenue &amp; expenses breakdown</h3>
      <p className="mt-1 text-xs text-slate-500">
        How {who} makes and spends money, from the annual statement to
        {data.periodEnd ? ` ${data.periodEnd}` : " the latest reported year"}.
        {data.model === "bank"
          ? " Read as a lender's account: interest earned and expended, then provisions as their own head of expenditure."
          : ""}
      </p>
      {data.flow?.simplified ? (
        <p className="mt-2 text-[0.7rem] text-gold">
          Part of this account is not published line by line, so the diagram stops where the
          reported figures stop, and any node marked derived is one subtraction standing in for
          several items.
        </p>
      ) : null}

      <GlassCard className="mt-4 p-4 sm:p-6">
        <div className="overflow-x-auto">
          <svg
            viewBox={`0 0 ${laid.width} ${CANVAS_H + 40}`}
            className="w-full"
            style={{ minWidth: Math.min(laid.width, 760) }}
            role="img"
            aria-label="Revenue and expenses flow"
          >
            <g transform="translate(0,20)">
              {laid.links.map((l, i) => {
                const active = hover === null || hover === i;
                const target = byId.get(l.to);
                return (
                  <path
                    key={`${l.from}-${l.to}`}
                    d={ribbonPath(l.x0, l.y0, l.x1, l.y1, Math.max(1, l.thickness))}
                    fill={FILL[target?.kind ?? "expense"]}
                    opacity={active ? 0.28 : 0.07}
                    onMouseEnter={() => setHover(i)}
                    onMouseLeave={() => setHover(null)}
                    style={{ transition: "opacity 0.15s", cursor: "pointer" }}
                  />
                );
              })}

              {laid.nodes.map((n) => {
                const atEnd = n.x >= lastX - 0.01;
                const atStart = n.x <= 0.01;
                const labelX = atEnd ? n.x - 8 : n.x + NODE_W + 8;
                const anchor = atEnd ? "end" : "start";
                const mid = labelY.get(n.id) ?? n.y + n.height / 2;
                return (
                  <g key={n.id}>
                    <rect
                      x={n.x}
                      y={n.y}
                      width={NODE_W}
                      height={Math.max(2, n.height)}
                      rx={2}
                      fill={FILL[n.kind]}
                    />
                    {Math.abs(mid - (n.y + n.height / 2)) > 4 ? (
                      <line
                        x1={atEnd ? n.x : n.x + NODE_W}
                        y1={n.y + n.height / 2}
                        x2={atEnd ? n.x - 5 : n.x + NODE_W + 5}
                        y2={mid}
                        stroke="rgba(255,255,255,0.18)"
                        strokeWidth="1"
                      />
                    ) : null}
                    <text
                      x={atStart ? n.x + NODE_W + 8 : labelX}
                      y={mid - 4}
                      textAnchor={atStart ? "start" : anchor}
                      className="fill-slate-200"
                      style={{ fontSize: 12, fontWeight: 500 }}
                    >
                      {n.label}
                    </text>
                    <text
                      x={atStart ? n.x + NODE_W + 8 : labelX}
                      y={mid + 11}
                      textAnchor={atStart ? "start" : anchor}
                      className="fill-slate-400"
                      style={{ fontSize: 11 }}
                    >
                      {money(n.value, sym)}
                      {n.derived ? " (derived)" : ""}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        <div className="mt-2 min-h-[1.25rem] text-xs text-slate-400">
          {hover != null && laid.links[hover] ? (
            <>
              <span className="text-slate-300">
                {byId.get(laid.links[hover].from)?.label} to {byId.get(laid.links[hover].to)?.label}
              </span>
              <span className="ml-2 font-mono tnum text-white">
                {money(laid.links[hover].value, sym)}
              </span>
            </>
          ) : (
            <span className="text-slate-500">Hover a ribbon for the amount it carries.</span>
          )}
        </div>
      </GlassCard>

      <p className="mt-3 text-[0.65rem] leading-relaxed text-slate-500">
        {data.model === "bank"
          ? "A bank has no cost of sales, so there is no gross profit here and none is invented: the account runs from interest earned through net interest income and other income to operating income, and provisions sit on their own branch after operating expenses, which is where the reporting standards put them. "
          : ""}
        Revenue is shown as one figure rather than split by business line: segment
        revenue appears in the company&apos;s own filings and not in the data feed behind this page,
        and estimating it would be inventing the most interesting part of the picture. Where a line
        is marked derived it was calculated from the two figures around it rather than reported
        directly. Any gap between the named expenses and their total is drawn as &quot;Other&quot;
        instead of being shared out, so no bar is wider than the company reported.
      </p>
    </section>
  );
}
