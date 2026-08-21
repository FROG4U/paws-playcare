"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES, NOTIF_TYPE, WALK_STATUS } from "@/lib/constants";
import { notify } from "@/lib/notifications";
import { getServices, servicePrice } from "@/lib/services";
import { atUtcMidnight, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import {
  addCompletedWalkToInvoice,
  nextPaymentDate,
  removeWalkFromInvoice,
  repriceInvoicedWalk,
} from "@/lib/billing";

export type Result = { ok: true; message: string } | { ok: false; error: string };

function refresh() {
  revalidatePath("/admin/extra-days");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/invoices");
  revalidatePath("/admin/calendar");
  revalidatePath("/client/invoices");
  revalidatePath("/client/walks");
}

export type AddExtraDaysInput = {
  clientId: string;
  serviceId: string;
  dogIds: string[];
  dates: string[];         // yyyy-mm-dd, any date — this is a manual add
  pricePence?: number | null; // per-walk override; blank = the usual rate
  note?: string | null;
  invoiceNow: boolean;     // true = done & billed, false = just put the day in
};

// Manually add day(s) for a client and (optionally) bill them straight away.
// Billing them puts each day on the client's current open invoice for the
// period the date falls in, so it's collected on their own pay cycle.
export async function addExtraDays(input: AddExtraDaysInput): Promise<Result> {
  const admin = await requireRole([ROLES.ADMIN]);

  const client = await prisma.user.findUnique({
    where: { id: input.clientId },
    select: { id: true, name: true, role: true, payCadence: true, dogs: { select: { id: true } } },
  });
  if (!client || client.role !== ROLES.CLIENT) return { ok: false, error: "Please choose a client." };

  const service = (await getServices()).find((s) => s.id === input.serviceId);
  if (!service) return { ok: false, error: "Please choose a service." };

  const owned = new Set(client.dogs.map((d) => d.id));
  const dogIds = [...new Set(input.dogIds)].filter((id) => owned.has(id));
  if (dogIds.length === 0) return { ok: false, error: "Please choose at least one dog." };

  const dates = [...new Set(input.dates.filter(Boolean))].sort();
  if (dates.length === 0) return { ok: false, error: "Please add at least one date." };
  if (dates.length > 60) return { ok: false, error: "That's a lot of days at once — add up to 60." };

  const price =
    input.pricePence != null && input.pricePence >= 0
      ? Math.round(input.pricePence)
      : servicePrice(service, dogIds.length);

  const now = new Date();
  const created: string[] = [];
  for (const d of dates) {
    const walk = await prisma.walk.create({
      data: {
        clientId: client.id,
        date: atUtcMidnight(d),
        timeSlot: service.timeSlot,
        serviceName: service.name,
        numDogs: dogIds.length,
        price,
        isExtra: true, // flagged on the invoice as an extra day
        status: input.invoiceNow ? WALK_STATUS.COMPLETED : WALK_STATUS.REQUESTED,
        completedAt: input.invoiceNow ? now : null,
        completedById: input.invoiceNow ? admin.id : null,
        cancelReason: input.note?.trim() || null,
      },
    });
    created.push(walk.id);
  }

  let invoiced = 0;
  if (input.invoiceNow) {
    for (const id of created) {
      const invoiceId = await addCompletedWalkToInvoice(id);
      if (invoiceId) invoiced += 1;
    }
  }

  const total = price * dates.length;
  const dayList = dates.map((d) => formatDate(d)).join(", ");

  if (input.invoiceNow && invoiced > 0) {
    const due = nextPaymentDate(client.payCadence, dates[dates.length - 1]);
    await notify({
      userId: client.id,
      type: NOTIF_TYPE.WALK_COMPLETED,
      title: `${dates.length} extra day${dates.length > 1 ? "s" : ""} added 🐾`,
      body: `${service.name} on ${dayList} — ${formatMoney(total)} added to your account. Payment due ${formatDate(due)}.`,
      link: "/client/invoices",
    });
  } else {
    await notify({
      userId: client.id,
      type: NOTIF_TYPE.BOOKING_UPDATED,
      title: `${dates.length} extra day${dates.length > 1 ? "s" : ""} booked 🐾`,
      body: `${service.name} on ${dayList}. It'll be billed once it's done, on your usual cycle.`,
      link: "/client/walks",
    });
  }

  refresh();
  return {
    ok: true,
    message: input.invoiceNow
      ? `${dates.length} day${dates.length > 1 ? "s" : ""} added and invoiced — ${formatMoney(total)} on ${client.name}'s current invoice.`
      : `${dates.length} day${dates.length > 1 ? "s" : ""} added for ${client.name}. Mark them done to bill them.`,
  };
}

// Change what an added day costs — the invoice line and total move with it.
export async function repriceExtraDay(walkId: string, pricePence: number): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  if (!Number.isFinite(pricePence) || pricePence < 0) return { ok: false, error: "Enter a valid amount." };

  const res = await repriceInvoicedWalk(walkId, Math.round(pricePence));
  if (!res.ok) return res;

  const walk = await prisma.walk.findUnique({
    where: { id: walkId },
    select: { clientId: true, date: true, serviceName: true },
  });
  if (walk) {
    await notify({
      userId: walk.clientId,
      type: NOTIF_TYPE.BOOKING_UPDATED,
      title: "An extra day was updated",
      body: `${walk.serviceName ?? "Walk"} on ${formatDate(walk.date)} is now ${formatMoney(Math.round(pricePence))}.`,
      link: "/client/invoices",
    });
  }
  refresh();
  return {
    ok: true,
    message: res.invoiced ? "Price updated — the invoice total has changed too." : "Price updated.",
  };
}

// Remove an added day: taken off the invoice (while unpaid) and deleted.
export async function removeExtraDay(walkId: string): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  const walk = await prisma.walk.findUnique({
    where: { id: walkId },
    include: { invoiceItem: { include: { invoice: true } } },
  });
  if (!walk) return { ok: false, error: "That day was already removed." };
  if (walk.invoiceItem && (walk.invoiceItem.invoice.status === "PAID" || walk.invoiceItem.invoice.paidAt)) {
    return { ok: false, error: "That invoice has already been paid — refund it in Stripe instead." };
  }

  await removeWalkFromInvoice(walkId);
  await prisma.walk.delete({ where: { id: walkId } });

  await notify({
    userId: walk.clientId,
    type: NOTIF_TYPE.BOOKING_UPDATED,
    title: "An extra day was removed",
    body: `${walk.serviceName ?? "Walk"} on ${formatDate(walk.date)} has been taken off your account — you won't be charged for it.`,
    link: "/client/invoices",
  });

  refresh();
  return { ok: true, message: "Day removed and taken off the invoice." };
}
