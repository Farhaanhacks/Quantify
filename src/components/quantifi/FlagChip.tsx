// A country marker that renders the same everywhere.
//
// Emoji flags (🇮🇳, 🇺🇸) are pairs of regional-indicator characters, and Windows
// ships no font that composes them — so on Windows they appear as the bare
// letters "IN" and "US". That is precisely the thing the flags were added to
// replace, and it is invisible to anyone testing on a Mac.
//
// So the two markets this app actually covers get drawn as small SVGs, and
// anywhere else falls back to a tidy two-letter chip rather than a broken
// glyph. Drawn rather than fetched: an <img> per row would be a network request
// each, and a strict CSP blocks the usual flag CDNs anyway.
import { displayCountry } from "@/lib/listingCountry";

// 21x14 is exactly 3:2, the ratio the Indian and most other flags are defined
// at. The old 20x14 squashed every flag by 5%.
const box =
  "inline-block h-3.5 w-[21px] flex-none overflow-hidden rounded-[2px] ring-1 ring-white/15";

/** The Ashoka Chakra's 24 spokes, in radians. */
const SPOKES = Array.from({ length: 24 }, (_, i) => (i * 15 * Math.PI) / 180);

export default function FlagChip({ country, symbol }: { country?: string; symbol?: string }) {
  // Fall back to the symbol's exchange suffix. Rows restored from localStorage
  // predate the `country` field, so trusting it alone left half a list of
  // recently-viewed companies with no flag while the rest had one.
  const c = symbol ? displayCountry({ country, symbol }) : (country ?? "").toUpperCase();

  if (c === "IN") {
    return (
      <span className={box} role="img" aria-label="India">
        {/* Drawn to the flag's actual spec: 3:2, three equal bands, and an
            Ashoka Chakra with its 24 spokes. The chakra used to be a bare ring,
            which reads as a wrong flag the moment anyone looks closely. At chip
            size the spokes blur into a blue wheel, which is what the real flag
            does when you shrink it. */}
        <svg viewBox="0 0 60 40" className="h-full w-full" preserveAspectRatio="none">
          <rect width="60" height="40" fill="#FFFFFF" />
          <rect width="60" height="13.333" fill="#FF9933" />
          <rect y="26.667" width="60" height="13.333" fill="#138808" />
          <g stroke="#000080" fill="none" strokeWidth="0.45">
            <circle cx="30" cy="20" r="5.6" />
            {SPOKES.map((a, i) => (
              <line
                key={i}
                x1={30}
                y1={20}
                x2={30 + 5.6 * Math.cos(a)}
                y2={20 + 5.6 * Math.sin(a)}
              />
            ))}
          </g>
          <circle cx="30" cy="20" r="1.15" fill="#000080" />
        </svg>
      </span>
    );
  }

  if (c === "US") {
    return (
      <span className={box} role="img" aria-label="United States">
        <svg viewBox="0 0 30 20" className="h-full w-full" preserveAspectRatio="none">
          <rect width="30" height="20" fill="#F0F0F0" />
          {[0, 2, 4, 6, 8, 10, 12].map((i) => (
            <rect key={i} y={i * 1.54} width="30" height="1.54" fill="#B22234" />
          ))}
          <rect width="13" height="10.8" fill="#3C3B6E" />
        </svg>
      </span>
    );
  }

  // An empty slot rather than nothing. Returning null collapsed the row, so a
  // list where one listing's exchange wasn't recognised had its names stepping
  // in and out by 20px down the column — the "disorganised" look.
  if (!c) return <span className={`${box} bg-white/[0.06] ring-white/10`} aria-hidden="true" />;

  return (
    <span className="inline-flex h-3.5 flex-none items-center rounded-[2px] bg-white/10 px-1 font-mono text-[0.55rem] leading-none tracking-wide text-slate-300">
      {c}
    </span>
  );
}
