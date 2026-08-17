import { prisma } from "@/lib/prisma";
import { walkPriceFor } from "@/lib/dog-pricing";

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

export const DAY_NAMES: Record<number, string> = {
  1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday",
  5: "Friday", 6: "Saturday", 7: "Sunday",
};
export const SLOT_TAG: Record<string, string> = { AM: "AM", LUNCH: "lunch", PM: "PM" };
export const SLOT_WORDS: Record<string, string> = {
  AM: "mornings", LUNCH: "lunch time", PM: "afternoons",
};

type SlotService = { name: string; daysOfWeek: string; timeSlot: string; active: boolean };

// The walk a client can ask for at sign-up: one per service day, e.g.
// "Field Play — Monday (AM)". The label IS the stored value (registration has
// always saved the readable label), so the admin's approvals editor and the
// sign-up form must build these the same way — hence this shared helper.
export function requestedWalkOptions(services: SlotService[]) {
  const out: { value: string; serviceName: string; day: number }[] = [];
  for (const s of services.filter((s) => s.active)) {
    for (const d of serviceDays(s)) {
      out.push({
        value: `${s.name} — ${DAY_NAMES[d] ?? `Day ${d}`} (${SLOT_TAG[s.timeSlot] ?? s.timeSlot})`,
        serviceName: s.name,
        day: d,
      });
    }
  }
  return out;
}

export function serviceDays(service: { daysOfWeek: string }): number[] {
  try {
    const arr = JSON.parse(service.daysOfWeek);
    return Array.isArray(arr) ? arr.filter((n) => Number.isInteger(n) && n >= 1 && n <= 7) : [];
  } catch {
    return [];
  }
}

// Per-dog pricing: the service's per-dog rate, but £14/dog for 3+ dogs.
export function servicePrice(service: { pricePerDog: number }, numDogs: number): number {
  return walkPriceFor(service.pricePerDog, numDogs);
}
