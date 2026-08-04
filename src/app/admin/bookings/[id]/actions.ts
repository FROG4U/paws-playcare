"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES, NOTIF_TYPE, WALK_STATUS } from "@/lib/constants";
import { notify } from "@/lib/notifications";
import { atUtcMidnight, formatDate } from "@/lib/dates";
import { getServices, serviceDays, servicePrice } from "@/lib/services";
import { bankHolidayKeys, checkBookable } from "@/lib/availability";

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
  const bhKeys = await bankHolidayKeys();
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
