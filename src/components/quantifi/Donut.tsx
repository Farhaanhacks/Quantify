"use client";

import { useState } from "react";

// Shared ownership palette. Kept in one place so the fund ring and the
// institutional ring do not colour the same holder differently on one page.
export const OWNERSHIP_PALETTE = ["#818CF8", "#4F93F7", "#4FD1C5", "#34D399", "#F472B6", "#FB7185", "#94A3B8"];

// Interactive donut + legend: hovering a slice (or its legend row) dims the other
// arcs and shows that segment's % + name in the centre; with nothing hovered the
// centre shows an idle headline (e.g. the dominant holder). Both the arcs and the
// legend drive the same hover state, so either one highlights the pair.
export function InteractiveDonut({
  segments,
  size = 150,
  thickness = 18,
  idleValue,
  idleLabel,
}: {
  segments: { name: string; pct: number; color: string }[];
  size?: number;
  thickness?: number;
  idleValue: string;
  idleLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  const total = segments.reduce((s, x) => s + (x.pct > 0 ? x.pct : 0), 0);
  const denom = Math.max(100, total); // never over-fill the ring
  const active = hover != null ? segments[hover] : null;
  const bigText = active ? `${active.pct.toFixed(2)}%` : idleValue;
  const smallText = active
    ? active.name.length > 16
      ? `${active.name.slice(0, 15)}…`
      : active.name
    : idleLabel;
  let offset = 0;

  return (
    <div className="flex w-full flex-col items-center gap-5 sm:flex-row">
      <div className="flex-none" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Ownership donut">
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
            {segments.map((seg, i) => {
              const len = (Math.max(0, seg.pct) / denom) * circ;
              const dash = `${len} ${circ - len}`;
              const el = (
                <circle
                  key={seg.name}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={thickness}
                  strokeDasharray={dash}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                  opacity={hover == null || hover === i ? 1 : 0.3}
                  onMouseEnter={() => setHover(i)}
                  onMouseLeave={() => setHover(null)}
                  style={{ cursor: "pointer", transition: "opacity 0.15s" }}
                />
              );
              offset += len;
              return el;
            })}
          </g>
          <text x="50%" y="46%" textAnchor="middle" dominantBaseline="middle" className="fill-white font-display font-semibold" style={{ fontSize: 22 }}>
            {bigText}
          </text>
          <text x="50%" y="61%" textAnchor="middle" dominantBaseline="middle" className="fill-slate-400" style={{ fontSize: 11 }}>
            {smallText}
          </text>
        </svg>
      </div>
      <ul className="w-full min-w-0 flex-1 space-y-1">
        {segments.map((s, i) => (
          <li
            key={s.name}
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover(null)}
            className={`flex cursor-default items-center justify-between gap-2 rounded-md px-2 py-1 text-xs transition ${
              hover === i ? "bg-white/[0.05]" : ""
            }`}
          >
            <span className="flex min-w-0 items-center gap-2 text-slate-300">
              <span className="h-2 w-2 flex-none rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="truncate">{s.name}</span>
            </span>
            <span className="flex-none font-mono tnum text-slate-400">{s.pct.toFixed(2)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
