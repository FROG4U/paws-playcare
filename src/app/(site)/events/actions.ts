"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { EVENT_SIGNUP_STATUS, isPastEvent } from "@/lib/events";
import { notifyAdmins } from "@/lib/notifications";
import { NOTIF_TYPE } from "@/lib/constants";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { addEventSignupToInvoice, removeEventSignupFromInvoice, nextPaymentDate } from "@/lib/billing";

export type BookResult = { ok: true; message: string } | { ok: false; error: string };

// Book a place. Signed-in only, one place per account, and the contact details
// they type are kept with the booking so the list is right even if they later
// change their profile.
export async function bookEventPlace(
  eventId: string,
  input: { name: string; email: string; phone?: string; dogIds?: string[]; note?: string }
): Promise<BookResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please log in to book a place." };

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: { _count: { select: { signups: { where: { status: EVENT_SIGNUP_STATUS.BOOKED } } } } },
  });
  if (!event || !event.active || event.archivedAt) {
    return { ok: false, error: "Sorry, that event isn't open for bookings." };
  }
  if (isPastEvent(event.date)) return { ok: false, error: "That event has already been and gone." };

  const name = (input.name || "").trim();
  const email = (input.email || "").trim().toLowerCase();
  if (!name) return { ok: false, error: "Please give us your name." };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const existing = await prisma.eventSignup.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
  });
  if (existing && existing.status === EVENT_SIGNUP_STATUS.BOOKED) {
    return { ok: false, error: "You've already booked a place on this one." };
  }

  if (event.capacity != null && event._count.signups >= event.capacity) {
    return { ok: false, error: "Sorry, this event is fully booked." };
  }

  // It's a dogs' day out, so we need to know who's coming.
  const ownDogs = await prisma.dog.findMany({
    where: { ownerId: user.id },
    select: { id: true, name: true },
    orderBy: { createdAt: "asc" },
  });
  const chosen = ownDogs.filter((d) => (input.dogIds ?? []).includes(d.id));
  if (ownDogs.length > 0 && chosen.length === 0) {
    return { ok: false, error: "Please choose which dog is coming." };
  }

  // A paid place goes on their invoice, so there has to be a card to collect it.
  const price = event.pricePence ?? 0;
  if (price > 0 && !user.paymentMethodId) {
    return {
      ok: false,
      error: "Please add a payment card to your account before booking a paid event.",
    };
  }

  const dogLabel =
    chosen.length === 0
      ? null
      : chosen.length === 1
        ? chosen[0].name
        : `${chosen.slice(0, -1).map((d) => d.name).join(", ")} and ${chosen[chosen.length - 1].name}`;

  const data = {
    name,
    email,
    phone: (input.phone || "").trim() || null,
    dogIds: JSON.stringify(chosen.map((d) => d.id)),
    dogName: dogLabel,
    note: (input.note || "").trim() || null,
    status: EVENT_SIGNUP_STATUS.BOOKED,
  };

  const signup = existing
    ? await prisma.eventSignup.update({ where: { id: existing.id }, data })
    : await prisma.eventSignup.create({ data: { ...data, eventId, userId: user.id } });

  // Bill the place on their usual pay cycle, like a walk.
  let billed: string | null = null;
  if (price > 0) {
    await addEventSignupToInvoice(signup.id);
    billed = ` ${formatMoney(price)} has been added to your invoice, taken on ${formatDate(
      nextPaymentDate(user.payCadence)
    )} with your usual payment.`;
  }

  await notifyAdmins({
    type: NOTIF_TYPE.BOOKING_CREATED,
    title: `${name} booked onto ${event.title}`,
    body: `${formatDate(event.date)}${data.dogName ? ` · with ${data.dogName}` : ""}. ${email}${data.phone ? ` · ${data.phone}` : ""}${price > 0 ? ` · ${formatMoney(price)} on their invoice` : ""}`,
    link: "/admin/events",
  });

  revalidatePath(`/events/${event.slug}`);
  revalidatePath("/events");
  revalidatePath("/client/events");
  revalidatePath("/client/invoices");
  return { ok: true, message: `You're booked in. We'll see you there!${billed ?? ""}` };
}

// Drop out again.
export async function cancelEventPlace(eventId: string): Promise<BookResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please log in first." };

  const signup = await prisma.eventSignup.findUnique({
    where: { eventId_userId: { eventId, userId: user.id } },
    include: { event: { select: { slug: true, title: true } } },
  });
  if (!signup) return { ok: false, error: "You don't have a place on this one." };

  const unbilled = await removeEventSignupFromInvoice(signup.id);
  if (!unbilled.ok) return { ok: false, error: unbilled.error };

  await prisma.eventSignup.delete({ where: { id: signup.id } });

  await notifyAdmins({
    type: NOTIF_TYPE.BOOKING_REJECTED,
    title: `${signup.name} dropped out of ${signup.event.title}`,
    body: "Their place is back on sale.",
    link: "/admin/events",
  });

  revalidatePath(`/events/${signup.event.slug}`);
  revalidatePath("/events");
  revalidatePath("/client/events");
  revalidatePath("/client/invoices");
  return {
    ok: true,
    message: unbilled.removed
      ? "Your place has been cancelled and the charge taken off your invoice."
      : "Your place has been cancelled.",
  };
}
