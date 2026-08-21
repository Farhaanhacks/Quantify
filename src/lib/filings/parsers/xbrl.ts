// Reading facts out of an XBRL instance document.
//
// No imports, and that is a decision rather than a constraint.
//
// A general XML library would have been fewer lines, but this parser is fed
// documents that arrive from an exchange feed or, worse, from an upload box, and
// a general parser resolves things a hostile document can control. A DOCTYPE
// with nested entity definitions expands to gigabytes from a few hundred bytes;
// an external entity reads a file off the server and returns it in a fact. Both
// are one-line attacks against a parser that is only trying to be helpful. A
// scanner that understands nothing except elements, attributes and text cannot
// be made to do either, and this file rejects a DOCTYPE outright rather than
// relying on a library flag someone might change later.
//
// It is also importless so scripts/test-filings.mjs can compile and drive it
// against saved fixtures — which matters more here than anywhere else in the
// codebase, because the only honest way to develop this without a licensed feed
// is against documents that have been read by eye first.

export interface XbrlContext {
  id: string;
  /** A duration's start, absent for an instant. */
  startDate?: string;
  /** A duration's end, or the instant itself. */
  endDate?: string;
  instant?: string;
  /** Dimension/member pairs from the segment or scenario. */
  dimensions: Record<string, string>;
  /** Consolidated or standalone, where the context says. */
  scope?: "standalone" | "consolidated";
}

export interface XbrlFact {
  /** The tag exactly as written, prefix and all. */
  tag: string;
  contextRef: string;
  unitRef?: string;
  /** Raw text between the tags, before any number parsing. */
  raw: string;
  value?: number;
  /** True when the filer tagged the fact as explicitly absent. */
  nil: boolean;
  decimals?: string;
  /** Position in the document, so a reader can be sent to it. */
  offset: number;
}

export interface XbrlDocument {
  contexts: Map<string, XbrlContext>;
  /** Unit id to its measure, e.g. "INR", "pure", "shares". */
  units: Map<string, string>;
  facts: XbrlFact[];
  /** Scope declared for the document as a whole, where one is. */
  documentScope?: "standalone" | "consolidated";
  errors: string[];
}

/** A document larger than this is not parsed. Filings are not this big. */
const MAX_BYTES = 24 * 1024 * 1024;

const attr = (attrs: string, name: string): string | undefined => {
  const m = attrs.match(new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, "i")) ??
    attrs.match(new RegExp(`\\b${name}\\s*=\\s*'([^']*)'`, "i"));
  return m ? m[1] : undefined;
};

const local = (tag: string): string => {
  const noNs = tag.replace(/^\{[^}]*\}/, "");
  return (noNs.includes(":") ? noNs.slice(noNs.lastIndexOf(":") + 1) : noNs).trim();
};

/** Text between the first matching pair of a tag, ignoring the namespace. */
function inner(block: string, name: string): string | undefined {
  const re = new RegExp(`<(?:[\\w.-]+:)?${name}\\b[^>]*>([\\s\\S]*?)</(?:[\\w.-]+:)?${name}>`, "i");
  const m = block.match(re);
  return m ? m[1].trim() : undefined;
}

/**
 * Which set of books a context belongs to.
 *
 * Indian filers say this two ways and neither is guaranteed: a dimension on the
 * context, or a separate element naming the whole document. Both are read, and
 * where neither is present the scope stays undefined rather than defaulting.
 * Defaulting would be the worst option available — a consolidated loan book
 * divided by a standalone deposit base is a ratio that looks entirely normal and
 * is simply wrong, which is exactly the class of error the validator downstream
 * exists to refuse.
 */
function scopeFromDimensions(dimensions: Record<string, string>): "standalone" | "consolidated" | undefined {
  for (const [dim, member] of Object.entries(dimensions)) {
    const d = local(dim).toLowerCase();
    const m = local(member).toLowerCase();
    if (!d.includes("consolidat") && !d.includes("separate") && !d.includes("standalone")) continue;
    if (m.includes("consolidat")) return "consolidated";
    if (m.includes("standalone") || m.includes("separate") || m.includes("entity")) return "standalone";
  }
  return undefined;
}

export function parseXbrl(xml: string): XbrlDocument {
  const doc: XbrlDocument = {
    contexts: new Map(),
    units: new Map(),
    facts: [],
    errors: [],
  };

  if (typeof xml !== "string" || !xml.trim()) {
    doc.errors.push("Empty document.");
    return doc;
  }
  if (xml.length > MAX_BYTES) {
    doc.errors.push(`Document larger than ${Math.round(MAX_BYTES / 1024 / 1024)}MB.`);
    return doc;
  }
  // No DOCTYPE, no entity declarations, no exceptions. A filing has no
  // legitimate need for either, and both are how an XML parser is turned into a
  // file reader or a memory bomb.
  if (/<!DOCTYPE/i.test(xml) || /<!ENTITY/i.test(xml)) {
    doc.errors.push("Document declares a DOCTYPE or entities; refused.");
    return doc;
  }

  // Comments and CDATA are stripped first so neither can hide a tag from the
  // scanner or present one that is not really there.
  const body = xml
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_m, t) => String(t).replace(/[<>&]/g, " "));

  // ── Contexts ──────────────────────────────────────────────────────────────
  const contextRe = /<(?:[\w.-]+:)?context\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?context>/gi;
  for (let m = contextRe.exec(body); m; m = contextRe.exec(body)) {
    const id = attr(m[1], "id");
    if (!id) continue;
    const block = m[2];
    const dimensions: Record<string, string> = {};
    const memberRe = /<(?:[\w.-]+:)?explicitMember\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?explicitMember>/gi;
    for (let d = memberRe.exec(block); d; d = memberRe.exec(block)) {
      const dim = attr(d[1], "dimension");
      if (dim) dimensions[dim] = d[2].trim();
    }
    const instant = inner(block, "instant");
    const ctx: XbrlContext = {
      id,
      startDate: inner(block, "startDate"),
      endDate: inner(block, "endDate") ?? instant,
      instant,
      dimensions,
    };
    ctx.scope = scopeFromDimensions(dimensions);
    doc.contexts.set(id, ctx);
  }

  // ── Units ─────────────────────────────────────────────────────────────────
  const unitRe = /<(?:[\w.-]+:)?unit\b([^>]*)>([\s\S]*?)<\/(?:[\w.-]+:)?unit>/gi;
  for (let m = unitRe.exec(body); m; m = unitRe.exec(body)) {
    const id = attr(m[1], "id");
    if (!id) continue;
    const measure = inner(m[2], "measure");
    // "iso4217:INR" carries the currency; "xbrli:pure" is a ratio.
    doc.units.set(id, measure ? local(measure) : "");
  }

  // ── Document-level scope ──────────────────────────────────────────────────
  const declared =
    inner(body, "NatureOfReportStandaloneConsolidated") ??
    inner(body, "WhetherResultsAreStandaloneOrConsolidated") ??
    inner(body, "NatureOfReport");
  if (declared) {
    const d = declared.toLowerCase();
    if (d.includes("consolidat")) doc.documentScope = "consolidated";
    else if (d.includes("standalone") || d.includes("separate")) doc.documentScope = "standalone";
  }

  // ── Facts ─────────────────────────────────────────────────────────────────
  //
  // Anything carrying a contextRef is a fact. Both forms are matched: a normal
  // element with text, and a self-closing one, which is how a filer says the
  // figure is genuinely absent rather than zero.
  const factRe =
    /<([A-Za-z_][\w.-]*(?::[\w.-]+)?)((?:\s+[\w:.-]+\s*=\s*(?:"[^"]*"|'[^']*'))*\s*)(\/)?>/g;
  for (let m = factRe.exec(body); m; m = factRe.exec(body)) {
    const tag = m[1];
    const attrs = m[2] ?? "";
    const selfClosing = !!m[3];
    const contextRef = attr(attrs, "contextRef");
    if (!contextRef) continue;
    // The structural elements carry contextRef-like attributes in some
    // taxonomies; they are not facts.
    const name = local(tag).toLowerCase();
    if (name === "context" || name === "unit") continue;

    let raw = "";
    if (!selfClosing) {
      const close = body.indexOf(`</${tag}>`, factRe.lastIndex);
      raw = close === -1 ? "" : body.slice(factRe.lastIndex, close).trim();
    }
    const nilAttr = attr(attrs, "xsi:nil") ?? attr(attrs, "nil");
    const nil = selfClosing || nilAttr === "true";

    const fact: XbrlFact = {
      tag,
      contextRef,
      unitRef: attr(attrs, "unitRef"),
      raw,
      nil,
      decimals: attr(attrs, "decimals"),
      offset: m.index,
    };
    if (!nil) {
      const parsed = parseXbrlNumber(raw, attr(attrs, "sign"));
      if (parsed != null) fact.value = parsed;
    }
    doc.facts.push(fact);
  }

  if (!doc.facts.length) doc.errors.push("No facts found; the document may not be XBRL.");
  return doc;
}

/**
 * A number as XBRL writes it.
 *
 * The sign lives in an attribute rather than in the text, which is the one piece
 * of this format that reliably catches people out: a fact of 4,521 with
 * sign="-" is a loss of 4,521, and reading the text alone turns every loss into
 * a profit. Parentheses are accepted too, since HTML-derived facts reach this
 * function as well and accountants have written negatives that way for
 * centuries.
 */
export function parseXbrlNumber(text: string, sign?: string): number | undefined {
  if (typeof text !== "string") return undefined;
  let t = text.trim();
  if (!t) return undefined;
  let negative = sign === "-";
  if (/^\(.*\)$/.test(t)) {
    negative = !negative;
    t = t.slice(1, -1).trim();
  }
  // Indian grouping ("1,23,45,678") and Western grouping both reduce to the same
  // digits once separators go; the placement differs but the value does not.
  t = t.replace(/[,\s  ]/g, "");
  if (/^-/.test(t)) {
    negative = !negative;
    t = t.slice(1);
  }
  if (!/^\d*\.?\d+(?:[eE][+-]?\d+)?$/.test(t)) return undefined;
  const n = Number(t);
  if (!isFinite(n)) return undefined;
  return negative ? -n : n;
}
