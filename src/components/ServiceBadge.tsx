import { paletteFor } from "@/lib/service-colors";

// A coloured pill naming a service (Field Play / Walks). Colour comes from the
// service's index in getServices() — pass `colorIndex` (see serviceColorMap).
// When colorIndex is null/undefined it renders a neutral grey badge.
export function ServiceBadge({
  name,
  colorIndex,
  className = "",
}: {
  name: string;
  colorIndex?: number | null;
  className?: string;
}) {
  const pal = typeof colorIndex === "number" ? paletteFor(colorIndex) : null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${
        pal ? "" : "bg-mist text-muted"
      } ${className}`}
      style={pal ? { backgroundColor: pal.soft, color: pal.softText } : undefined}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: pal ? pal.solid : "#9ca3af" }}
      />
      {name}
    </span>
  );
}

// A bare colour dot for tight spots (e.g. invoice line items).
export function ServiceDot({
  colorIndex,
  className = "",
}: {
  colorIndex?: number | null;
  className?: string;
}) {
  const pal = typeof colorIndex === "number" ? paletteFor(colorIndex) : null;
  return (
    <span
      className={`inline-block h-2.5 w-2.5 shrink-0 rounded-full ${className}`}
      style={{ backgroundColor: pal ? pal.solid : "#9ca3af" }}
    />
  );
}
