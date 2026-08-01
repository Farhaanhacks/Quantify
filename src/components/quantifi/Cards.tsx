import Link from "next/link";
import type { ReactNode } from "react";
import { fmtPct, type Direction } from "@/data/demo";

// ── Type / label primitives ──────────────────────────────────────────────────

export function Eyebrow({ children }: { children: ReactNode }) {
  // Plain uppercase label — no pill/capsule. Section differentiation comes from
  // the heading weight and spacing below, not a badge.
  return (
    <span className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-gold/90">
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
  title?: string;
  subtitle?: string;
  href?: string;
  cta?: string;
}) {
  return (
    <div className="flex scroll-mt-24 flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl">
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        {title ? (
          <h2 className={`${eyebrow ? "mt-2 " : ""}font-display text-[1.6rem] font-bold leading-[1.15] tracking-tight text-white sm:text-[1.85rem]`}>
            {title}
          </h2>
        ) : null}
        {subtitle ? (
          <p className={`${title || eyebrow ? "mt-2 " : ""}text-[0.95rem] leading-relaxed text-slate-400`}>
            {subtitle}
          </p>
        ) : null}
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
  onClick,
}: {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      className={`glass rounded-lg ${hover ? "glass-hover" : ""} ${className}`}
      onClick={onClick}
    >
      {children}
    </div>
  );
}

// ── Loading placeholders ─────────────────────────────────────────────────────

// A single shimmering bar. Sized by the caller so a skeleton can mirror the
// shape of whatever it stands in for (a price, a ticker chip, a table cell).
export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`relative block overflow-hidden rounded bg-white/[0.06] ${className}`}
    >
      <span className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />
    </span>
  );
}

// A skeleton table: the same header + divided rows every data card uses, so the
// first paint has the real layout rather than a lone "Loading…" line. `cols` are
// the grid track widths; the first column is treated as the label (chip + name)
// and the rest as right-aligned figures, matching every data card on the site.
export function SkeletonTable({
  rows = 5,
  cols = ["1.4fr", "0.8fr", "1fr"],
  headers,
  className = "",
}: {
  rows?: number;
  cols?: string[];
  headers?: string[];
  className?: string;
}) {
  const gridTemplateColumns = cols.join(" ");
  return (
    <div className={`glass rounded-lg overflow-hidden ${className}`} aria-busy="true">
      {headers ? (
        <div
          className="hidden gap-3 border-b border-white/[0.06] px-5 py-3 text-[0.62rem] uppercase tracking-[0.16em] text-slate-500 sm:grid"
          style={{ gridTemplateColumns }}
        >
          {headers.map((h, i) => (
            <span key={h} className={i === 0 ? "" : "text-right"}>
              {h}
            </span>
          ))}
        </div>
      ) : null}
      <ul className="divide-y divide-white/[0.05]">
        {Array.from({ length: rows }).map((_, r) => (
          <li key={r} className="grid items-center gap-3 px-5 py-4" style={{ gridTemplateColumns }}>
            {cols.map((_c, i) =>
              i === 0 ? (
                <span key={i} className="flex items-center gap-2.5">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="hidden h-3 w-24 sm:block" />
                </span>
              ) : (
                <span key={i} className="flex justify-end">
                  <Skeleton className="h-3.5 w-12" />
                </span>
              )
            )}
          </li>
        ))}
      </ul>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

// ── Sample / preview framing ─────────────────────────────────────────────────

// Wraps a module that's rendering illustrative figures because the visitor has
// no data of their own yet. The badge and footer are non-negotiable: the numbers
// inside are examples, and the UI has to say so plainly before it says anything
// else.
export function SamplePreview({
  children,
  note,
  cta,
  href,
  className = "",
}: {
  children: ReactNode;
  note: string;
  cta: string;
  href: string;
  className?: string;
}) {
  return (
    <div className={className}>
      {/* The dashed frame carries the "this isn't yours yet" signal, and the
          badge straddles its top edge — so nothing ever sits on top of a number
          the way an overlaid badge would. */}
      <div className="relative rounded-xl border border-dashed border-gold/25 bg-gold/[0.02] p-3 pt-5 sm:p-4 sm:pt-6">
        {/* Painted with the page background so it reads as a notch cut into the
            dashed border, in either theme. */}
        <span className="absolute -top-3 right-5 inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-[var(--bg)] px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-gold">
          <span className="h-1.5 w-1.5 rounded-full bg-gold" />
          Sample data
        </span>

        <div className="pointer-events-none select-none opacity-[0.85]" aria-hidden>
          {children}
        </div>
      </div>

      <div className="mt-4 flex flex-col items-center gap-3 rounded-lg border border-white/[0.08] bg-white/[0.02] px-5 py-4 text-center sm:flex-row sm:justify-between sm:text-left">
        <p className="text-sm text-slate-300">{note}</p>
        <Link
          href={href}
          className="inline-flex flex-none rounded-full bg-gradient-to-r from-gold-400 to-gold-600 px-5 py-2.5 text-sm font-semibold text-ink transition hover:opacity-90"
        >
          {cta}
        </Link>
      </div>
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
      // A pill is a single short label — never let it break mid-word into a
      // vertical stack of letters when it's squeezed against a narrow edge.
      className={`inline-flex flex-none items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.7rem] font-medium ${tones[tone]}`}
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
    <div className="glass rounded-lg p-4">
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
  // Guard against overlapping arcs: if the segments sum past 100% (bad ownership
  // data — e.g. institutions + insiders + float coming to 108%), scale them down
  // so the ring never over-fills. When they sum ≤ 100 we keep the partial ring.
  const total = segments.reduce((s, x) => s + (x.pct > 0 ? x.pct : 0), 0);
  const denom = Math.max(100, total);
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
          const len = (Math.max(0, seg.pct) / denom) * circumference;
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
  color = "#4F93F7",
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
          <div className="glass flex min-w-[7.5rem] flex-col justify-center rounded-lg px-3 py-2">
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

// Split a multi-word axis label ("Balance Sheet Strength") into (up to) two
// balanced lines so it stacks under its spoke instead of overflowing the SVG
// and getting clipped ("alance Sheet Strength"). Single words stay on one line.
function wrapAxisLabel(label: string): string[] {
  const words = label.split(" ");
  if (words.length <= 1) return [label];
  let splitAt = 1;
  let bestWidth = Infinity;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ").length;
    const b = words.slice(i).join(" ").length;
    const widest = Math.max(a, b);
    if (widest < bestWidth) {
      bestWidth = widest;
      splitAt = i;
    }
  }
  return [words.slice(0, splitAt).join(" "), words.slice(splitAt).join(" ")];
}

export function ScoreRadar({
  values,
  labels,
  size = 220,
  max = 6,
  color,
}: {
  values: number[]; // length 5, each 0..max
  labels: string[]; // length 5
  size?: number;
  max?: number;
  /** Accent for the filled shape. Defaults to a score-derived colour: a strong
   *  company reads green, a middling one amber, a weak one red — so the snowflake
   *  communicates quality at a glance instead of always looking the same. */
  color?: string;
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

  // Stay in the gold family (brand palette) but vary the tone by average score:
  // bright champagne for a strong company, deep antique gold for a weak one. Same
  // rich gold-on-black look, still readable as a quality signal at a glance.
  const avg = values.length ? values.reduce((s, v) => s + v, 0) / values.length / max : 0;
  const accent = color ?? (avg >= 0.66 ? "#E7C873" : avg >= 0.4 ? "#D4AF37" : "#8A6B2F");
  // Unique gradient id per accent so two radars on one page can't collide.
  const gid = `radarFill-${accent.replace("#", "")}`;

  return (
    <svg viewBox={`-62 -20 ${size + 124} ${size + 44}`} width="100%" height="100%" role="img" aria-label="Quantifi Score radar">
      <defs>
        <radialGradient id={gid} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={accent} stopOpacity="0.85" />
          <stop offset="100%" stopColor={accent} stopOpacity="0.5" />
        </radialGradient>
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
      <polygon points={shape} fill={`url(#${gid})`} stroke={accent} strokeWidth="2" strokeLinejoin="round" />
      {values.map((v, i) => {
        const [x, y] = point(i, (Math.max(0, Math.min(max, v)) / max) * r);
        return <circle key={i} cx={x} cy={y} r="3" fill="#fff" stroke={accent} strokeWidth="1.5" />;
      })}
      {labels.map((label, i) => {
        const [x, y] = point(i, r + 16);
        const lines = wrapAxisLabel(label);
        const lineH = 10;
        const dy0 = -((lines.length - 1) * lineH) / 2; // vertically centre the stack
        return (
          <text
            key={label}
            x={x}
            y={y}
            fill="rgba(226,232,240,0.85)"
            fontSize="10"
            fontWeight="600"
            textAnchor={x < cx - 4 ? "end" : x > cx + 4 ? "start" : "middle"}
            dominantBaseline="middle"
          >
            {lines.map((ln, li) => (
              <tspan key={li} x={x} dy={li === 0 ? dy0 : lineH}>
                {ln}
              </tspan>
            ))}
          </text>
        );
      })}
    </svg>
  );
}
