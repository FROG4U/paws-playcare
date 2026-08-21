"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES, NOTIF_TYPE, WALK_STATUS, BOOKING_STATUS, BOOKING_TYPE } from "@/lib/constants";
import { notify } from "@/lib/notifications";
import { atUtcMidnight, formatDate, dayKey } from "@/lib/dates";
import { getServices, serviceForName, serviceDays, servicePrice } from "@/lib/services";
import { blockedDateKeys, checkBookable, expandRecurring } from "@/lib/availability";
import { addCompletedWalkToInvoice, removeWalkFromInvoice } from "@/lib/billing";

// How far ahead resuming a paused recurring booking regenerates walks.
const ONGOING_HORIZON_DAYS = 12 * 7;

export type EditResult = { ok: true; message?: string } | { ok: false; error: string };

// Walks that haven't been completed or cancelled can still be edited/repriced.
const EDITABLE: string[] = [
  WALK_STATUS.REQUESTED,
  WALK_STATUS.ASSIGNED,
  WALK_STATUS.ACCEPTED,
  WALK_STATUS.DECLINED,
];

function refresh(bookingId: string) {
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/admin/new-bookings");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  revalidatePath("/client/walks");
}

async function serviceForBooking(booking: { serviceId: string | null; serviceName: string | null }) {
  const services = await getServices();
  return (
    services.find((s) => s.id === booking.serviceId) ??
    services.find((s) => s.name === booking.serviceName) ??
    null
  );
}

// Change which of the client's dogs are on the booking; reprice non-completed
// walks (£/dog × dogs) and update their dog count.
export async function updateBookingDogs(bookingId: string, dogIds: string[]): Promise<EditResult> {
  await requireRole([ROLES.ADMIN]);
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { ok: false, error: "Booking not found." };

  const ids = [...new Set((dogIds ?? []).filter(Boolean))];
  if (ids.length === 0) return { ok: false, error: "Select at least one dog." };
  const owned = await prisma.dog.findMany({
    where: { id: { in: ids }, ownerId: booking.clientId },
    select: { id: true },
  });
  if (owned.length !== ids.length) return { ok: false, error: "One or more dogs weren't found for this client." };

  const service = await serviceForBooking(booking);
  const numDogs = ids.length;
  const walkData: { numDogs: number; price?: number } = { numDogs };
  if (service) walkData.price = servicePrice(service, numDogs);

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: { dogIds: JSON.stringify(ids), numDogs },
    }),
    prisma.walk.updateMany({
      where: { bookingId, status: { in: EDITABLE } },
      data: walkData,
    }),
  ]);

  await notify({
    userId: booking.clientId,
    type: NOTIF_TYPE.BOOKING_UPDATED,
    title: "Your booking was updated",
    body: `The dogs on your ${booking.serviceName ?? "walk"} booking were updated.`,
    link: "/client/walks",
  });
  refresh(bookingId);
  return { ok: true, message: "Dogs updated." };
}

// Change the date(s) of a booking's editable walks.
export async function saveWalkDates(
  bookingId: string,
  changes: { walkId: string; date: string }[]
): Promise<EditResult> {
  await requireRole([ROLES.ADMIN]);
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { walks: { select: { id: true, status: true } } },
  });
  if (!booking) return { ok: false, error: "Booking not found." };

  const editable = new Set(booking.walks.filter((w) => EDITABLE.includes(w.status)).map((w) => w.id));
  const valid = (changes ?? []).filter((c) => c.walkId && c.date && editable.has(c.walkId));
  if (valid.length === 0) return { ok: false, error: "No editable date changes." };

  const changed: string[] = [];
  await prisma.$transaction(
    valid.map((c) => {
      const d = atUtcMidnight(c.date);
      changed.push(formatDate(d));
      return prisma.walk.update({ where: { id: c.walkId }, data: { date: d } });
    })
  );

  await notify({
    userId: booking.clientId,
    type: NOTIF_TYPE.BOOKING_UPDATED,
    title: "Your walk dates were updated",
    body: `Your ${booking.serviceName ?? "walk"} booking now falls on: ${changed.join(", ")}.`,
    link: "/client/walks",
  });
  refresh(bookingId);
  return { ok: true, message: `Updated ${valid.length} date${valid.length > 1 ? "s" : ""}.` };
}

// Add a new walk to the booking (validated against the service's days + closures).
export async function addWalk(bookingId: string, dateStr: string): Promise<EditResult> {
  await requireRole([ROLES.ADMIN]);
  if (!dateStr) return { ok: false, error: "Pick a date." };
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { ok: false, error: "Booking not found." };

  const service = await serviceForBooking(booking);
  const svcDays = service ? serviceDays(service) : [1, 2, 3, 4, 5];
  const bhKeys = await blockedDateKeys();
  const check = checkBookable(dateStr, svcDays, bhKeys);
  if (!check.ok) {
    const why =
      check.reason === "weekend"
        ? "weekends are closed"
        : check.reason === "bank_holiday"
          ? "that's a bank holiday"
          : `${booking.serviceName ?? "this service"} doesn't run that weekday`;
    return { ok: false, error: `Can't add ${formatDate(dateStr)} — ${why}.` };
  }

  const numDogs = booking.numDogs;
  await prisma.walk.create({
    data: {
      bookingId,
      clientId: booking.clientId,
      date: atUtcMidnight(dateStr),
      timeSlot: booking.timeSlot,
      serviceName: booking.serviceName,
      numDogs,
      price: service ? servicePrice(service, numDogs) : 0,
      status: WALK_STATUS.REQUESTED,
    },
  });

  await notify({
    userId: booking.clientId,
    type: NOTIF_TYPE.BOOKING_UPDATED,
    title: "A walk was added",
    body: `A ${booking.serviceName ?? "walk"} on ${formatDate(dateStr)} was added to your booking.`,
    link: "/client/walks",
  });
  refresh(bookingId);
  return { ok: true, message: `Added ${formatDate(dateStr)}.` };
}

// Remove (cancel) a walk. Completed walks are already invoiced and are kept.
export async function removeWalk(walkId: string): Promise<EditResult> {
  await requireRole([ROLES.ADMIN]);
  const walk = await prisma.walk.findUnique({ where: { id: walkId } });
  if (!walk) return { ok: false, error: "Walk not found." };
  if (walk.status === WALK_STATUS.COMPLETED)
    return { ok: false, error: "That walk is completed and already invoiced — it can't be removed." };
  if (walk.status === WALK_STATUS.CANCELLED) return { ok: false, error: "That walk is already cancelled." };

  await prisma.walk.update({
    where: { id: walkId },
    data: { status: WALK_STATUS.CANCELLED, cancelledAt: new Date(), cancelReason: "Removed by admin" },
  });

  await notify({
    userId: walk.clientId,
    type: NOTIF_TYPE.BOOKING_UPDATED,
    title: "A walk was removed",
    body: `Your walk on ${formatDate(walk.date)} was removed.`,
    link: "/client/walks",
  });
  if (walk.bookingId) refresh(walk.bookingId);
  return { ok: true, message: "Walk removed." };
}

// Accept / reject / re-open a booking's approval decision — at any time.
export async function setBookingDecision(
  bookingId: string,
  action: "ACCEPT" | "REJECT" | "REOPEN",
  reason?: string
): Promise<EditResult> {
  const admin = await requireRole([ROLES.ADMIN]);
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { ok: false, error: "Booking not found." };
  const svc = booking.serviceName ?? "walk";

  if (action === "ACCEPT") {
    await prisma.booking.update({
      where: { id: bookingId },
      data: { reviewedAt: new Date(), reviewedById: admin.id, decision: "ACCEPTED", status: "ACTIVE" },
    });
    await notify({
      userId: booking.clientId,
      type: NOTIF_TYPE.BOOKING_ACCEPTED,
      title: "Your booking is accepted 🎉",
      body: `We've accepted your ${svc} booking. We'll assign a walker and confirm.`,
      link: "/client/walks",
    });
  } else if (action === "REJECT") {
    await prisma.$transaction([
      prisma.booking.update({
        where: { id: bookingId },
        data: { reviewedAt: new Date(), reviewedById: admin.id, decision: "REJECTED", status: "CANCELLED" },
      }),
      prisma.walk.updateMany({
        where: { bookingId, status: { notIn: [WALK_STATUS.COMPLETED, WALK_STATUS.CANCELLED] } },
        data: { status: WALK_STATUS.CANCELLED, cancelledAt: new Date(), cancelReason: reason || "Declined by admin" },
      }),
    ]);
    await notify({
      userId: booking.clientId,
      type: NOTIF_TYPE.BOOKING_REJECTED,
      title: "Booking not accepted",
      body: reason
        ? `Your ${svc} booking wasn't accepted: ${reason}`
        : `Unfortunately we couldn't accept your ${svc} booking. Please get in touch.`,
      link: "/client/walks",
    });
  } else {
    // REOPEN — back to the New Bookings queue for review.
    await prisma.booking.update({
      where: { id: bookingId },
      data: { reviewedAt: null, reviewedById: null, decision: null, status: "ACTIVE" },
    });
    await notify({
      userId: booking.clientId,
      type: NOTIF_TYPE.BOOKING_UPDATED,
      title: "Your booking is being reviewed",
      body: `We're taking another look at your ${svc} booking and will confirm shortly.`,
      link: "/client/walks",
    });
  }

  refresh(bookingId);
  return { ok: true };
}

// Remove a walk's line from its invoice, while that invoice is still unpaid.
// (Shared with the manual "Add days" screen — see lib/billing.)
async function stripWalkFromInvoice(walkId: string) {
  await removeWalkFromInvoice(walkId);
}

// Toggle "no charge" on a single walk. Turning it on also pulls the walk off its
// invoice if it was already billed (and the invoice isn't issued yet).
export async function setWalkNoCharge(walkId: string, noCharge: boolean): Promise<EditResult> {
  await requireRole([ROLES.ADMIN]);
  const walk = await prisma.walk.findUnique({ where: { id: walkId } });
  if (!walk) return { ok: false, error: "Walk not found." };

  await prisma.walk.update({ where: { id: walkId }, data: { noCharge } });
  if (noCharge) {
    await stripWalkFromInvoice(walkId);
  } else if (walk.status === WALK_STATUS.COMPLETED) {
    // Re-charge a completed walk that was previously marked no-charge.
    await addCompletedWalkToInvoice(walkId);
  }
  if (walk.bookingId) refresh(walk.bookingId);
  return { ok: true, message: noCharge ? "Walk marked — no charge." : "Walk will be charged." };
}

// Pause a booking: its upcoming (not-yet-done) walks are cancelled with no
// charge, and the booking is marked paused so it can be resumed later.
export async function pauseBooking(bookingId: string): Promise<EditResult> {
  await requireRole([ROLES.ADMIN]);
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) return { ok: false, error: "Booking not found." };

  const todayStart = new Date(dayKey(new Date()) + "T00:00:00.000Z");
  await prisma.$transaction([
    prisma.booking.update({ where: { id: bookingId }, data: { status: BOOKING_STATUS.PAUSED } }),
    prisma.walk.updateMany({
      where: {
        bookingId,
        date: { gte: todayStart },
        status: { notIn: [WALK_STATUS.COMPLETED, WALK_STATUS.CANCELLED] },
      },
      data: { status: WALK_STATUS.CANCELLED, cancelledAt: new Date(), cancelReason: "Booking paused", noCharge: true },
    }),
  ]);

  await notify({
    userId: booking.clientId,
    type: NOTIF_TYPE.BOOKING_UPDATED,
    title: "Your booking is paused",
    body: `Your ${booking.serviceName ?? "walk"} booking is paused — upcoming walks are cancelled with no charge. We'll resume when you're ready.`,
    link: "/client/walks",
  });
  refresh(bookingId);
  return { ok: true, message: "Booking paused — upcoming walks cancelled (no charge)." };
}

// Resume a paused booking. For a recurring booking, regenerate the next 12 weeks
// from its weekday pattern (skipping dates that already have an active walk).
export async function resumeBooking(bookingId: string): Promise<EditResult> {
  await requireRole([ROLES.ADMIN]);
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { walks: { select: { date: true, status: true } } },
  });
  if (!booking) return { ok: false, error: "Booking not found." };

  await prisma.booking.update({ where: { id: bookingId }, data: { status: BOOKING_STATUS.ACTIVE } });

  let created = 0;
  if (booking.type === BOOKING_TYPE.RECURRING) {
    let days: number[] = [];
    try { const p = JSON.parse(booking.daysOfWeek); if (Array.isArray(p)) days = p; } catch {}
    const services = await getServices();
    const service = serviceForName(services, booking.serviceId, booking.serviceName);
    if (days.length && service) {
      const svcDays = serviceDays(service);
      const useDays = days.filter((d) => svcDays.includes(d));
      const bhKeys = await blockedDateKeys();
      const startIso = dayKey(new Date());
      const endIso = dayKey(new Date(Date.now() + (ONGOING_HORIZON_DAYS - 1) * 86400000));
      const { dates } = expandRecurring(useDays, startIso, endIso, bhKeys);
      // Skip any date that already has a non-cancelled walk.
      const activeKeys = new Set(
        booking.walks.filter((w) => w.status !== WALK_STATUS.CANCELLED).map((w) => dayKey(w.date))
      );
      const price = servicePrice(service, booking.numDogs);
      const toCreate = dates.filter((d) => !activeKeys.has(dayKey(d)));
      if (toCreate.length) {
        await prisma.walk.createMany({
          data: toCreate.map((d) => ({
            bookingId,
            clientId: booking.clientId,
            date: d,
            timeSlot: booking.timeSlot,
            serviceName: booking.serviceName,
            numDogs: booking.numDogs,
            price,
            status: WALK_STATUS.REQUESTED,
          })),
        });
        created = toCreate.length;
      }
    }
  }

  await notify({
    userId: booking.clientId,
    type: NOTIF_TYPE.BOOKING_UPDATED,
    title: "Your booking has resumed 🎉",
    body: `Your ${booking.serviceName ?? "walk"} booking is active again${created ? ` — ${created} upcoming walk${created > 1 ? "s" : ""} scheduled` : ""}.`,
    link: "/client/walks",
  });
  refresh(bookingId);
  return { ok: true, message: `Booking resumed${created ? ` — ${created} walk${created > 1 ? "s" : ""} scheduled` : ""}.` };
}

const DAY_LABEL: Record<number, string> = {
  1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday",
  5: "Friday", 6: "Saturday", 7: "Sunday",
};

const listDays = (days: number[]) => {
  const names = [...days].sort().map((d) => DAY_LABEL[d] ?? `Day ${d}`);
  return names.length <= 1
    ? names[0] ?? ""
    : `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
};

// Change which weekdays a repeat booking runs on, from a given date onwards.
//
// Cancelling every Monday means more than deleting those walks: unless the
// booking's own pattern changes, the nightly rollover puts them straight back.
// So this updates daysOfWeek *and* fixes up the walks —
//   • a day taken off  → its upcoming walks (from `fromDate`) are cancelled, no charge
//   • a day added      → walks are generated out to the usual 12-week horizon
// Walks already completed are left alone; past walks are never touched.
export async function setBookingDays(
  bookingId: string,
  days: number[],
  fromDate?: string | null
): Promise<EditResult> {
  const admin = await requireRole([ROLES.ADMIN]);
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { walks: { select: { id: true, date: true, status: true } } },
  });
  if (!booking) return { ok: false, error: "Booking not found." };
  if (booking.type !== BOOKING_TYPE.RECURRING) {
    return { ok: false, error: "Only a repeat booking has weekly days — add or remove walks individually." };
  }

  const service = await serviceForBooking(booking);
  if (!service) return { ok: false, error: "That service is no longer available." };
  const svcDays = serviceDays(service);

  const wanted = [...new Set(days)].filter((d) => Number.isInteger(d)).sort();
  const bad = wanted.filter((d) => !svcDays.includes(d));
  if (bad.length) {
    return {
      ok: false,
      error: `${service.name} doesn't run on ${listDays(bad)} — it runs ${listDays(svcDays)}.`,
    };
  }

  let current: number[] = [];
  try {
    const parsed = JSON.parse(booking.daysOfWeek);
    if (Array.isArray(parsed)) current = parsed;
  } catch {}

  const removed = current.filter((d) => !wanted.includes(d));
  const added = wanted.filter((d) => !current.includes(d));
  if (removed.length === 0 && added.length === 0) {
    return { ok: false, error: "Those are already the days on this booking." };
  }

  const todayKey = dayKey(new Date());
  const fromKey = fromDate && fromDate > todayKey ? fromDate : todayKey;

  // Take days off: cancel their upcoming walks (no charge — the client didn't
  // cancel late, we changed the plan).
  let cancelled = 0;
  if (removed.length) {
    const isoWeekdayOf = (d: Date) => ((d.getUTCDay() + 6) % 7) + 1;
    const doomed = booking.walks.filter(
      (w) =>
        EDITABLE.includes(w.status) &&
        dayKey(w.date) >= fromKey &&
        removed.includes(isoWeekdayOf(w.date))
    );
    if (doomed.length) {
      await prisma.walk.updateMany({
        where: { id: { in: doomed.map((w) => w.id) } },
        data: {
          status: WALK_STATUS.CANCELLED,
          cancelledAt: new Date(),
          cancelledById: admin.id,
          cancelReason: `${listDays(removed)} removed from the regular booking`,
          noCharge: true,
        },
      });
      cancelled = doomed.length;
    }
  }

  // Add days: fill them in to the same horizon the rollover keeps.
  let created = 0;
  if (added.length) {
    const endIso = dayKey(new Date(Date.now() + (ONGOING_HORIZON_DAYS - 1) * 86400000));
    if (fromKey <= endIso) {
      const bhKeys = await blockedDateKeys();
      const { dates } = expandRecurring(added, fromKey, endIso, bhKeys);
      const activeKeys = new Set(
        booking.walks
          .filter((w) => w.status !== WALK_STATUS.CANCELLED)
          .map((w) => dayKey(w.date))
      );
      const toCreate = dates.filter((d) => !activeKeys.has(dayKey(d)));
      if (toCreate.length) {
        const price = servicePrice(service, booking.numDogs);
        await prisma.walk.createMany({
          data: toCreate.map((d) => ({
            bookingId,
            clientId: booking.clientId,
            date: d,
            timeSlot: booking.timeSlot,
            serviceName: booking.serviceName,
            numDogs: booking.numDogs,
            price,
            status: WALK_STATUS.REQUESTED,
          })),
        });
        created = toCreate.length;
      }
    }
  }

  await prisma.booking.update({
    where: { id: bookingId },
    data: { daysOfWeek: JSON.stringify(wanted) },
  });

  const parts = [
    removed.length ? `${listDays(removed)} removed${cancelled ? ` (${cancelled} walk${cancelled > 1 ? "s" : ""} cancelled, no charge)` : ""}` : null,
    added.length ? `${listDays(added)} added${created ? ` (${created} walk${created > 1 ? "s" : ""} booked)` : ""}` : null,
  ].filter(Boolean);

  await notify({
    userId: booking.clientId,
    type: NOTIF_TYPE.BOOKING_UPDATED,
    title: "Your regular walks have changed",
    body: `${booking.serviceName ?? "Your booking"}: ${parts.join("; ")}. It now runs every ${listDays(wanted) || "— no days"}.`,
    link: "/client/walks",
  });

  refresh(bookingId);
  revalidatePath("/admin/calendar");
  return { ok: true, message: `${parts.join("; ")}.` };
}
