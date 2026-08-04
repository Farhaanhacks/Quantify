// Turning an EDGAR filing document into readable prose. Kept free of Next
// imports so it can be exercised directly by tests.

// EDGAR documents are HTML with heavy inline styling and (on older filings)
// nested tables. We want the prose, so scripts/styles go first, block-level tags
// become newlines, and the rest is stripped and collapsed.
//
// The critical step is dropping inline XBRL. Since 2019 filings embed an
// <ix:header> block — usually inside a display:none div — holding every tagged
// fact and its context declarations. Rendered as text that reads as pages of
// "0000320193 2026-01-29 us-gaap:CommonStockMember aapl:A1.625NotesDue2026Member",
// which is machine metadata, not the announcement.
export function htmlToText(html: string): string {
  return html
    .replace(/<ix:header[\s\S]*?<\/ix:header>/gi, " ")
    .replace(/<ix:hidden[\s\S]*?<\/ix:hidden>/gi, " ")
    .replace(/<ix:resources[\s\S]*?<\/ix:resources>/gi, " ")
    .replace(/<ix:references[\s\S]*?<\/ix:references>/gi, " ")
    // Anything the filer hid from the rendered document is hidden for a reason.
    .replace(/<div[^>]*display\s*:\s*none[^>]*>[\s\S]*?<\/div>/gi, " ")
    .replace(/<(xbrli?|xbrldi|link|xlink):[\s\S]*?>/gi, " ")
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|tr|h[1-6]|li|table)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&rsquo;|&apos;/gi, "’")
    .replace(/&quot;|&ldquo;|&rdquo;/gi, "\"")
    .replace(/&#\d+;/g, " ")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n\s*\n\s*\n+/g, "\n\n")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .trim();
}

// An 8-K opens with a cover page — the SEC address block, the registrant table,
// the emerging-growth checkboxes — and closes with a signature block. The part
// worth reading is the numbered item in between, so when we can find the item
// heading we start there and stop at the signature.
export function focusOnItem(text: string, item?: string): string {
  let out = text;
  const escaped = item ? item.replace(/\./g, "\\.") : "\\d\\.\\d\\d";
  // The cover page names the item too, so prefer the LAST occurrence — that's
  // the actual section heading rather than the table-of-contents mention.
  const re = new RegExp(`Item\\s+${escaped}[.:\\s]`, "gi");
  const hits = [...out.matchAll(re)];
  if (hits.length) {
    const start = hits[hits.length - 1].index ?? 0;
    // Only jump if there is a real body after it; otherwise keep the whole text.
    if (out.length - start > 120) out = out.slice(start);
  }
  const sig = out.search(/\n\s*SIGNATURES?\s*\n/i);
  if (sig > 120) out = out.slice(0, sig);
  return out.trim();
}
