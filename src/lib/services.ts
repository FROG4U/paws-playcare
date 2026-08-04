import { prisma } from "@/lib/prisma";

// The services the business offers, as first configured with the owner:
//   • Field Play — Mon/Tue/Wed AM, £16 per dog
//   • Walks      — Thu/Fri AM, £16 per dog
// These are only defaults: the admin edits them from /admin/services.
const DEFAULT_SERVICES = [
  { name: "Field Play", pricePerDog: 1600, daysOfWeek: [1, 2, 3], timeSlot: "AM", sortOrder: 0 },
  { name: "Walks", pricePerDog: 1600, daysOfWeek: [4, 5], timeSlot: "AM", sortOrder: 1 },
];

// Return all services, seeding the two defaults the first time (mirrors
// getSettings() auto-creating the settings row).
export async function getServices() {
  const count = await prisma.service.count();
  if (count === 0) {
    await prisma.service.createMany({
      data: DEFAULT_SERVICES.map((s) => ({
        name: s.name,
        pricePerDog: s.pricePerDog,
        daysOfWeek: JSON.stringify(s.daysOfWeek),
        timeSlot: s.timeSlot,
        sortOrder: s.sortOrder,
      })),
    });
  }
  return prisma.service.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] });
}

// Resolve a service from an already-loaded list by id (preferred) or name.
export function serviceForName<T extends { id: string; name: string }>(
  services: T[],
  serviceId: string | null,
  serviceName: string | null
): T | null {
  return (
    services.find((s) => s.id === serviceId) ??
    services.find((s) => s.name === serviceName) ??
    null
  );
}

export function serviceDays(service: { daysOfWeek: string }): number[] {
  try {
    const arr = JSON.parse(service.daysOfWeek);
    return Array.isArray(arr) ? arr.filter((n) => Number.isInteger(n) && n >= 1 && n <= 7) : [];
  } catch {
    return [];
  }
}

// Flat per-dog pricing: £16 × dogs (at least one dog).
export function servicePrice(service: { pricePerDog: number }, numDogs: number): number {
  return service.pricePerDog * Math.max(1, numDogs);
}
