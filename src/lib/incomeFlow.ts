// The revenue-and-expenses breakdown: turning an income statement into a flow.
//
// No imports, so scripts/test-income-flow.mjs can compile and drive it alone.
//
// A Sankey is a persuasive picture, and that is exactly the danger: the widths
// are read as facts about the business, so any figure that is guessed, padded or
// silently balanced becomes a false fact drawn to scale. The rules here are
// therefore about conservation rather than presentation:
//
//   • Every flow out of a node sums to the node's own value. Where reported
//     components fall short of their parent, the difference is drawn as an
//     explicit "Other" flow rather than distributed across the named ones. A
//     visible remainder is honest; a padded R&D bar is not.
//   • Nothing is inferred from a missing line. If cost of sales is absent, the
//     diagram does not derive it from revenue minus gross profit ONLY to present
//     it as reported: the derivation is marked, because a derived cost carries
//     every rounding error in both inputs.
//   • A loss is drawn as a loss. Earnings below zero cannot be a flow out of
//     gross profit, so the diagram routes it as its own outgoing node and says
//     the company lost money, instead of an empty space where earnings were.
//
// What this cannot show: revenue by business segment. Yahoo's fundamentals feed
// carries no segment breakdown at all, so the left-hand fan of a Simply Wall St
// diagram (Data Center, Client, Gaming …) has no source here. The diagram starts
// at total revenue and the caption says why, which is better than approximating
// segments from anywhere else.

export interface IncomeLines {
  revenue?: number;
  costOfRevenue?: number;
  grossProfit?: number;
  researchAndDevelopment?: number;
  sellingGeneralAdmin?: number;
  operatingExpense?: number;
  operatingIncome?: number;
  taxProvision?: number;
  pretaxIncome?: number;
  nonOperatingInterest?: number;
  otherNonOperating?: number;
  netIncome?: number;
}

export type FlowKind = "revenue" | "cost" | "profit" | "expense" | "loss";

export interface FlowNode {
  id: string;
  label: string;
  value: number;
  kind: FlowKind;
  /** Column, left to right. */
  depth: number;
  /** True when the figure was derived rather than reported directly. */
  derived?: boolean;
}

export interface FlowLink {
  from: string;
  to: string;
  value: number;
}

export interface IncomeFlow {
  nodes: FlowNode[];
  links: FlowLink[];
  /** False when there is not enough of an income statement to draw anything. */
  ok: boolean;
  reason?: string;
  /** True when the company lost money over the period. */
  loss: boolean;
}

const pos = (x?: number): number | undefined =>
  x != null && isFinite(x) && x > 0 ? x : undefined;

/** Absolute value of a reported figure, which Yahoo signs inconsistently. */
const mag = (x?: number): number | undefined =>
  x != null && isFinite(x) && x !== 0 ? Math.abs(x) : undefined;

/**
 * Build the flow.
 *
 * Shape, mirroring how an income statement actually reads:
 *
 *   Revenue ─┬─ Cost of sales
 *            └─ Gross profit ─┬─ Earnings (or Net loss, routed separately)
 *                             └─ Expenses ─┬─ Research & development
 *                                          ├─ Selling, general & admin
 *                                          ├─ Tax
 *                                          ├─ Non-operating
 *                                          └─ Other
 */
export function buildIncomeFlow(lines: IncomeLines): IncomeFlow {
  const revenue = pos(lines.revenue);
  if (revenue == null) {
    return { nodes: [], links: [], ok: false, loss: false, reason: "no revenue reported" };
  }

  // Gross profit, and the cost of sales that is its complement. Either can be
  // derived from the other, and whichever was derived is marked as such.
  let grossProfit = lines.grossProfit;
  let costOfRevenue = mag(lines.costOfRevenue);
  let grossDerived = false;
  let costDerived = false;
  if (grossProfit == null && costOfRevenue != null) {
    grossProfit = revenue - costOfRevenue;
    grossDerived = true;
  } else if (costOfRevenue == null && grossProfit != null) {
    costOfRevenue = revenue - grossProfit;
    costDerived = true;
  }
  if (grossProfit == null || costOfRevenue == null) {
    return { nodes: [], links: [], ok: false, loss: false, reason: "no gross profit or cost of sales reported" };
  }
  // A negative gross profit (selling below cost) breaks the containment the
  // diagram depends on: cost would exceed revenue and the ribbons would have to
  // cross. Rare, real, and better refused than drawn wrong.
  if (grossProfit <= 0) {
    return {
      nodes: [],
      links: [],
      ok: false,
      loss: true,
      reason: "gross profit is negative, so the flow cannot be drawn to scale",
    };
  }
  costOfRevenue = Math.max(0, costOfRevenue);

  const netIncome = lines.netIncome;
  if (netIncome == null || !isFinite(netIncome)) {
    return { nodes: [], links: [], ok: false, loss: false, reason: "no net income reported" };
  }
  const loss = netIncome < 0;

  // Everything gross profit is consumed by before earnings. For a loss-maker
  // that is more than gross profit itself, by exactly the size of the loss.
  const expenses = grossProfit - netIncome;

  const nodes: FlowNode[] = [
    { id: "revenue", label: "Revenue", value: revenue, kind: "revenue", depth: 0 },
    { id: "cost", label: "Cost of sales", value: costOfRevenue, kind: "cost", depth: 1, derived: costDerived },
    { id: "gross", label: "Gross profit", value: grossProfit, kind: "profit", depth: 1, derived: grossDerived },
  ];
  const links: FlowLink[] = [
    { from: "revenue", to: "cost", value: costOfRevenue },
    { from: "revenue", to: "gross", value: grossProfit },
  ];

  if (expenses > 0) {
    nodes.push({ id: "expenses", label: "Expenses", value: expenses, kind: "expense", depth: 2 });
    // Gross profit can only fund what it is. For a profitable company that is
    // the whole expense block; for a loss-maker it is all of gross profit, and
    // the rest is the loss.
    links.push({ from: "gross", to: "expenses", value: loss ? grossProfit : expenses });
  }

  if (loss) {
    // A loss is a SOURCE of the expense block, not a drain on gross profit.
    //
    // The alternative, hanging it off gross profit like earnings, makes gross
    // profit emit more than it holds: 300 of gross profit cannot pay 380 of
    // costs. Ribbon widths are the diagram's entire claim, so a node that emits
    // more than it contains is drawing a false statement to scale. Placing the
    // loss beside gross profit says the true thing: these costs were funded by
    // gross profit plus the amount the company went down by.
    nodes.push({ id: "earnings", label: "Net loss", value: Math.abs(netIncome), kind: "loss", depth: 1 });
    links.push({ from: "earnings", to: "expenses", value: Math.abs(netIncome) });
  } else if (netIncome > 0) {
    nodes.push({ id: "earnings", label: "Earnings", value: netIncome, kind: "profit", depth: 2 });
    links.push({ from: "gross", to: "earnings", value: netIncome });
  }

  // The named components of the expense block. Each is taken only where it was
  // reported; the remainder becomes one explicit "Other" flow.
  if (expenses > 0) {
    const parts: { id: string; label: string; value: number }[] = [];
    const add = (id: string, label: string, v?: number) => {
      const m = mag(v);
      if (m != null && m > 0) parts.push({ id, label, value: m });
    };
    add("rnd", "Research & development", lines.researchAndDevelopment);
    add("sga", "Selling, general & admin", lines.sellingGeneralAdmin);
    add("tax", "Tax", lines.taxProvision);
    add("nonop", "Non-operating", lines.nonOperatingInterest);

    // Components can exceed the block they belong to: for a loss-maker the loss
    // itself is inside `expenses`, and Yahoo's operating-expense lines overlap
    // in some filings. Scaling them down to fit would silently misstate every
    // one of them, so the diagram drops the named split and shows the total.
    const named = parts.reduce((s, p) => s + p.value, 0);
    if (named > 0 && named <= expenses) {
      for (const p of parts) {
        nodes.push({ id: p.id, label: p.label, value: p.value, kind: "expense", depth: 3 });
        links.push({ from: "expenses", to: p.id, value: p.value });
      }
      const other = expenses - named;
      if (other > expenses * 0.001) {
        nodes.push({ id: "other", label: "Other", value: other, kind: "expense", depth: 3 });
        links.push({ from: "expenses", to: "other", value: other });
      }
    }
  }

  return { nodes, links, ok: true, loss };
}

/** Every node's outgoing links, for checking conservation. */
export function outflow(flow: IncomeFlow, id: string): number {
  return flow.links.filter((l) => l.from === id).reduce((s, l) => s + l.value, 0);
}

export interface LaidOutNode extends FlowNode {
  x: number;
  y: number;
  height: number;
}

export interface LaidOutLink extends FlowLink {
  /** Vertical span where the ribbon leaves its source and meets its target. */
  y0: number;
  y1: number;
  thickness: number;
  x0: number;
  x1: number;
}

export interface Layout {
  nodes: LaidOutNode[];
  links: LaidOutLink[];
  width: number;
  height: number;
}

/**
 * Position the nodes.
 *
 * One column per depth, each column's nodes stacked in the order they were
 * created and separated by a fixed gap. Heights are proportional to value
 * against the largest column total, so a ribbon's thickness means the same
 * thing everywhere in the picture.
 */
export function layoutFlow(
  flow: IncomeFlow,
  opts: { width?: number; height?: number; nodeWidth?: number; gap?: number } = {}
): Layout {
  const width = opts.width ?? 900;
  const height = opts.height ?? 420;
  const nodeWidth = opts.nodeWidth ?? 14;
  const gap = opts.gap ?? 18;

  const depths = Array.from(new Set(flow.nodes.map((n) => n.depth))).sort((a, b) => a - b);
  const maxDepth = depths.length ? depths[depths.length - 1] : 0;

  // The scale: the fullest column decides how many units of value fit the
  // canvas, so no column can overflow and all of them share one ruler.
  let unitsPerPx = 0;
  for (const d of depths) {
    const col = flow.nodes.filter((n) => n.depth === d);
    const total = col.reduce((s, n) => s + n.value, 0);
    const usable = height - gap * Math.max(0, col.length - 1);
    if (usable > 0 && total > 0) unitsPerPx = Math.max(unitsPerPx, total / usable);
  }
  if (unitsPerPx <= 0) return { nodes: [], links: [], width, height };

  const colX = (d: number) => (maxDepth === 0 ? 0 : (d / maxDepth) * (width - nodeWidth));

  const laid: LaidOutNode[] = [];
  for (const d of depths) {
    const col = flow.nodes.filter((n) => n.depth === d);
    const totalPx = col.reduce((s, n) => s + n.value / unitsPerPx, 0) + gap * (col.length - 1);
    let y = (height - totalPx) / 2; // centred, so the picture reads as one band
    for (const n of col) {
      const h = n.value / unitsPerPx;
      laid.push({ ...n, x: colX(d), y, height: h });
      y += h + gap;
    }
  }

  const byId = new Map(laid.map((n) => [n.id, n]));
  // Ribbons leave a node stacked in link order, so they never cross within a node.
  const usedOut = new Map<string, number>();
  const usedIn = new Map<string, number>();
  const links: LaidOutLink[] = [];
  for (const l of flow.links) {
    const a = byId.get(l.from);
    const b = byId.get(l.to);
    if (!a || !b) continue;
    const t = l.value / unitsPerPx;
    const o = usedOut.get(a.id) ?? 0;
    const i = usedIn.get(b.id) ?? 0;
    links.push({
      ...l,
      thickness: t,
      x0: a.x + nodeWidth,
      x1: b.x,
      y0: a.y + o + t / 2,
      y1: b.y + i + t / 2,
    });
    usedOut.set(a.id, o + t);
    usedIn.set(b.id, i + t);
  }

  return { nodes: laid, links, width, height };
}
