// Squarified treemap layout (Bruls, Huizing & van Wijk).
//
// Plain module, no framework: given a list of weighted items and a rectangle,
// it returns a rectangle per item whose AREA is proportional to its weight,
// choosing rows that keep each tile as close to square as possible. Naive
// slice-and-dice layouts produce slivers you can neither read nor click, which
// is the whole reason this algorithm exists.

export interface TreemapItem {
  id: string;
  value: number;
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlacedRect extends Rect {
  id: string;
  value: number;
}

interface Scaled extends TreemapItem {
  area: number;
}

/**
 * Worst (largest) aspect ratio in a row, given the length of the side the row
 * is laid along. Lower is better — a value of 1 would be perfect squares.
 */
function worstRatio(areas: number[], length: number): number {
  if (!areas.length || length <= 0) return Infinity;
  let sum = 0;
  let max = -Infinity;
  let min = Infinity;
  for (const a of areas) {
    sum += a;
    if (a > max) max = a;
    if (a < min) min = a;
  }
  if (sum <= 0 || min <= 0) return Infinity;
  const l2 = length * length;
  const s2 = sum * sum;
  return Math.max((l2 * max) / s2, s2 / (l2 * min));
}

/**
 * Place one row of items along the short side of `free`, and return what's
 * left over. Laying along the SHORT side is what keeps tiles square-ish.
 */
function layoutRow(row: Scaled[], free: Rect): { placed: PlacedRect[]; rest: Rect } {
  const rowArea = row.reduce((a, b) => a + b.area, 0);
  const placed: PlacedRect[] = [];
  if (rowArea <= 0) return { placed, rest: free };

  if (free.w >= free.h) {
    // Vertical strip down the left edge; items stack top to bottom.
    const w = free.h > 0 ? rowArea / free.h : 0;
    let y = free.y;
    for (const it of row) {
      const h = w > 0 ? it.area / w : 0;
      placed.push({ id: it.id, value: it.value, x: free.x, y, w, h });
      y += h;
    }
    return {
      placed,
      rest: { x: free.x + w, y: free.y, w: Math.max(0, free.w - w), h: free.h },
    };
  }

  // Horizontal strip along the top; items run left to right.
  const h = free.w > 0 ? rowArea / free.w : 0;
  let x = free.x;
  for (const it of row) {
    const w = h > 0 ? it.area / h : 0;
    placed.push({ id: it.id, value: it.value, x, y: free.y, w, h });
    x += w;
  }
  return {
    placed,
    rest: { x: free.x, y: free.y + h, w: free.w, h: Math.max(0, free.h - h) },
  };
}

/**
 * Lay `items` out inside `rect`. Items with a non-positive or non-finite value
 * are dropped — they have no area to occupy and would otherwise divide by zero.
 * Output order follows descending value, not input order.
 */
export function squarify(items: TreemapItem[], rect: Rect): PlacedRect[] {
  if (rect.w <= 0 || rect.h <= 0) return [];
  const usable = items
    .filter((i) => Number.isFinite(i.value) && i.value > 0)
    .sort((a, b) => b.value - a.value);
  if (!usable.length) return [];

  const total = usable.reduce((a, b) => a + b.value, 0);
  const scale = (rect.w * rect.h) / total;
  const scaled: Scaled[] = usable.map((i) => ({ ...i, area: i.value * scale }));

  const out: PlacedRect[] = [];
  let free: Rect = { ...rect };
  let row: Scaled[] = [];
  let rowAreas: number[] = [];

  for (let i = 0; i < scaled.length; ) {
    const next = scaled[i];
    const length = Math.min(free.w, free.h);

    if (row.length === 0) {
      row.push(next);
      rowAreas.push(next.area);
      i++;
      continue;
    }

    // Keep growing the row only while it makes the tiles MORE square.
    if (worstRatio([...rowAreas, next.area], length) <= worstRatio(rowAreas, length)) {
      row.push(next);
      rowAreas.push(next.area);
      i++;
    } else {
      const { placed, rest } = layoutRow(row, free);
      out.push(...placed);
      free = rest;
      row = [];
      rowAreas = [];
      // `next` is retried against the new free rectangle.
    }
  }

  if (row.length) out.push(...layoutRow(row, free).placed);
  return out;
}
