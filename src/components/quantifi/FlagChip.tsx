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
const box = "inline-block h-3.5 w-5 flex-none overflow-hidden rounded-[2px] ring-1 ring-white/15";

export default function FlagChip({ country }: { country?: string }) {
  const c = (country ?? "").toUpperCase();

  if (c === "IN") {
    return (
      <span className={box} role="img" aria-label="India">
        <svg viewBox="0 0 30 20" className="h-full w-full">
          <rect width="30" height="20" fill="#F0F0F0" />
          <rect width="30" height="6.67" fill="#FF9933" />
          <rect y="13.33" width="30" height="6.67" fill="#138808" />
          <circle cx="15" cy="10" r="2.6" fill="none" stroke="#000080" strokeWidth="0.7" />
        </svg>
      </span>
    );
  }

  if (c === "US") {
    return (
      <span className={box} role="img" aria-label="United States">
        <svg viewBox="0 0 30 20" className="h-full w-full">
          <rect width="30" height="20" fill="#F0F0F0" />
          {[0, 2, 4, 6, 8, 10, 12].map((i) => (
            <rect key={i} y={i * 1.54} width="30" height="1.54" fill="#B22234" />
          ))}
          <rect width="13" height="10.8" fill="#3C3B6E" />
        </svg>
      </span>
    );
  }

  if (!c) return null;
  return (
    <span className="inline-flex h-3.5 flex-none items-center rounded-[2px] bg-white/10 px-1 font-mono text-[0.55rem] leading-none tracking-wide text-slate-300">
      {c}
    </span>
  );
}
