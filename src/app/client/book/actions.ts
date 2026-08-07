"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES, NOTIF_TYPE } from "@/lib/constants";
import { getServices, serviceDays, servicePrice } from "@/lib/services";
import { bankHolidayKeys, checkBookable, expandRecurring } from "@/lib/availability";
import { atUtcMidnight, dayKey, formatDate } from "@/lib/dates";
import { notify, notifyAdmins } from "@/lib/notifications";

// How far ahead an open-ended ("repeat ongoing") booking generates walks up
// front. The daily maintenance cron (lib/rollover.ts) then keeps topping every
// ongoing booking back up to this horizon, so it rolls on forever until paused.
const ONGOING_HORIZON_DAYS = 12 * 7;

export type BookInput = {
  serviceId: string;
  dogIds: string[];
  mode: "DATES" | "REPEAT";
  dates?: string[];                 // DATES — one or more yyyy-mm-dd
  days?: number[];                  // REPEAT — subset of the service's weekdays
  startDate?: string;               // REPEAT
  endMode?: "DATE" | "FOREVER";     // REPEAT
  endDate?: string;                 // REPEAT when endMode = DATE
  agreeWeekly?: boolean;            // REPEAT — client ticked the weekly + 7-day terms
};

export type BookResult =
  | { ok: true; created: number; skipped: number; ongoing: boolean }
  | { ok: false; error: string };

export async function createBooking(input: BookInput): Promise<BookResult> {
  const user = await requireRole([ROLES.CLIENT]);
  if (user.status !== "ACTIVE") {
    return { ok: false, error: "Your account is still awaiting approval, so you can't book yet." };
  }
  if (!user.paymentMethodId) {
    return { ok: false, error: "Please add a payment card before booking a walk." };
  }

  const service = (await getServices()).find((s) => s.id === input.serviceId && s.active);
  if (!service) return { ok: false, error: "Please choose a service." };
  const svcDays = serviceDays(service);
  const svcDayNames = svcDays.map((d) => DAY_LONG[d]).join(", ");

  const dogIds = [...new Set(input.dogIds ?? [])];
  if (dogIds.length === 0) return { ok: false, error: "Please select at least one dog." };
  const owned = await prisma.dog.findMany({ where: { id: { in: dogIds }, ownerId: user.id }, select: { id: true } });
  if (owned.length !== dogIds.length) return { ok: false, error: "One or more of the selected dogs weren't found." };

  const numDogs = owned.length;
  const price = servicePrice(service, numDogs);
  const bhKeys = await bankHolidayKeys();
  const mkWalk = (d: Date, isExtra = false) => ({
    clientId: user.id, date: d, timeSlot: service.timeSlot, serviceName: service.name,
    numDogs, price, isBankHoliday: false, status: "REQUESTED", isExtra,
  });

  // ── Specific dates ─────────────────────────────────────────────────────────
  if (input.mode === "DATES") {
    const dates = [...new Set((input.dates ?? []).filter(Boolean))].sort();
    if (dates.length === 0) return { ok: false, error: "Please add at least one date." };
    if (dates.length > 90) return { ok: false, error: "That's a lot of dates at once — please add up to 90." };

    const bad = dates.filter((d) => !checkBookable(d, svcDays, bhKeys).ok);
    if (bad.length > 0) {
      return {
        ok: false,
        error: `These dates aren't available: ${bad.map((d) => formatDate(d)).join(", ")}. ${service.name} runs on ${svcDayNames}; weekends and bank holidays are closed.`,
      };
    }
    const walkDates = dates.map((d) => atUtcMidnight(d));
    await prisma.booking.create({
      data: {
        clientId: user.id, serviceId: service.id, serviceName: service.name,
        type: "ONE_OFF", timeSlot: service.timeSlot,
        dogIds: JSON.stringify(dogIds), numDogs,
        startDate: walkDates[0], daysOfWeek: "[]",
        walks: { create: walkDates.map((d) => mkWalk(d, true)) },
      },
    });
    await notifyAdmins({
      type: NOTIF_TYPE.BOOKING_CREATED, title: "New booking",
      body: `${user.name} booked ${service.name} — ${walkDates.length} walk${walkDates.length > 1 ? "s" : ""}.`,
      link: "/admin/new-bookings",
    });
    revalidatePath("/client/walks");
    return { ok: true, created: walkDates.length, skipped: 0, ongoing: false };
  }

  // ── Repeat ───────────────────────────────────────────────────────────────────
  const days = (input.days ?? []).filter((d) => svcDays.includes(d));
  if (days.length === 0) return { ok: false, error: "Please choose at least one day of the week." };
  if (!input.startDate) return { ok: false, error: "Please pick a start date." };
  if (!input.agreeWeekly) return { ok: false, error: "Please tick the box to agree to the weekly terms." };

  const ongoing = input.endMode !== "DATE";
  let endStr: string;
  if (ongoing) {
    // -1 so the inclusive window spans exactly 12 weeks (84 days), matching the
    // estimate shown on the booking form.
    endStr = dayKey(new Date(atUtcMidnight(input.startDate).getTime() + (ONGOING_HORIZON_DAYS - 1) * 86400000));
  } else {
    if (!input.endDate) return { ok: false, error: "Please pick an end date, or choose to repeat ongoing." };
    if (input.endDate < input.startDate) return { ok: false, error: "The end date must be on or after the start date." };
    endStr = input.endDate;
  }

  const { dates, skippedBankHolidays } = expandRecurring(days, input.startDate, endStr, bhKeys);
  if (dates.length === 0) return { ok: false, error: "There are no bookable dates in that range — try different days or dates." };
  if (dates.length > 400) return { ok: false, error: "That's a very long range — please book up to about a year at a time." };

  await prisma.booking.create({
    data: {
      clientId: user.id, serviceId: service.id, serviceName: service.name,
      type: "RECURRING", timeSlot: service.timeSlot,
      dogIds: JSON.stringify(dogIds), numDogs,
      startDate: atUtcMidnight(input.startDate),
      endDate: ongoing ? null : atUtcMidnight(input.endDate!),
      daysOfWeek: JSON.stringify(days),
      termsAcceptedAt: new Date(),
      walks: { create: dates.map((d) => mkWalk(d)) },
    },
  });

  if (skippedBankHolidays.length > 0) {
    const list = skippedBankHolidays.map(formatDate).join(", ");
    await notify({
      userId: user.id, type: NOTIF_TYPE.WALK_SKIPPED,
      title: `${skippedBankHolidays.length} bank-holiday date${skippedBankHolidays.length > 1 ? "s" : ""} skipped`,
      body: `Your ${service.name} booking skipped these bank holidays (we don't walk then): ${list}.`,
      link: "/client/walks",
    });
  }
  await notifyAdmins({
    type: NOTIF_TYPE.BOOKING_CREATED, title: "New recurring booking",
    body: `${user.name} booked ${service.name} — ${dates.length} walk${dates.length > 1 ? "s" : ""}${ongoing ? " (ongoing)" : ""}.`,
    link: "/admin/new-bookings",
  });

  revalidatePath("/client/walks");
  return { ok: true, created: dates.length, skipped: skippedBankHolidays.length, ongoing };
}

const DAY_LONG: Record<number, string> = { 1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday", 5: "Friday" };
