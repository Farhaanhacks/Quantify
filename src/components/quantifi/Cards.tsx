import Link from "next/link";
import type { ReactNode } from "react";
import { fmtPct, type Direction } from "@/data/demo";

// ── Type / label primitives ──────────────────────────────────────────────────

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 text-[0.7rem] font-medium uppercase tracking-[0.22em] text-gold/90">
      <span className="h-1 w-1 rounded-full bg-gold" />
      {children}
    </span>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  href,
  cta,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h2 className="mt-3 font-display text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {title}
        </h2>
        {subtitle ? <p className="mt-2 text-sm leading-relaxed text-slate-400">{subtitle}</p> : null}
      </div>
      {href && cta ? (
        <Link
          href={href}
          className="group inline-flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:border-gold/40 hover:text-white"
        >
          {cta}
          <span aria-hidden className="transition group-hover:translate-x-0.5">
            →
          </span>
        </Link>
      ) : null}
    </div>
  );
}

// ── Surfaces ─────────────────────────────────────────────────────────────────

export function GlassCard({
  children,
  className = "",
  hover = false,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
}) {
  return (
    <div
      className={`glass rounded-2xl ${hover ? "glass-hover" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

// ── Market semantics ─────────────────────────────────────────────────────────

export function ChangePill({
  value,
  size = "sm",
}: {
  value: number;
  size?: "sm" | "xs";
}) {
  const up = value >= 0;
  const pad = size === "xs" ? "px-1.5 py-0.5 text-[0.68rem]" : "px-2 py-0.5 text-xs";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md font-medium tnum ${pad} ${
        up ? "bg-up/10 text-up" : "bg-down/10 text-down"
      }`}
    >
      <span aria-hidden>{up ? "▲" : "▼"}</span>
      {fmtPct(value).replace("+", "").replace("-", "")}
    </span>
  );
}

export function TickerChip({
  ticker,
  active = false,
}: {
  ticker: string;
  active?: boolean;
}) {
  return (
    <span
      className={`chip font-mono tnum tracking-tight ${
        active ? "border-gold/40 bg-gold/10 text-gold" : "text-slate-200"
      }`}
    >
      {ticker}
    </span>
  );
}

export function Tag({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "gold" | "teal" | "up" | "down";
}) {
  const tones: Record<string, string> = {
    neutral: "border-white/10 bg-white/5 text-slate-300",
    gold: "border-gold/30 bg-gold/10 text-gold",
    teal: "border-teal/30 bg-teal/10 text-teal",
    up: "border-up/30 bg-up/10 text-up",
    down: "border-down/30 bg-down/10 text-down",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatTile({
  label,
  value,
  sub,
  accent = "default",
}: {
  label: string;
  value: string;
  sub?: ReactNode;
  accent?: "default" | "gold" | "teal" | "up" | "down";
}) {
  const accents: Record<string, string> = {
    default: "text-white",
    gold: "text-gradient-gold",
    teal: "text-gradient-teal",
    up: "text-up",
    down: "text-down",
  };
  return (
    <div className="glass rounded-2xl p-4">
      <div className="text-[0.7rem] uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className={`mt-2 font-display text-2xl font-semibold tnum ${accents[accent]}`}>{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-400">{sub}</div> : null}
    </div>
  );
}

// ── Inline SVG sparkline (no external chart library) ─────────────────────────

export function Sparkline({
  data,
  dir,
  className = "",
}: {
  data: number[];
  dir: Direction;
  className?: string;
}) {
  const w = 120;
  const h = 36;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const span = max - min || 1;
  const stroke = dir === "down" ? "#FB7185" : dir === "flat" ? "#94A3B8" : "#34D399";
  const points = data
    .map((d, i) => {
      const x = (i / (data.length - 1)) * w;
      const y = h - ((d - min) / span) * (h - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const id = `sg-${dir}-${data.length}-${Math.round(data[0])}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className={className}
      preserveAspectRatio="none"
      role="img"
      aria-label="Trend sparkline"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${points} ${w},${h}`} fill={`url(#${id})`} />
      <polyline
        points={points}
        fill="none"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ── Donut (inline SVG) ───────────────────────────────────────────────────────

export function Donut({
  segments,
  size = 168,
  thickness = 18,
  centerLabel,
  centerValue,
}: {
  segments: { name: string; pct: number; color: string }[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label="Allocation donut">
      <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth={thickness}
        />
        {segments.map((seg) => {
          const len = (seg.pct / 100) * circumference;
          const dash = `${len} ${circumference - len}`;
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
            />
          );
          offset += len;
          return el;
        })}
      </g>
      {centerValue ? (
        <text
          x="50%"
          y="47%"
          textAnchor="middle"
          className="fill-white font-display"
          style={{ fontSize: 26, fontWeight: 600 }}
        >
          {centerValue}
        </text>
      ) : null}
      {centerLabel ? (
        <text x="50%" y="60%" textAnchor="middle" className="fill-slate-400" style={{ fontSize: 11 }}>
          {centerLabel}
        </text>
      ) : null}
    </svg>
  );
}

// ── Horizontal bar meter ─────────────────────────────────────────────────────

export function BarMeter({
  label,
  value,
  color = "#E9B872",
  suffix = "%",
}: {
  label: string;
  value: number;
  color?: string;
  suffix?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-mono tnum text-slate-400">
          {value}
          {suffix}
        </span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ── Signature: the Impact Chain ──────────────────────────────────────────────
// Quantifi's defining motif — how one event ripples outward:
// Event → Direct → Peer → Sector → ETF/Index.

export function ImpactChain({
  steps,
}: {
  steps: { label: string; value: string; tone?: "gold" | "teal" | "up" | "down" | "neutral" }[];
}) {
  const toneText: Record<string, string> = {
    gold: "text-gold",
    teal: "text-teal",
    up: "text-up",
    down: "text-down",
    neutral: "text-slate-200",
  };
  return (
    <div className="flex flex-wrap items-stretch gap-2">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-stretch gap-2">
          <div className="glass flex min-w-[7.5rem] flex-col justify-center rounded-xl px-3 py-2">
            <div className="text-[0.62rem] uppercase tracking-[0.16em] text-slate-500">{s.label}</div>
            <div className={`mt-0.5 font-mono text-sm font-medium tnum ${toneText[s.tone ?? "neutral"]}`}>
              {s.value}
            </div>
          </div>
          {i < steps.length - 1 ? (
            <div className="flex items-center" aria-hidden>
              <span className="h-px w-4 bg-gradient-to-r from-gold/60 to-teal/40" />
              <span className="-ml-1 text-gold/70">›</span>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ── Score radar (pentagon) — inline SVG, no chart library ────────────────────

export function ScoreRadar({
  values,
  labels,
  size = 220,
  max = 6,
}: {
  values: number[]; // length 5, each 0..max
  labels: string[]; // length 5
  size?: number;
  max?: number;
}) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.36;
  const n = values.length;
  const angle = (i: number) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const point = (i: number, radius: number) => {
    const a = angle(i);
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)] as const;
  };
  const ring = (frac: number) =>
    values
      .map((_, i) => point(i, r * frac).join(","))
      .join(" ");
  const shape = values
    .map((v, i) => point(i, (Math.max(0, Math.min(max, v)) / max) * r).join(","))
    .join(" ");

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width="100%" height="100%" role="img" aria-label="Quantifi Score radar">
      <defs>
        <linearGradient id="radarFill" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#E9B872" stopOpacity="0.45" />
          <stop offset="100%" stopColor="#4FD1C5" stopOpacity="0.30" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75, 1].map((f) => (
        <polygon
          key={f}
          points={ring(f)}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
      ))}
      {values.map((_, i) => {
        const [x, y] = point(i, r);
        return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
      })}
      <polygon points={shape} fill="url(#radarFill)" stroke="#E9B872" strokeWidth="1.5" />
      {values.map((v, i) => {
        const [x, y] = point(i, (Math.max(0, Math.min(max, v)) / max) * r);
        return <circle key={i} cx={x} cy={y} r="2.5" fill="#F2CD8E" />;
      })}
      {labels.map((label, i) => {
        const [x, y] = point(i, r + 16);
        return (
          <text
            key={label}
            x={x}
            y={y}
            fill="rgba(226,232,240,0.75)"
            fontSize="9"
            fontWeight="600"
            textAnchor={x < cx - 4 ? "end" : x > cx + 4 ? "start" : "middle"}
            dominantBaseline="middle"
          >
            {label}
          </text>
        );
      })}
    </svg>
  );
}
