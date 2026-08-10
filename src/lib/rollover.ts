// Keeps open-ended ("repeat ongoing") recurring bookings rolling forever.
//
// When a client books "repeat ongoing", we only generate a 12-week horizon of
// walks up front (we can't create infinite rows). This job — run daily by the
// maintenance cron — tops every ongoing booking back up to ~12 weeks ahead, so
// as time passes the schedule keeps extending itself and never runs dry.
//
// It stops for a booking the moment it's paused: an admin-paused booking
// (status PAUSED) is excluded by the query; a client who self-paused
// (servicesPaused) or is suspended is skipped. Resuming simply lets the next
// run top it up again.

import { prisma } from "./prisma";
import { getServices, serviceForName, serviceDays, servicePrice } from "./services";
import { blockedDateKeys, expandRecurring } from "./availability";
import { dayKey } from "./dates";
import { BOOKING_STATUS, BOOKING_TYPE, WALK_STATUS, USER_STATUS } from "./constants";

// How far ahead ongoing bookings are kept topped up (matches the initial
// booking horizon in client/book/actions.ts).
const ROLL_HORIZON_DAYS = 12 * 7;

export async function rolloverOngoingBookings(
  now: Date
): Promise<{ bookingsRolled: number; walksCreated: number }> {
  const bookings = await prisma.booking.findMany({
    where: {
      type: BOOKING_TYPE.RECURRING,
      status: BOOKING_STATUS.ACTIVE, // excludes PAUSED / ENDED / CANCELLED
      endDate: null, // only open-ended ("forever") bookings
    },
    include: {
      client: { select: { status: true, servicesPaused: true } },
      walks: { select: { date: true, status: true } },
    },
  });
  if (bookings.length === 0) return { bookingsRolled: 0, walksCreated: 0 };

  const services = await getServices();
  const bhKeys = await blockedDateKeys();
  const startIso = dayKey(now);
  const endIso = dayKey(new Date(now.getTime() + (ROLL_HORIZON_DAYS - 1) * 86400000));

  let bookingsRolled = 0;
  let walksCreated = 0;

  for (const b of bookings) {
    // Respect pausing / suspension — don't roll these forward.
    if (b.client.servicesPaused || b.client.status !== USER_STATUS.ACTIVE) continue;

    let days: number[] = [];
    try {
      const parsed = JSON.parse(b.daysOfWeek);
      if (Array.isArray(parsed)) days = parsed;
    } catch {
      /* malformed — skip */
    }
    if (days.length === 0) continue;

    const service = serviceForName(services, b.serviceId, b.serviceName);
    if (!service) continue; // service removed/inactive — nothing to price
    const useDays = days.filter((d) => serviceDays(service).includes(d));
    if (useDays.length === 0) continue;

    const { dates } = expandRecurring(useDays, startIso, endIso, bhKeys);
    // Never duplicate a day that already has a live walk.
    const activeKeys = new Set(
      b.walks.filter((w) => w.status !== WALK_STATUS.CANCELLED).map((w) => dayKey(w.date))
    );
    const toCreate = dates.filter((d) => !activeKeys.has(dayKey(d)));
    if (toCreate.length === 0) continue;

    const price = servicePrice(service, b.numDogs);
    await prisma.walk.createMany({
      data: toCreate.map((d) => ({
        bookingId: b.id,
        clientId: b.clientId,
        date: d,
        timeSlot: b.timeSlot,
        serviceName: b.serviceName,
        numDogs: b.numDogs,
        price,
        status: WALK_STATUS.REQUESTED,
      })),
    });
    bookingsRolled++;
    walksCreated += toCreate.length;
  }

  return { bookingsRolled, walksCreated };
}
