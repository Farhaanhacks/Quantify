"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { squarify, type PlacedRect } from "@/lib/treemap";
import type { HeatmapData, HeatmapTile } from "@/lib/heatmap";
import { REGIONS } from "@/data/heatmapUniverse";

// Our own heatmap, drawn from our own data.
//
// This replaced TradingView's embedded widget for one decisive reason: clicking
// a company there opened tradingview.com, handing our reader to somebody else
// at the exact moment they showed interest in a name. Their `symbolUrl`
// redirect did not hold. Drawing it ourselves means a tile click goes to our
// analysis page, full stop — and no third-party ads sit on our home page.
//
// Sectors are laid out by combined market cap, companies within each sector by
// their own, using a squarified treemap so tiles stay close to square instead
// of degenerating into unreadable slivers.

const SECTOR_HEADER = 22; // px reserved for a sector's title bar
const GAP = 3;

// TradingView's scale reads the same way to anyone who has seen one: saturated
// red through neutral to saturated green, saturating at ±3%.
function tileColor(pct: number): string {
  const p = Math.max(-3, Math.min(3, pct));
  if (Math.abs(p) < 0.05) return "#2f3640";
  const t = Math.abs(p) / 3; // 0..1
  if (p > 0) {
    // #2f3640 → #16a34a → #15803d
    const r = Math.round(47 + (22 - 47) * t);
    const g = Math.round(54 + (163 - 54) * t);
    const b = Math.round(64 + (74 - 64) * t);
    return `rgb(${r},${g},${b})`;
  }
  // #2f3640 → #dc2626 → #991b1b
  const r = Math.round(47 + (220 - 47) * t);
  const g = Math.round(54 + (38 - 54) * t);
  const b = Math.round(64 + (38 - 64) * t);
  return `rgb(${r},${g},${b})`;
}

// Every market the heatmap covers, so a figure is never shown as a bare number
// the reader has to guess the currency of.
const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$", INR: "₹", GBP: "£", GBp: "p", EUR: "€", JPY: "¥",
  HKD: "HK$", CAD: "C$", AUD: "A$", CHF: "CHF ", SGD: "S$",
};

function curSym(currency: string): string {
  return CURRENCY_SYMBOL[currency] ?? (currency ? `${currency} ` : "");
}

function fmtCap(n: number, currency: string): string {
  const sym = curSym(currency);
  const a = Math.abs(n);
  if (a >= 1e12) return `${sym}${(a / 1e12).toFixed(2)}T`;
  if (a >= 1e9) return `${sym}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${sym}${(a / 1e6).toFixed(1)}M`;
  return `${sym}${a.toFixed(0)}`;
}

function fmtPrice(n: number, currency: string): string {
  return `${curSym(currency)}${n.toLocaleString("en-US", { maximumFractionDigits: 2, minimumFractionDigits: 2 })}`;
}

const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

interface Cell {
  tile: HeatmapTile;
  rect: PlacedRect;
}
interface SectorBlock {
  sector: string;
  rect: PlacedRect;
  cells: Cell[];
}

function buildLayout(tiles: HeatmapTile[], width: number, height: number): SectorBlock[] {
  if (!tiles.length || width <= 0 || height <= 0) return [];

  const bySector = new Map<string, HeatmapTile[]>();
  for (const t of tiles) {
    const arr = bySector.get(t.sector);
    if (arr) arr.push(t);
    else bySector.set(t.sector, [t]);
  }

  const sectorRects = squarify(
    [...bySector.entries()].map(([sector, list]) => ({
      id: sector,
      value: list.reduce((s, t) => s + t.marketCap, 0),
    })),
    { x: 0, y: 0, w: width, h: height }
  );

  const blocks: SectorBlock[] = [];
  for (const sr of sectorRects) {
    const list = bySector.get(sr.id) ?? [];
    const inner = {
      x: sr.x + GAP,
      y: sr.y + SECTOR_HEADER,
      w: Math.max(0, sr.w - GAP * 2),
      h: Math.max(0, sr.h - SECTOR_HEADER - GAP),
    };
    const cellRects = squarify(
      list.map((t) => ({ id: t.symbol, value: t.marketCap })),
      inner
    );
    const bySymbol = new Map(list.map((t) => [t.symbol, t]));
    blocks.push({
      sector: sr.id,
      rect: sr,
      cells: cellRects
        .map((rect) => {
          const tile = bySymbol.get(rect.id);
          return tile ? { tile, rect } : null;
        })
        .filter((c): c is Cell => c !== null),
    });
  }
  return blocks;
}

export default function MarketHeatmap({ initial }: { initial: HeatmapData }) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<HeatmapData>(initial);
  const [region, setRegion] = useState<string>(initial.region);
  const [loading, setLoading] = useState(false);
  const [width, setWidth] = useState(0);
  const [hover, setHover] = useState<{ tile: HeatmapTile; x: number; y: number } | null>(null);

  const height = width > 900 ? 620 : width > 620 ? 520 : 460;

  // Measure the container so the treemap can be laid out in real pixels.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const set = () => setWidth(el.clientWidth);
    set();
    const ro = new ResizeObserver(set);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const switchRegion = useCallback(
    async (next: string) => {
      if (next === region) return;
      const previous = region;
      setRegion(next);
      setLoading(true);
      try {
        const r = await fetch(`/api/heatmap?region=${encodeURIComponent(next)}`);
        const d = (await r.json()) as HeatmapData;
        if (d && Array.isArray(d.tiles)) setData(d);
        else setRegion(previous);
      } catch {
        // Leave the previous picture up rather than blanking it, and put the
        // toggle back where it was so the label matches what is on screen.
        setRegion(previous);
      } finally {
        setLoading(false);
      }
    },
    [region]
  );

  const blocks = useMemo(
    () => buildLayout(data.tiles, width, height),
    [data.tiles, width, height]
  );

  const open = (symbol: string) => {
    // The whole point of drawing this ourselves.
    router.push(`/stock-analysis?symbol=${encodeURIComponent(symbol)}`);
  };

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* Nine markets, so this wraps rather than forcing a horizontal
            scroll on a phone. */}
        <div className="flex flex-wrap items-center gap-1 rounded-full border border-white/10 bg-white/[0.03] p-0.5 text-xs">
          {REGIONS.map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => switchRegion(r.key)}
              className={
                region === r.key
                  ? "rounded-full bg-gold/20 px-2.5 py-1 font-medium text-gold"
                  : "rounded-full px-2.5 py-1 text-slate-400 transition hover:text-white"
              }
            >
              {r.label}
            </button>
          ))}
        </div>
        <span className="text-[0.68rem] text-slate-500">
          Top {data.tiles.length} by market cap · coloured by today&apos;s move
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-[0.62rem] text-slate-500">
          <span>-3%</span>
          {[-3, -2, -1, 0, 1, 2, 3].map((p) => (
            <span
              key={p}
              className="inline-block h-3 w-5 rounded-[2px]"
              style={{ backgroundColor: tileColor(p) }}
            />
          ))}
          <span>+3%</span>
        </span>
      </div>

      <div
        ref={wrapRef}
        className="relative w-full overflow-hidden rounded-lg border border-white/[0.08] bg-ink-900"
        style={{ height }}
        onMouseLeave={() => setHover(null)}
      >
        {!data.live ? (
          <div className="grid h-full place-items-center px-6 text-center text-sm text-slate-500">
            Live market data is temporarily unavailable, so the heatmap has nothing real to
            draw. It will fill in on the next refresh.
          </div>
        ) : null}

        {loading ? (
          <div className="absolute inset-0 z-20 grid place-items-center bg-ink/60 text-sm text-slate-400">
            Loading {data.regionLabel === region ? data.regionLabel : (REGIONS.find((r) => r.key === region)?.label ?? region)}…
          </div>
        ) : null}

        {blocks.map((b) => (
          <div key={b.sector}>
            {/* Sector title bar */}
            <div
              className="absolute truncate px-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.1em] text-slate-400"
              style={{ left: b.rect.x + GAP, top: b.rect.y + 4, width: Math.max(0, b.rect.w - GAP * 2) }}
            >
              {b.sector}
            </div>
            {b.cells.map(({ tile, rect }) => {
              const showTicker = rect.w > 34 && rect.h > 20;
              const showPct = rect.w > 52 && rect.h > 34;
              return (
                <button
                  key={tile.symbol}
                  type="button"
                  onClick={() => open(tile.symbol)}
                  onMouseEnter={(e) =>
                    setHover({ tile, x: e.clientX, y: e.clientY })
                  }
                  onMouseMove={(e) => setHover({ tile, x: e.clientX, y: e.clientY })}
                  title={`${tile.name} — open analysis`}
                  aria-label={`${tile.name}, ${fmtPct(tile.changePct)}, open analysis`}
                  className="absolute flex flex-col items-center justify-center overflow-hidden rounded-[2px] leading-none transition hover:z-10 hover:ring-2 hover:ring-white/70"
                  style={{
                    left: rect.x,
                    top: rect.y,
                    width: Math.max(0, rect.w - 1),
                    height: Math.max(0, rect.h - 1),
                    backgroundColor: tileColor(tile.changePct),
                  }}
                >
                  {showTicker ? (
                    <span
                      className="max-w-full truncate px-0.5 font-semibold text-white"
                      style={{ fontSize: Math.min(15, Math.max(8, rect.w / 5.5)) }}
                    >
                      {tile.symbol.replace(/\.(NS|BO)$/, "")}
                    </span>
                  ) : null}
                  {showPct ? (
                    <span
                      className="mt-0.5 max-w-full truncate px-0.5 text-white/85"
                      style={{ fontSize: Math.min(12, Math.max(7, rect.w / 7.5)) }}
                    >
                      {fmtPct(tile.changePct)}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Hover detail — the tab that follows the cursor. */}
      {hover ? (
        <div
          /* Opaque, not translucent: this sits on top of saturated red and
             green tiles, and at 95% the colour beneath bled through enough to
             wash the figures out. */
          className="pointer-events-none fixed z-[80] flex items-center gap-4 rounded-lg border border-white/20 px-3.5 py-2.5 shadow-2xl"
          style={{
            backgroundColor: "#0b0f18",
            left: Math.min(Math.max(12, hover.x + 16), (typeof window !== "undefined" ? window.innerWidth : 1200) - 330),
            top: Math.min(hover.y + 16, (typeof window !== "undefined" ? window.innerHeight : 800) - 90),
          }}
        >
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-white">
              {hover.tile.symbol.replace(/\.(NS|BO)$/, "")}
            </div>
            <div className="max-w-[15rem] truncate text-[0.68rem] text-slate-400">
              {hover.tile.name}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm text-white">
              {fmtPrice(hover.tile.price, hover.tile.currency)}
            </div>
            <div className="text-[0.6rem] uppercase tracking-wide text-slate-500">Price</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-sm text-white">
              {fmtCap(hover.tile.marketCap, hover.tile.currency)}
            </div>
            <div className="text-[0.6rem] uppercase tracking-wide text-slate-500">Market cap</div>
          </div>
          <div className="text-right">
            <div
              className={`font-mono text-sm ${hover.tile.changePct >= 0 ? "text-up" : "text-down"}`}
            >
              {fmtPct(hover.tile.changePct)}
            </div>
            <div className="text-[0.6rem] uppercase tracking-wide text-slate-500">Change 1D</div>
          </div>
        </div>
      ) : null}

      <p className="mt-2 text-[0.68rem] text-slate-500">
        Live quotes as of {data.asOf}. Click any company to open its Quantifi analysis.
      </p>
    </div>
  );
}
