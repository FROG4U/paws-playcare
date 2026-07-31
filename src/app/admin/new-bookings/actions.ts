"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES, NOTIF_TYPE, WALK_STATUS } from "@/lib/constants";
import { notify } from "@/lib/notifications";
import { atUtcMidnight, formatDate } from "@/lib/dates";

function refresh() {
  revalidatePath("/admin/new-bookings");
  revalidatePath("/admin");
  revalidatePath("/client/walks");
}

// Accept an incoming request — it leaves the inbox and can be assigned a walker.
export async function acceptBooking(bookingId: string) {
  const admin = await requireRole([ROLES.ADMIN]);
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.reviewedAt) return;

  await prisma.booking.update({
    where: { id: bookingId },
    data: { reviewedAt: new Date(), reviewedById: admin.id, decision: "ACCEPTED" },
  });

  await notify({
    userId: booking.clientId,
    type: NOTIF_TYPE.BOOKING_ACCEPTED,
    title: "Your booking is accepted 🎉",
    body: `We've accepted your ${booking.serviceName ?? "walk"} booking. We'll assign a walker and confirm.`,
    link: "/client/walks",
  });
  refresh();
}

// Reject the request — cancels the booking and all its walks.
export async function rejectBooking(bookingId: string, reason?: string) {
  const admin = await requireRole([ROLES.ADMIN]);
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking || booking.reviewedAt) return;

  await prisma.$transaction([
    prisma.booking.update({
      where: { id: bookingId },
      data: {
        reviewedAt: new Date(), reviewedById: admin.id, decision: "REJECTED",
        status: "CANCELLED",
      },
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
      ? `Your ${booking.serviceName ?? "walk"} booking wasn't accepted: ${reason}`
      : `Unfortunately we couldn't accept your ${booking.serviceName ?? "walk"} booking. Please get in touch.`,
    link: "/client/walks",
  });
  refresh();
}

// Change the date(s) of a booking's walks; notify the client of the new dates.
export async function updateBookingDates(
  bookingId: string,
  changes: { walkId: string; date: string }[]
) {
  await requireRole([ROLES.ADMIN]);
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { walks: { select: { id: true } } },
  });
  if (!booking) return { ok: false as const, error: "Booking not found." };

  const owned = new Set(booking.walks.map((w) => w.id));
  const valid = changes.filter((c) => c.walkId && c.date && owned.has(c.walkId));
  if (valid.length === 0) return { ok: false as const, error: "No valid date changes." };

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
  refresh();
  return { ok: true as const, count: valid.length };
}
