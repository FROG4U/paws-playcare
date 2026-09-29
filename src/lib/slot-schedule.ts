// Applying a client's requested slots to their real schedule.
//
// "Requested slots" ("Field Play - Monday (AM)") are what the client asked for
// at sign-up. Their actual walks come from RECURRING bookings, one per service,
// each with a set of weekdays. Editing the slots has to rebuild those bookings
// or the two drift apart and the invoices follow the old pattern.
//
// Money rules kept here so every caller behaves the same:
//   * a day taken off      -> its upcoming, not-yet-done walks are cancelled
//                             with no charge, so nothing is billed for them
//   * a day added          -> walks are generated from today (never backdated)
//                             out to the 12-week horizon, priced at the current
//                             rate for the client's dog count
//   * completed walks      -> never touched, so anything already invoiced or
//                             paid stays exactly as it was billed
import { prisma } from "./prisma";
import {
  getServices,
  serviceDays,
  servicePrice,
  resolveRequestedWalk,
  requestedWalkOptions,
} from "./services";
import { blockedDateKeys, expandRecurring } from "./availability";
import { atUtcMidnight, dayKey } from "./dates";
import { BOOKING_STATUS, BOOKING_TYPE, WALK_STATUS } from "./constants";

const HORIZON_DAYS = 12 * 7;

const EDITABLE: string[] = [
  WALK_STATUS.REQUESTED,
  WALK_STATUS.ASSIGNED,
  WALK_STATUS.ACCEPTED,
  WALK_STATUS.DECLINED,
];

const DAY_LABEL: Record<number, string> = {
  1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday",
  5: "Friday", 6: "Saturday", 7: "Sunday",
};

export function listNames(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

const isoWeekdayOf = (d: Date) => ((d.getUTCDay() + 6) % 7) + 1;

export type SlotChange = { service: string; day: number; walks: number };

export type ApplySlotsResult = {
  ok: true;
  added: SlotChange[];
  removed: SlotChange[];
  walksCreated: number;
  walksCancelled: number;
  unresolved: string[];
  slots: string[]; // the canonical, ordered list that was saved
  summary: string;
} | { ok: false; error: string };

// Put the client's schedule in step with `slots`. Safe to call with the list
// they already have: nothing changes and the summary says so.
export async function applyRequestedSlots(
  clientId: string,
  slots: string[],
  opts: { adminId?: string; now?: Date } = {}
): Promise<ApplySlotsResult> {
  const now = opts.now ?? new Date();
  const client = await prisma.user.findUnique({
    where: { id: clientId },
    select: { id: true, dogs: { select: { id: true } } },
  });
  if (!client) return { ok: false, error: "Client not found." };

  const services = await getServices();

  // Resolve the labels to service + weekday, keeping anything we can't place.
  const unresolved: string[] = [];
  const want = new Map<string, { service: (typeof services)[number]; days: Set<number> }>();
  for (const slot of [...new Set(slots)]) {
    const hit = resolveRequestedWalk(services, slot);
    if (!hit) {
      unresolved.push(slot);
      continue;
    }
    const entry = want.get(hit.service.id) ?? { service: hit.service, days: new Set<number>() };
    entry.days.add(hit.day);
    want.set(hit.service.id, entry);
  }

  const todayKey = dayKey(now);
  const endKey = dayKey(new Date(atUtcMidnight(todayKey).getTime() + (HORIZON_DAYS - 1) * 86400000));
  const bhKeys = await blockedDateKeys();

  const bookings = await prisma.booking.findMany({
    where: {
      clientId,
      type: BOOKING_TYPE.RECURRING,
      status: { in: [BOOKING_STATUS.ACTIVE, BOOKING_STATUS.PAUSED] },
    },
    include: { walks: { select: { id: true, date: true, status: true } } },
  });

  const added: SlotChange[] = [];
  const removed: SlotChange[] = [];
  let walksCreated = 0;
  let walksCancelled = 0;

  // Cancel the upcoming walks on days this booking is losing.
  const dropDays = async (
    booking: (typeof bookings)[number],
    days: number[],
    serviceName: string
  ) => {
    for (const d of days) {
      const doomed = booking.walks.filter(
        (w) =>
          EDITABLE.includes(w.status) &&
          dayKey(w.date) >= todayKey &&
          isoWeekdayOf(w.date) === d
      );
      if (doomed.length) {
        await prisma.walk.updateMany({
          where: { id: { in: doomed.map((w) => w.id) } },
          data: {
            status: WALK_STATUS.CANCELLED,
            cancelledAt: now,
            cancelledById: opts.adminId ?? null,
            cancelReason: `${DAY_LABEL[d] ?? "Day"} removed from the regular days`,
            noCharge: true, // plan change, not a late cancellation - never billed
          },
        });
        walksCancelled += doomed.length;
      }
      removed.push({ service: serviceName, day: d, walks: doomed.length });
    }
  };

  // Generate the walks for days this booking is gaining.
  const addDays = async (
    booking: { id: string; clientId: string; timeSlot: string; serviceName: string | null; numDogs: number; walks: { date: Date; status: string }[] },
    days: number[],
    service: (typeof services)[number]
  ) => {
    const { dates } = expandRecurring(days, todayKey, endKey, bhKeys);
    const live = new Set(
      booking.walks.filter((w) => w.status !== WALK_STATUS.CANCELLED).map((w) => dayKey(w.date))
    );
    const toCreate = dates.filter((d) => !live.has(dayKey(d)));
    if (toCreate.length) {
      const price = servicePrice(service, booking.numDogs);
      await prisma.walk.createMany({
        data: toCreate.map((d) => ({
          bookingId: booking.id,
          clientId: booking.clientId,
          date: d,
          timeSlot: booking.timeSlot,
          serviceName: booking.serviceName,
          numDogs: booking.numDogs,
          price,
          status: WALK_STATUS.REQUESTED,
        })),
      });
      walksCreated += toCreate.length;
    }
    for (const d of days) {
      added.push({
        service: service.name,
        day: d,
        walks: toCreate.filter((x) => isoWeekdayOf(x) === d).length,
      });
    }
  };

  // 1. Existing bookings: add, drop, or end them entirely.
  for (const b of bookings) {
    const entry =
      want.get(b.serviceId ?? "") ??
      [...want.values()].find((e) => e.service.name === b.serviceName);
    const service = entry?.service ?? services.find((s) => s.id === b.serviceId || s.name === b.serviceName);

    let current: number[] = [];
    try {
      const parsed = JSON.parse(b.daysOfWeek);
      if (Array.isArray(parsed)) current = parsed;
    } catch {}

    const wanted = entry ? [...entry.days].sort() : [];
    const drop = current.filter((d) => !wanted.includes(d));
    const gain = wanted.filter((d) => !current.includes(d));

    if (drop.length) await dropDays(b, drop, b.serviceName ?? service?.name ?? "Walk");
    if (gain.length && service) await addDays(b, gain, service);

    await prisma.booking.update({
      where: { id: b.id },
      data: {
        daysOfWeek: JSON.stringify(wanted),
        // Nothing left on this service - stop it rolling forward.
        status: wanted.length === 0 ? BOOKING_STATUS.ENDED : BOOKING_STATUS.ACTIVE,
      },
    });

    if (entry) want.delete(b.serviceId ?? entry.service.id);
    if (entry && want.has(entry.service.id)) want.delete(entry.service.id);
  }

  // 2. Services they now want that have no booking yet.
  const dogIds = client.dogs.map((d) => d.id);
  for (const { service, days } of want.values()) {
    const useDays = [...days].filter((d) => serviceDays(service).includes(d)).sort();
    if (useDays.length === 0 || dogIds.length === 0) continue;

    const { dates } = expandRecurring(useDays, todayKey, endKey, bhKeys);
    const price = servicePrice(service, dogIds.length);
    await prisma.booking.create({
      data: {
        clientId,
        serviceId: service.id,
        serviceName: service.name,
        type: BOOKING_TYPE.RECURRING,
        status: BOOKING_STATUS.ACTIVE,
        timeSlot: service.timeSlot,
        dogIds: JSON.stringify(dogIds),
        numDogs: dogIds.length,
        startDate: atUtcMidnight(todayKey),
        endDate: null, // ongoing - the rollover keeps it topped up
        daysOfWeek: JSON.stringify(useDays),
        termsAcceptedAt: now,
        reviewedAt: now,
        reviewedById: opts.adminId ?? null,
        decision: "ACCEPTED",
        walks: {
          create: dates.map((d) => ({
            clientId,
            date: d,
            timeSlot: service.timeSlot,
            serviceName: service.name,
            numDogs: dogIds.length,
            price,
            status: WALK_STATUS.REQUESTED,
          })),
        },
      },
    });
    walksCreated += dates.length;
    for (const d of useDays) {
      added.push({
        service: service.name,
        day: d,
        walks: dates.filter((x) => isoWeekdayOf(x) === d).length,
      });
    }
  }

  // 3. Save the tidy, ordered list back onto the client's sign-up record.
  const order = requestedWalkOptions(services).map((o) => o.value);
  const canonical = [...new Set(slots)].sort(
    (a, b) => (order.indexOf(a) + 1 || 9999) - (order.indexOf(b) + 1 || 9999)
  );
  await prisma.user.update({
    where: { id: clientId },
    data: { regSlots: JSON.stringify(canonical) },
  });

  const parts: string[] = [];
  if (added.length) {
    parts.push(
      `added ${listNames(added.map((a) => `${a.service} ${DAY_LABEL[a.day]}`))}` +
        (walksCreated ? ` (${walksCreated} walk${walksCreated === 1 ? "" : "s"} booked)` : "")
    );
  }
  if (removed.length) {
    parts.push(
      `removed ${listNames(removed.map((r) => `${r.service} ${DAY_LABEL[r.day]}`))}` +
        (walksCancelled ? ` (${walksCancelled} walk${walksCancelled === 1 ? "" : "s"} cancelled, no charge)` : "")
    );
  }

  return {
    ok: true,
    added,
    removed,
    walksCreated,
    walksCancelled,
    unresolved,
    slots: canonical,
    summary: parts.length ? parts.join("; ") : "No change - those are already their days.",
  };
}
