// Turning an approved sign-up into a real schedule.
//
// At registration a client picks the walks they want ("Field Play — Monday
// (AM)", "Walks — Thursday (AM)") and a preferred start date. Those used to be
// notes on the approval card and nothing more — the client still had to go and
// book the same thing themselves. Now approving the account sets it up for
// them: one ongoing ("repeat until you stop it") booking per service, on the
// weekdays they asked for, from their preferred start date.
//
// Billing needs no special handling — invoicing groups a client's completed
// walks by their own pay cycle (daily / weekly / monthly), so whatever they
// chose at sign-up is what they're charged on.

import { prisma } from "./prisma";
import {
  getServices,
  serviceDays,
  servicePrice,
  resolveRequestedWalk,
} from "./services";
import { blockedDateKeys, expandRecurring } from "./availability";
import { atUtcMidnight, dayKey, formatDate } from "./dates";
import { BOOKING_STATUS, BOOKING_TYPE, PAY_CADENCE, USER_STATUS, WALK_STATUS } from "./constants";

// Matches the client booking form and the rollover job: generate 12 weeks up
// front, then the daily maintenance cron keeps topping it back up.
const HORIZON_DAYS = 12 * 7;

export const CADENCE_WORD: Record<string, string> = {
  [PAY_CADENCE.DAILY]: "daily",
  [PAY_CADENCE.WEEKLY]: "weekly",
  [PAY_CADENCE.MONTHLY]: "monthly",
};

export type RegistrationBookingResult = {
  bookingsCreated: number;
  walksCreated: number;
  firstWalk: Date | null;
  services: string[];
  unresolved: string[]; // requested slots no live service could satisfy
  skipped: "none" | "already-booked" | "no-slots" | "no-dogs" | "no-card" | "not-active";
};

const EMPTY: RegistrationBookingResult = {
  bookingsCreated: 0, walksCreated: 0, firstWalk: null,
  services: [], unresolved: [], skipped: "none",
};

export type RegistrationBookingOptions = {
  adminId?: string;
  now?: Date;
  // Setting up an existing client (rather than approving a new one): they must
  // already have a card on file, and the account must be active.
  requireCard?: boolean;
  requireActive?: boolean;
};

// Create the client's regular bookings from what they asked for at sign-up.
// Safe to call more than once: a client who already has a booking is left
// alone, so re-approving never doubles anyone up.
export async function createBookingsFromRegistration(
  clientId: string,
  opts: RegistrationBookingOptions = {}
): Promise<RegistrationBookingResult> {
  const { adminId, now = new Date(), requireCard = false, requireActive = false } = opts;
  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: {
      id: true, regSlots: true, regStartDate: true,
      status: true, paymentMethodId: true,
      dogs: { select: { id: true } },
      _count: { select: { bookings: true } },
    },
  });
  if (!client) return EMPTY;
  if (client._count.bookings > 0) return { ...EMPTY, skipped: "already-booked" };
  if (requireActive && client.status !== USER_STATUS.ACTIVE) return { ...EMPTY, skipped: "not-active" };
  if (requireCard && !client.paymentMethodId) return { ...EMPTY, skipped: "no-card" };
  if (client.dogs.length === 0) return { ...EMPTY, skipped: "no-dogs" };

  let requested: string[] = [];
  try {
    const parsed = JSON.parse(client.regSlots || "[]");
    if (Array.isArray(parsed)) requested = parsed.filter((s) => typeof s === "string");
  } catch {
    /* malformed — treated as "asked for nothing" */
  }
  if (requested.length === 0) return { ...EMPTY, skipped: "no-slots" };

  const services = await getServices();
  const unresolved: string[] = [];
  // Group the requested days under the service that runs them.
  const byService = new Map<string, { service: (typeof services)[number]; days: Set<number> }>();
  for (const slot of requested) {
    const hit = resolveRequestedWalk(services, slot);
    if (!hit) {
      unresolved.push(slot);
      continue;
    }
    const entry = byService.get(hit.service.id) ?? { service: hit.service, days: new Set<number>() };
    entry.days.add(hit.day);
    byService.set(hit.service.id, entry);
  }
  if (byService.size === 0) return { ...EMPTY, unresolved, skipped: "no-slots" };

  // Start on their preferred date, but never in the past.
  const todayKey = dayKey(now);
  const preferred = client.regStartDate ? dayKey(client.regStartDate) : todayKey;
  const startKey = preferred < todayKey ? todayKey : preferred;
  const endKey = dayKey(new Date(atUtcMidnight(startKey).getTime() + (HORIZON_DAYS - 1) * 86400000));

  const dogIds = client.dogs.map((d) => d.id);
  const numDogs = dogIds.length;
  const bhKeys = await blockedDateKeys();

  let bookingsCreated = 0;
  let walksCreated = 0;
  let firstWalk: Date | null = null;
  const serviceNames: string[] = [];

  for (const { service, days } of byService.values()) {
    const useDays = [...days].filter((d) => serviceDays(service).includes(d)).sort();
    if (useDays.length === 0) continue;

    const { dates } = expandRecurring(useDays, startKey, endKey, bhKeys);
    if (dates.length === 0) continue;

    const price = servicePrice(service, numDogs);
    await prisma.booking.create({
      data: {
        clientId: client.id,
        serviceId: service.id,
        serviceName: service.name,
        type: BOOKING_TYPE.RECURRING,
        status: BOOKING_STATUS.ACTIVE,
        timeSlot: service.timeSlot,
        dogIds: JSON.stringify(dogIds),
        numDogs,
        startDate: atUtcMidnight(startKey),
        endDate: null, // ongoing — the rollover job keeps it going
        daysOfWeek: JSON.stringify(useDays),
        termsAcceptedAt: now, // they ticked the terms when they registered
        // Set up by the admin at approval, so it isn't a request needing triage.
        reviewedAt: now,
        reviewedById: adminId ?? null,
        decision: "ACCEPTED",
        walks: {
          create: dates.map((d) => ({
            clientId: client.id,
            date: d,
            timeSlot: service.timeSlot,
            serviceName: service.name,
            numDogs,
            price,
            isBankHoliday: false,
            status: WALK_STATUS.REQUESTED,
          })),
        },
      },
    });

    bookingsCreated += 1;
    walksCreated += dates.length;
    serviceNames.push(service.name);
    if (!firstWalk || dates[0] < firstWalk) firstWalk = dates[0];
  }

  return {
    bookingsCreated, walksCreated, firstWalk,
    services: serviceNames, unresolved, skipped: "none",
  };
}

// One-line summary for notifications/emails, e.g.
// "Field Play & Walks — 36 walks booked, starting Wed 19 Aug 2026, billed weekly."
export function registrationBookingSummary(
  r: RegistrationBookingResult,
  cadence: string
): string | null {
  if (r.bookingsCreated === 0) return null;
  const names =
    r.services.length > 1
      ? `${r.services.slice(0, -1).join(", ")} & ${r.services[r.services.length - 1]}`
      : r.services[0];
  const start = r.firstWalk ? `, starting ${formatDate(r.firstWalk)}` : "";
  return `${names} — ${r.walksCreated} walk${r.walksCreated === 1 ? "" : "s"} booked${start}, billed ${CADENCE_WORD[cadence] ?? cadence.toLowerCase()}.`;
}
