// Shared service colour system. Each service gets one colour, keyed by the
// order services are configured in (getServices()), so Field Play = sky-blue and
// Walks = amber consistently everywhere — the client booking calendar, the admin
// panel, invoices, etc.
//
// This module is intentionally pure (no prisma import) so it is safe to import
// from client components. Server code builds a name→index map with
// `serviceColorMap(await getServices())`.

export type ServicePalette = { soft: string; solid: string; softText: string };

// Explicit hex (applied via inline style) so it renders identically in every
// browser and never depends on a Tailwind colour utility being in the bundle.
export const SERVICE_PALETTE: ServicePalette[] = [
  { soft: "#e2f1fb", solid: "#2ea6d8", softText: "#1c6f95" }, // brand sky-blue
  { soft: "#fbeede", solid: "#e0912e", softText: "#a5620d" }, // amber
  { soft: "#e2f4e9", solid: "#16a34a", softText: "#0e7a36" }, // green
  { soft: "#efe7fb", solid: "#8b5cf6", softText: "#6338c2" }, // violet
];

export function paletteFor(index: number): ServicePalette {
  return SERVICE_PALETTE[((index % SERVICE_PALETTE.length) + SERVICE_PALETTE.length) % SERVICE_PALETTE.length];
}

// Build a { serviceName: colourIndex } map from the ordered service list.
export function serviceColorMap(services: { name: string }[]): Record<string, number> {
  const map: Record<string, number> = {};
  services.forEach((s, i) => {
    map[s.name] = i;
  });
  return map;
}
