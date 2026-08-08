"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { atUtcMidnight, dayKey, isoWeekday } from "@/lib/dates";
import { getFieldSettings, slotHoursForDay } from "@/lib/field";
import {
  ROLES,
  FIELD_BOOKING_STATUS,
  FIELD_SLOT_KIND,
  FIELD_COUPON_TYPE,
  FIELD_SEASON_MODE,
} from "@/lib/constants";
import { poundsToPence } from "@/lib/money";

async function admin() {
  return requireRole([ROLES.ADMIN]);
}

export type FormState = { ok?: boolean; error?: string };

// ---- Settings --------------------------------------------------------------
function hour(fd: FormData, key: string, fallback: number): number {
  const n = Math.floor(Number(fd.get(key)));
  return Number.isFinite(n) && n >= 0 && n <= 24 ? n : fallback;
}

export async function saveFieldSettings(
  _prev: FormState,
  fd: FormData
): Promise<FormState> {
  await admin();
  const cur = await getFieldSettings();

  const winterOpenHour = hour(fd, "winterOpenHour", cur.winterOpenHour);
  const winterCloseHour = hour(fd, "winterCloseHour", cur.winterCloseHour);
  const summerOpenHour = hour(fd, "summerOpenHour", cur.summerOpenHour);
  const summerCloseHour = hour(fd, "summerCloseHour", cur.summerCloseHour);
  if (winterOpenHour >= winterCloseHour || summerOpenHour >= summerCloseHour) {
    return { error: "Opening time must be before closing time." };
  }

  const slotPrice = poundsToPence(String(fd.get("slotPricePounds") || "")) || cur.slotPrice;
  const maxAdvanceDays = Math.max(1, Math.floor(Number(fd.get("maxAdvanceDays")) || cur.maxAdvanceDays));
  const seasonMode = String(fd.get("seasonMode") || cur.seasonMode);

  const str = (k: string, fallback: string) => {
    const v = fd.get(k);
    return v == null ? fallback : String(v).trim();
  };

  await prisma.fieldSetting.update({
    where: { id: 1 },
    data: {
      slotPrice,
      maxAdvanceDays,
      seasonMode: Object.values(FIELD_SEASON_MODE).includes(seasonMode as never)
        ? seasonMode
        : cur.seasonMode,
      winterOpenHour,
      winterCloseHour,
      summerOpenHour,
      summerCloseHour,
      gatePin: str("gatePin", cur.gatePin),
      padlockCode: str("padlockCode", cur.padlockCode),
      postcode: str("postcode", cur.postcode),
      locationNote: str("locationNote", cur.locationNote),
      serviceName: str("serviceName", cur.serviceName),
      providerName: str("providerName", cur.providerName),
      companyName: str("companyName", cur.companyName),
      contactPhone: str("contactPhone", cur.contactPhone),
    },
  });
  revalidatePath("/admin/field/settings");
  revalidatePath("/field");
  return { ok: true };
}

// ---- Coupons ---------------------------------------------------------------
export async function createCoupon(_prev: FormState, fd: FormData): Promise<FormState> {
  await admin();
  const code = String(fd.get("code") || "").trim().toUpperCase();
  if (!/^[A-Z0-9]{3,20}$/.test(code)) {
    return { error: "Code must be 3–20 letters/numbers." };
  }
  const type = String(fd.get("type") || FIELD_COUPON_TYPE.PERCENT);
  const rawValue = String(fd.get("value") || "");
  let value: number;
  if (type === FIELD_COUPON_TYPE.PERCENT) {
    value = Math.floor(Number(rawValue));
    if (!(value >= 1 && value <= 100)) return { error: "Percentage must be 1–100." };
  } else {
    value = poundsToPence(rawValue);
    if (value <= 0) return { error: "Enter a discount amount." };
  }
  const maxUsesRaw = String(fd.get("maxUses") || "").trim();
  const maxUses = maxUsesRaw ? Math.max(1, Math.floor(Number(maxUsesRaw))) : null;
  const expiresRaw = String(fd.get("expiresAt") || "").trim();
  const expiresAt = expiresRaw ? atUtcMidnight(expiresRaw) : null;

  const existing = await prisma.fieldCoupon.findUnique({ where: { code } });
  if (existing) return { error: "That code already exists." };

  await prisma.fieldCoupon.create({
    data: {
      code,
      type: type === FIELD_COUPON_TYPE.FIXED ? FIELD_COUPON_TYPE.FIXED : FIELD_COUPON_TYPE.PERCENT,
      value,
      maxUses,
      expiresAt,
    },
  });
  revalidatePath("/admin/field/coupons");
  return { ok: true };
}

export async function toggleCoupon(id: string) {
  await admin();
  const c = await prisma.fieldCoupon.findUnique({ where: { id } });
  if (c) {
    await prisma.fieldCoupon.update({ where: { id }, data: { active: !c.active } });
    revalidatePath("/admin/field/coupons");
  }
}

export async function deleteCoupon(id: string) {
  await admin();
  await prisma.fieldCoupon.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/field/coupons");
}

// ---- Calendar blocks -------------------------------------------------------
// Block out hours so customers can't book them (maintenance, private events,
// holidays…). Supports a single day OR a date range, optionally repeating on
// chosen weekdays, for the whole day OR a time range. Each matching hour that
// isn't already booked/blocked becomes a BLOCK slot. Already-booked hours are
// left alone.
const RANGE_DAY_CAP = 400; // guard against runaway ranges
const SLOT_CAP = 1500; // max block slots created in one go
const DAY_NAME: Record<number, string> = {
  1: "Monday", 2: "Tuesday", 3: "Wednesday", 4: "Thursday",
  5: "Friday", 6: "Saturday", 7: "Sunday",
};

export async function createBlock(_prev: FormState, fd: FormData): Promise<FormState> {
  await admin();

  const fromKey = String(fd.get("fromDate") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromKey)) return { error: "Please choose a start date." };
  const toRaw = String(fd.get("toDate") || "").trim();
  const toKey = /^\d{4}-\d{2}-\d{2}$/.test(toRaw) ? toRaw : fromKey;
  if (toKey < fromKey) return { error: "The end date must be on or after the start date." };

  // Optional weekday repeat (ISO Mon=1 … Sun=7). Empty = every day in the range.
  const repeatDays = new Set(
    fd.getAll("repeatDays").map((d) => Math.floor(Number(d))).filter((d) => d >= 1 && d <= 7)
  );

  const settings = await getFieldSettings();
  const note = String(fd.get("note") || "").trim() || null;

  type TimeConf = { whole: boolean; from: number; to: number };
  const validTime = (c: TimeConf) => c.whole || (c.from >= 0 && c.to > c.from && c.to <= 24);

  // When repeating, each chosen weekday carries its OWN time slot (Mon 9–12,
  // Wed whole day, …). Without repeat, one time config applies to every day.
  const perDay = new Map<number, TimeConf>();
  if (repeatDays.size > 0) {
    for (const wd of repeatDays) {
      const conf: TimeConf = {
        whole: !!fd.get(`whole${wd}`),
        from: Math.floor(Number(fd.get(`from${wd}`))),
        to: Math.floor(Number(fd.get(`to${wd}`))),
      };
      if (!validTime(conf)) {
        return { error: `Please choose a valid time for ${DAY_NAME[wd]} (or block its whole day).` };
      }
      perDay.set(wd, conf);
    }
  }
  const single: TimeConf = {
    whole: !!fd.get("whole"),
    from: Math.floor(Number(fd.get("fromHour"))),
    to: Math.floor(Number(fd.get("toHour"))),
  };
  if (repeatDays.size === 0 && !validTime(single)) {
    return { error: "Please choose a valid time range (or block the whole day)." };
  }

  // Build the list of (date, hour) pairs to block.
  const rows: { date: Date; hour: number; note: string | null }[] = [];
  let cursor = atUtcMidnight(fromKey);
  const last = atUtcMidnight(toKey);
  let guard = 0;
  while (cursor.getTime() <= last.getTime() && guard++ < RANGE_DAY_CAP) {
    const key = dayKey(cursor);
    const wd = isoWeekday(cursor);
    if (repeatDays.size === 0 || repeatDays.has(wd)) {
      const conf = repeatDays.size > 0 ? perDay.get(wd)! : single;
      const dayHours = slotHoursForDay(settings, key);
      const wanted = conf.whole ? dayHours : dayHours.filter((h) => h >= conf.from && h < conf.to);
      for (const h of wanted) rows.push({ date: atUtcMidnight(key), hour: h, note });
    }
    cursor = new Date(cursor.getTime() + 86400000);
  }

  if (rows.length === 0) {
    return { error: "Nothing to block — check the dates, weekdays and times." };
  }
  if (rows.length > SLOT_CAP) {
    return { error: "That covers too many slots at once — please narrow the range or times." };
  }

  let created = 0;
  for (const r of rows) {
    try {
      await prisma.fieldSlot.create({
        data: { date: r.date, hour: r.hour, kind: FIELD_SLOT_KIND.BLOCK, note: r.note },
      });
      created++;
    } catch {
      /* already booked/blocked — skip (unique [date,hour]) */
    }
  }
  revalidatePath("/admin/field/blocks");
  revalidatePath("/field");
  if (created === 0) return { error: "Those times are already booked or blocked." };
  return { ok: true };
}

export async function removeBlock(id: string) {
  await admin();
  // deleteMany lets us guard on kind so we never delete a real booking's slot.
  await prisma.fieldSlot.deleteMany({ where: { id, kind: FIELD_SLOT_KIND.BLOCK } });
  revalidatePath("/admin/field/blocks");
  revalidatePath("/field");
}

// Clear every block on a given day (leaves real bookings untouched).
export async function removeBlocksForDay(dateKey: string) {
  await admin();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return;
  await prisma.fieldSlot.deleteMany({
    where: { date: atUtcMidnight(dateKey), kind: FIELD_SLOT_KIND.BLOCK },
  });
  revalidatePath("/admin/field/blocks");
  revalidatePath("/field");
}

// ---- Bookings --------------------------------------------------------------
// Cancel a booking: free its slots but keep the record (marked CANCELLED).
// Any refund is issued manually in Stripe.
export async function cancelFieldBooking(id: string) {
  await admin();
  await prisma.$transaction([
    prisma.fieldSlot.deleteMany({ where: { bookingId: id } }),
    prisma.fieldBooking.update({
      where: { id },
      data: { status: FIELD_BOOKING_STATUS.CANCELLED },
    }),
  ]);
  revalidatePath("/admin/field/bookings");
  revalidatePath("/field");
}

// ---- Field clients ---------------------------------------------------------
export async function blockFieldClient(id: string, reason: string) {
  await admin();
  await prisma.user.update({
    where: { id },
    data: { fieldBlockedAt: new Date(), fieldBlockReason: reason || "Blocked by admin" },
  });
  revalidatePath("/admin/field/clients");
}
export async function unblockFieldClient(id: string) {
  await admin();
  await prisma.user.update({
    where: { id },
    data: { fieldBlockedAt: null, fieldBlockReason: null },
  });
  revalidatePath("/admin/field/clients");
}
export async function archiveFieldClient(id: string, archive: boolean) {
  await admin();
  await prisma.user.update({
    where: { id },
    data: { archivedAt: archive ? new Date() : null },
  });
  revalidatePath("/admin/field/clients");
}
export async function deleteFieldClient(id: string) {
  await admin();
  // Bookings survive as guest history (FieldBooking.clientId onDelete: SetNull).
  await prisma.user.delete({ where: { id } }).catch(() => {});
  revalidatePath("/admin/field/clients");
}
