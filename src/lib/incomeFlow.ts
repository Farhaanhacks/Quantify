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

/**
 * Which reporting structure a company's income statement follows.
 *
 * This exists because the industrial identity
 *
 *   revenue = cost of sales + gross profit
 *
 * is not universal, and treating it as universal was a model-selection bug
 * dressed up as missing data. A bank has no cost of sales: it borrows at one
 * rate, lends at another, and the first line of its account is interest earned.
 * Asking it for a gross profit and refusing to draw anything when it has none
 * rejects a complete, valid statement.
 *
 * The registry is deliberately open. Insurers (premiums earned, claims incurred,
 * underwriting result) and brokers (commissions and fee income) are different
 * again, and each needs its own builder rather than a broadened version of one
 * of these two.
 */
export type IncomeModel = "industrial" | "bank";

/** A bank's account, in the order the statement itself reads. */
export interface BankIncomeLines {
  model: "bank";
  /** Interest earned: the top line of a lender's account. */
  interestIncome?: number;
  /** Interest expended: what it paid depositors and lenders. */
  interestExpense?: number;
  netInterestIncome?: number;
  /** Other income: fees, commissions, treasury and trading. */
  nonInterestIncome?: number;
  operatingExpense?: number;
  /** Provisions and contingencies, in Indian reporting. */
  provisionForLoanLosses?: number;
  pretaxIncome?: number;
  taxProvision?: number;
  netIncome?: number;
  /** Total income, where the components are not published separately. */
  totalIncome?: number;
}

export interface IndustrialIncomeLines {
  model?: "industrial";
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

/** The old name, kept so existing callers and tests do not have to change. */
export type IncomeLines = IndustrialIncomeLines;

export type AnyIncomeLines = IndustrialIncomeLines | BankIncomeLines;

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
  /** Which reporting structure produced this flow. */
  model?: IncomeModel;
  /** True when part of the flow was derived rather than reported line by line. */
  simplified?: boolean;
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
export function buildIndustrialIncomeFlow(lines: IndustrialIncomeLines): IncomeFlow {
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

  return { nodes, links, ok: true, loss, model: "industrial" };
}

/** The old export name, so nothing that imported it has to change. */
export const buildIncomeFlow = buildIndustrialIncomeFlow;


// ── Banks ───────────────────────────────────────────────────────────────────

/**
 * A lender's account, drawn the way a lender reports.
 *
 *   Interest earned ─┬─ Interest expended
 *                    └─ Net interest income ─┐
 *                                            ├─ Operating income ─┬─ Operating expenses
 *                            Other income ───┘                    └─ Pre-provision profit ─┬─ Loan-loss provisions
 *                                                                                          └─ Profit before tax ─┬─ Tax
 *                                                                                                                └─ Net profit
 *
 * Every step is an accounting identity a bank actually publishes, and each is
 * derived only from the two figures on either side of it. Nothing here invents a
 * cost of sales or calls revenue a gross profit: doing either would make the
 * picture render while stating something false about how the business works,
 * which is worse than the empty diagram it replaced.
 *
 * Provisions sit AFTER operating expenses and on their own branch, because that
 * is where Indian reporting puts them: provisions and contingencies are a
 * separate head of expenditure, and pre-provision profit is the figure analysts
 * read precisely because it separates the running of the bank from the credit
 * cycle.
 */
export function buildBankIncomeFlow(lines: BankIncomeLines): IncomeFlow {
  const fail = (reason: string): IncomeFlow => ({
    nodes: [],
    links: [],
    ok: false,
    loss: false,
    model: "bank",
    reason,
  });

  const interestIncome = pos(lines.interestIncome);
  const interestExpense = mag(lines.interestExpense);
  const otherIncome = pos(lines.nonInterestIncome) ?? 0;

  // Net interest income, reported or reconstructed from the two lines that
  // define it. Not derived from anything else: interest earned minus a figure
  // that is not interest expended would not be net interest income.
  let netInterestIncome = pos(lines.netInterestIncome);
  let niiDerived = false;
  if (netInterestIncome == null && interestIncome != null && interestExpense != null) {
    netInterestIncome = interestIncome - interestExpense;
    niiDerived = true;
  }
  if (netInterestIncome == null || netInterestIncome <= 0) {
    // A negative spread is real in a rate shock and cannot be drawn to scale
    // here, for the same reason a negative gross profit cannot.
    return fail(
      netInterestIncome == null
        ? "no net interest income, and not enough of the interest lines to derive it"
        : "net interest income is not positive, so the flow cannot be drawn to scale"
    );
  }

  const operatingIncome = netInterestIncome + otherIncome;
  const netIncome = lines.netIncome;
  const pretax = lines.pretaxIncome;
  const tax = mag(lines.taxProvision);
  const provisions = mag(lines.provisionForLoanLosses);
  const operatingExpense = mag(lines.operatingExpense);

  const nodes: FlowNode[] = [];
  const links: FlowLink[] = [];
  const add = (n: FlowNode) => nodes.push(n);
  const join = (from: string, to: string, value: number) => links.push({ from, to, value });

  // Column 0 and 1: the interest book. Only drawn when both halves are known,
  // since interest earned that splits into one branch is not a split at all.
  let depthShift = 0;
  if (interestIncome != null && interestExpense != null && interestExpense <= interestIncome) {
    add({ id: "interestIncome", label: "Interest earned", value: interestIncome, kind: "revenue", depth: 0 });
    add({ id: "interestExpense", label: "Interest expended", value: interestExpense, kind: "cost", depth: 1 });
    add({
      id: "nii",
      label: "Net interest income",
      value: netInterestIncome,
      kind: "profit",
      depth: 1,
      derived: niiDerived,
    });
    join("interestIncome", "interestExpense", interestExpense);
    join("interestIncome", "nii", netInterestIncome);
    // A reported net interest income does not always equal earned minus
    // expended: the feed can carry the three lines from slightly different
    // bases. The difference is drawn rather than absorbed, because the
    // alternative is either restating a reported figure or letting interest
    // earned emit less than it holds, and both are the kind of quiet
    // adjustment this module exists to avoid.
    const interestGap = interestIncome - interestExpense - netInterestIncome;
    if (Math.abs(interestGap) > interestIncome * 0.001) {
      if (interestGap > 0) {
        add({ id: "interestOther", label: "Other interest items", value: interestGap, kind: "cost", depth: 1 });
        join("interestIncome", "interestOther", interestGap);
      } else {
        // The two outflows exceed the top line, which cannot be drawn as a
        // split at all, so the interest book is dropped and the account starts
        // at net interest income.
        nodes.length = 0;
        links.length = 0;
        add({ id: "nii", label: "Net interest income", value: netInterestIncome, kind: "revenue", depth: 1 });
      }
    }
  } else {
    // Net interest income is where the picture starts when the gross interest
    // lines are not published.
    add({ id: "nii", label: "Net interest income", value: netInterestIncome, kind: "revenue", depth: 1 });
    depthShift = 0;
  }

  if (otherIncome > 0) {
    add({ id: "otherIncome", label: "Other income", value: otherIncome, kind: "revenue", depth: 1 });
  }

  add({ id: "operatingIncome", label: "Operating income", value: operatingIncome, kind: "profit", depth: 2 + depthShift });
  join("nii", "operatingIncome", netInterestIncome);
  if (otherIncome > 0) join("otherIncome", "operatingIncome", otherIncome);

  // Operating expenses and what survives them.
  if (operatingExpense == null || operatingExpense > operatingIncome) {
    // Without a usable cost-to-income split the account stops here rather than
    // guessing at one. An expense figure larger than the income it is deducted
    // from is a sign the line means something else in this filing.
    return {
      nodes,
      links,
      ok: true,
      loss: netIncome != null && netIncome < 0,
      model: "bank",
      simplified: true,
      reason: "operating expenses not reported, so the flow stops at operating income",
    };
  }

  const prePro = operatingIncome - operatingExpense;
  add({ id: "opex", label: "Operating expenses", value: operatingExpense, kind: "expense", depth: 3 });
  add({ id: "preprovision", label: "Pre-provision profit", value: prePro, kind: "profit", depth: 3, derived: true });
  join("operatingIncome", "opex", operatingExpense);
  join("operatingIncome", "preprovision", prePro);

  // Provisions, and profit before tax.
  //
  // Pre-tax profit is preferred as reported and reconstructed only when it is
  // absent, so a filing whose provisions line excludes something we cannot see
  // does not silently move the pre-tax figure.
  let pbt = pos(pretax);
  let prov = provisions;
  if (pbt != null && prov == null) prov = Math.max(0, prePro - pbt);
  if (pbt == null && prov != null) pbt = prePro - prov;
  if (pbt == null || prov == null || prov > prePro) {
    return {
      nodes,
      links,
      ok: true,
      loss: netIncome != null && netIncome < 0,
      model: "bank",
      simplified: true,
      reason: "provisions or pre-tax profit not reported, so the flow stops at pre-provision profit",
    };
  }
  // Reported provisions and a reported pre-tax profit rarely reconcile exactly:
  // exceptional items and share-of-associates sit between them. The gap is
  // carried as its own node rather than folded into either figure.
  const gap = prePro - prov - pbt;
  add({ id: "provisions", label: "Loan-loss provisions", value: prov, kind: "expense", depth: 4 });
  add({ id: "pbt", label: "Profit before tax", value: pbt, kind: "profit", depth: 4 });
  join("preprovision", "provisions", prov);
  join("preprovision", "pbt", pbt);
  if (gap > prePro * 0.001) {
    add({ id: "otherItems", label: "Other items", value: gap, kind: "expense", depth: 4 });
    join("preprovision", "otherItems", gap);
  }

  // Tax and what is left.
  let taxVal = tax;
  let net = netIncome;
  if (net != null && taxVal == null) taxVal = Math.max(0, pbt - net);
  if (net == null && taxVal != null) net = pbt - taxVal;
  if (taxVal == null || net == null || net < 0 || taxVal > pbt) {
    return {
      nodes,
      links,
      ok: true,
      loss: net != null && net < 0,
      model: "bank",
      simplified: true,
      reason: "tax or net profit not reported, so the flow stops at profit before tax",
    };
  }
  add({ id: "tax", label: "Tax", value: taxVal, kind: "expense", depth: 5 });
  add({ id: "netProfit", label: "Net profit", value: net, kind: "profit", depth: 5 });
  join("pbt", "tax", taxVal);
  join("pbt", "netProfit", net);
  const residual = pbt - taxVal - net;
  if (residual > pbt * 0.001) {
    add({ id: "minority", label: "Minority interest & other", value: residual, kind: "expense", depth: 5 });
    join("pbt", "minority", residual);
  }

  return { nodes, links, ok: true, loss: false, model: "bank" };
}

/**
 * The bridge to fall back to when the detailed lines are missing.
 *
 *   Total income ─┬─ Expenses and provisions (derived)
 *                 └─ Profit before tax ─┬─ Tax
 *                                       └─ Net profit
 *
 * The combined node is labelled derived because that is exactly what it is: one
 * subtraction standing in for interest expended, operating expenses and
 * provisions, which are three different things about a bank. It is a bridge from
 * income to profit, not a breakdown, and the section says so.
 */
export function buildSimplifiedBankFlow(lines: BankIncomeLines): IncomeFlow {
  const total =
    pos(lines.totalIncome) ??
    (lines.interestIncome != null && lines.nonInterestIncome != null
      ? pos(lines.interestIncome + lines.nonInterestIncome)
      : pos(lines.interestIncome));
  const pbt = pos(lines.pretaxIncome);
  const net = lines.netIncome;

  if (total == null || pbt == null || net == null || pbt > total) {
    return {
      nodes: [],
      links: [],
      ok: false,
      loss: false,
      model: "bank",
      simplified: true,
      reason: "not enough of the account to bridge income to profit",
    };
  }

  const tax = mag(lines.taxProvision) ?? Math.max(0, pbt - net);
  const combined = total - pbt;
  const nodes: FlowNode[] = [
    { id: "totalIncome", label: "Total income", value: total, kind: "revenue", depth: 0 },
    { id: "combined", label: "Expenses and provisions", value: combined, kind: "expense", depth: 1, derived: true },
    { id: "pbt", label: "Profit before tax", value: pbt, kind: "profit", depth: 1 },
  ];
  const links: FlowLink[] = [
    { from: "totalIncome", to: "combined", value: combined },
    { from: "totalIncome", to: "pbt", value: pbt },
  ];
  if (net >= 0 && tax <= pbt) {
    nodes.push({ id: "tax", label: "Tax", value: tax, kind: "expense", depth: 2 });
    nodes.push({ id: "netProfit", label: "Net profit", value: pbt - tax, kind: "profit", depth: 2 });
    links.push({ from: "pbt", to: "tax", value: tax });
    links.push({ from: "pbt", to: "netProfit", value: pbt - tax });
  }
  return { nodes, links, ok: true, loss: net < 0, model: "bank", simplified: true };
}

/**
 * Pick the builder from the model, and fall back within the bank family only.
 *
 * A bank whose detailed lines are missing gets the simplified bridge; it never
 * gets the industrial builder, because the failure mode being fixed here is
 * exactly that substitution.
 */
export function buildFlowForModel(lines: AnyIncomeLines): IncomeFlow {
  if (lines.model === "bank") {
    const detailed = buildBankIncomeFlow(lines);
    if (detailed.ok) return detailed;
    const bridge = buildSimplifiedBankFlow(lines);
    return bridge.ok ? bridge : detailed;
  }
  return buildIndustrialIncomeFlow(lines);
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
