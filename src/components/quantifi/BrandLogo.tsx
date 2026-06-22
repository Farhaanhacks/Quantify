// Renders the Quantifi brand mark. Uses /logo-icon.png — the compact Q icon
// that ships on the server and keeps its aspect ratio at any height.
// `object-contain` + `w-auto` prevent any squishing.
export default function BrandLogo({
  className = "h-8",
}: {
  className?: string;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/logo-icon.png"
      alt="Quantifi"
      className={`w-auto object-contain ${className}`}
    />
  );
}
