"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { atUtcMidnight } from "@/lib/dates";
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
// Block out hours so customers can't book them (maintenance, private events…).
// "whole" blocks every slot that day; otherwise the chosen hours only. Hours
// already booked are skipped (can't block a paid slot).
export async function createBlock(_prev: FormState, fd: FormData): Promise<FormState> {
  await admin();
  const dateKey = String(fd.get("date") || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return { error: "Please choose a date." };

  const settings = await getFieldSettings();
  const dayHours = slotHoursForDay(settings, dateKey);
  let hours: number[];
  if (fd.get("whole")) {
    hours = dayHours;
  } else {
    hours = fd
      .getAll("hours")
      .map((h) => Math.floor(Number(h)))
      .filter((h) => dayHours.includes(h));
  }
  if (!hours.length) return { error: "Select at least one hour (or block the whole day)." };

  const date = atUtcMidnight(dateKey);
  const note = String(fd.get("note") || "").trim() || null;
  let created = 0;
  for (const h of hours) {
    try {
      await prisma.fieldSlot.create({
        data: { date, hour: h, kind: FIELD_SLOT_KIND.BLOCK, note },
      });
      created++;
    } catch {
      /* already booked/blocked — skip */
    }
  }
  revalidatePath("/admin/field/blocks");
  revalidatePath("/field");
  if (created === 0) return { error: "Those hours are already booked or blocked." };
  return { ok: true };
}

export async function removeBlock(id: string) {
  await admin();
  // deleteMany lets us guard on kind so we never delete a real booking's slot.
  await prisma.fieldSlot.deleteMany({ where: { id, kind: FIELD_SLOT_KIND.BLOCK } });
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
