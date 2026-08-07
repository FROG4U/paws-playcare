// Field / playground-hire domain logic: opening hours (auto summer/winter),
// hourly slot generation, availability, pricing and coupons.
//
// Season is derived from British Summer Time so it maintains itself every year:
// summer hours run from the last Sunday of March to the last Sunday of October
// (when the UK is on BST); the rest of the year uses winter hours (GMT).

import { prisma } from "./prisma";
import { atUtcMidnight, dayKey } from "./dates";
import {
  FIELD_BOOKING_STATUS,
  FIELD_COUPON_TYPE,
  FIELD_SEASON_MODE,
  FIELD_SLOT_KIND,
} from "./constants";
import type { FieldSetting, FieldCoupon } from "@prisma/client";

export type Season = "SUMMER" | "WINTER";

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

// yyyy-mm-dd of the last Sunday in a given month (monthZeroBased: Jan=0).
function lastSundayKey(year: number, monthZeroBased: number): string {
  // Day 0 of the next month === last day of this month.
  const last = new Date(Date.UTC(year, monthZeroBased + 1, 0));
  const sunday = last.getUTCDate() - last.getUTCDay(); // getUTCDay: Sun=0
  return dayKey(new Date(Date.UTC(year, monthZeroBased, sunday)));
}

// Is this calendar day within British Summer Time?
export function isBritishSummerTime(day: Date | string): boolean {
  const key = dayKey(day);
  const year = Number(key.slice(0, 4));
  const bstStart = lastSundayKey(year, 2); // last Sunday of March
  const bstEnd = lastSundayKey(year, 9); // last Sunday of October (clocks go back)
  return key >= bstStart && key < bstEnd;
}

export function seasonForDay(day: Date | string, mode: string): Season {
  if (mode === FIELD_SEASON_MODE.ALWAYS_SUMMER) return "SUMMER";
  if (mode === FIELD_SEASON_MODE.ALWAYS_WINTER) return "WINTER";
  return isBritishSummerTime(day) ? "SUMMER" : "WINTER";
}

export type DayHours = { season: Season; openHour: number; closeHour: number };

// Opening/closing hour (24h) for a day, from settings + season.
export function hoursForDay(settings: FieldSetting, day: Date | string): DayHours {
  const season = seasonForDay(day, settings.seasonMode);
  return season === "SUMMER"
    ? { season, openHour: settings.summerOpenHour, closeHour: settings.summerCloseHour }
    : { season, openHour: settings.winterOpenHour, closeHour: settings.winterCloseHour };
}

// The bookable slot start-hours for a day (each one covers hour..hour+1).
// Winter 8–16 → [8..15] (8 slots); summer 6–20 → [6..19] (14 slots).
export function slotHoursForDay(settings: FieldSetting, day: Date | string): number[] {
  const { openHour, closeHour } = hoursForDay(settings, day);
  const hours: number[] = [];
  for (let h = openHour; h < closeHour; h++) hours.push(h);
  return hours;
}

export function slotLabel(hour: number): string {
  return `${pad2(hour)}:00 – ${pad2(hour + 1)}:00`;
}
export function slotStartLabel(hour: number): string {
  return `${pad2(hour)}:00`;
}

// Get-or-create the singleton settings row.
export async function getFieldSettings(): Promise<FieldSetting> {
  return prisma.fieldSetting.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1 },
  });
}

// Hours already taken (booked or admin-blocked) on a given day → hour → kind.
export async function takenHoursForDay(
  day: Date | string
): Promise<Map<number, string>> {
  const rows = await prisma.fieldSlot.findMany({
    where: { date: atUtcMidnight(day) },
    select: { hour: true, kind: true },
  });
  const map = new Map<number, string>();
  for (const r of rows) map.set(r.hour, r.kind);
  return map;
}

export type SlotView = {
  hour: number;
  label: string;
  available: boolean;
  blocked: boolean; // admin block (vs booked by a customer)
  past: boolean;
};

// Full picture of a day for the public calendar: every slot + its state.
export function buildDayView(
  settings: FieldSetting,
  day: Date | string,
  taken: Map<number, string>,
  now: Date
): { season: Season; slots: SlotView[] } {
  const { season } = hoursForDay(settings, day);
  const hours = slotHoursForDay(settings, day);
  const nowMs = now.getTime();
  const slots: SlotView[] = hours.map((hour) => {
    const kind = taken.get(hour);
    // Slot start instant in UTC. (BST/GMT clock offset is small relative to a
    // whole-day booking horizon; treating the label hour as the UTC hour keeps
    // "is this slot in the past" robust enough for same-day cut-off.)
    const startMs = new Date(dayKey(day) + `T${pad2(hour)}:00:00.000Z`).getTime();
    const past = startMs <= nowMs;
    return {
      hour,
      label: slotLabel(hour),
      blocked: kind === FIELD_SLOT_KIND.BLOCK,
      available: !kind && !past,
      past,
    };
  });
  return { season, slots };
}

// ---- Pricing & coupons -----------------------------------------------------

export type PriceBreakdown = {
  numSlots: number;
  slotPrice: number;
  subtotal: number;
  discount: number;
  total: number;
  couponCode: string | null;
};

export function priceFor(
  settings: FieldSetting,
  numSlots: number,
  coupon: FieldCoupon | null
): PriceBreakdown {
  const slotPrice = settings.slotPrice;
  const subtotal = slotPrice * numSlots;
  let discount = 0;
  if (coupon) {
    discount =
      coupon.type === FIELD_COUPON_TYPE.PERCENT
        ? Math.round((subtotal * Math.min(coupon.value, 100)) / 100)
        : Math.min(coupon.value, subtotal);
  }
  return {
    numSlots,
    slotPrice,
    subtotal,
    discount,
    total: Math.max(0, subtotal - discount),
    couponCode: coupon?.code ?? null,
  };
}

// Look up a coupon by (case-insensitive) code and check it's usable now.
export async function findUsableCoupon(
  code: string,
  now: Date
): Promise<{ coupon: FieldCoupon | null; error?: string }> {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { coupon: null };
  const coupon = await prisma.fieldCoupon.findUnique({ where: { code: normalized } });
  if (!coupon || !coupon.active) return { coupon: null, error: "That code isn't valid." };
  if (coupon.expiresAt && coupon.expiresAt.getTime() < now.getTime())
    return { coupon: null, error: "That code has expired." };
  if (coupon.maxUses != null && coupon.usedCount >= coupon.maxUses)
    return { coupon: null, error: "That code has been fully used." };
  return { coupon };
}

// Free up slots held by abandoned (unpaid) checkouts. Deleting the booking
// cascades its FieldSlot reservation rows, returning those hours to green.
export async function releaseStaleFieldHolds(
  now: Date,
  olderThanMs = 60 * 60 * 1000
): Promise<number> {
  const cutoff = new Date(now.getTime() - olderThanMs);
  const stale = await prisma.fieldBooking.findMany({
    where: {
      status: { in: [FIELD_BOOKING_STATUS.PENDING, FIELD_BOOKING_STATUS.FAILED] },
      createdAt: { lt: cutoff },
    },
    select: { id: true },
  });
  if (!stale.length) return 0;
  await prisma.fieldBooking.deleteMany({
    where: { id: { in: stale.map((s) => s.id) } },
  });
  return stale.length;
}

// Booking reference like FB-20260810-4821.
export function makeReference(day: Date | string): string {
  const compact = dayKey(day).replace(/-/g, "");
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `FB-${compact}-${rand}`;
}
