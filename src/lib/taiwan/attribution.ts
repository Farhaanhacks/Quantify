// The attribution the licence requires, in one place so the API response and
// the rendered page cannot say different things.
//
// Both exchanges publish these datasets under the Taiwan Government Open Data
// Licence 1.0, which permits commercial use — including redistribution in a
// product like this one — on condition that the source is credited. That credit
// is not a footnote we might get to: it is the term under which the data may be
// shown at all, so it ships next to the data itself.
export const TAIWAN_ATTRIBUTION = {
  source: "Taiwan Stock Exchange / Taipei Exchange",
  licence: "Taiwan Government Open Data Licence 1.0",
  licenceUrl: "https://data.gov.tw/license",
} as const;

/** The single line to render under any view of this data. */
export const TAIWAN_ATTRIBUTION_LINE = `Source: ${TAIWAN_ATTRIBUTION.source} · Licensed under the ${TAIWAN_ATTRIBUTION.licence}`;
