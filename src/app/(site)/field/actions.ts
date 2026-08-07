"use server";

import { prisma } from "@/lib/prisma";
import { atUtcMidnight, dayKey } from "@/lib/dates";
import {
  getFieldSettings,
  slotHoursForDay,
  takenHoursForDay,
  priceFor,
  findUsableCoupon,
  makeReference,
  releaseStaleFieldHolds,
  buildDayView,
  type SlotView,
  type Season,
} from "@/lib/field";
import {
  FIELD_BOOKING_STATUS,
  FIELD_SLOT_KIND,
  ROLES,
  USER_STATUS,
} from "@/lib/constants";
import { getCurrentUser, hashPassword, createSession } from "@/lib/auth";
import {
  stripeConfigured,
  ensureCustomer,
  createFieldPaymentIntent,
} from "@/lib/stripe";
import { finalizeFieldBookingPaid } from "@/lib/field-run";
import { rateLimit, clientIp, friendlyTooMany } from "@/lib/rate-limit";
import { penceToPounds } from "@/lib/money";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type PricePreview = {
  ok: boolean;
  error?: string;
  numSlots: number;
  subtotal: number;
  discount: number;
  total: number;
  couponApplied: boolean;
};

// Live price + coupon check as the customer edits their selection.
export async function previewPrice(
  numSlots: number,
  couponCode: string
): Promise<PricePreview> {
  const settings = await getFieldSettings();
  const n = Math.max(0, Math.floor(numSlots || 0));
  const { coupon, error } = await findUsableCoupon(couponCode || "", new Date());
  const b = priceFor(settings, n, coupon);
  return {
    ok: !error,
    error: couponCode.trim() ? error : undefined,
    numSlots: n,
    subtotal: b.subtotal,
    discount: b.discount,
    total: b.total,
    couponApplied: !!coupon,
  };
}

export type DaySummary = {
  dateKey: string;
  season: Season;
  open: boolean; // within the booking horizon, not in the past, has slots
  availableCount: number;
  slots: SlotView[];
};

// Availability for a whole month, for the public calendar. One DB query for the
// month's reserved/blocked slots, then each day is built from settings.
export async function monthView(
  year: number,
  month: number // 1–12
): Promise<{ slotPrice: number; maxAdvanceDays: number; days: DaySummary[] }> {
  const settings = await getFieldSettings();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  const start = atUtcMidnight(`${year}-${pad(month)}-01`);
  const end = atUtcMidnight(`${year}-${pad(month)}-${pad(daysInMonth)}`);
  const rows = await prisma.fieldSlot.findMany({
    where: { date: { gte: start, lte: end } },
    select: { date: true, hour: true, kind: true },
  });
  const byDay = new Map<string, Map<number, string>>();
  for (const r of rows) {
    const k = dayKey(r.date);
    if (!byDay.has(k)) byDay.set(k, new Map());
    byDay.get(k)!.set(r.hour, r.kind);
  }

  const todayKey = dayKey(now);
  const horizonKey = dayKey(new Date(now.getTime() + settings.maxAdvanceDays * 86400000));

  const days: DaySummary[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${pad(month)}-${pad(d)}`;
    const within = key >= todayKey && key <= horizonKey;
    const { season, slots } = buildDayView(settings, key, byDay.get(key) ?? new Map(), now);
    days.push({
      dateKey: key,
      season,
      open: within && slots.length > 0,
      availableCount: within ? slots.filter((s) => s.available).length : 0,
      slots: within ? slots : [],
    });
  }
  return { slotPrice: settings.slotPrice, maxAdvanceDays: settings.maxAdvanceDays, days };
}

export type StartResult =
  | { ok: true; free: true; reference: string } // nothing to pay → already confirmed
  | { ok: true; free: false; clientSecret: string; reference: string; total: number }
  | { ok: false; error: string };

// A day's chosen hours. A booking can span several days (multi-day cart).
export type DaySelection = { dateKey: string; hours: number[] };

export type StartInput = {
  selection: DaySelection[];
  name: string;
  email: string;
  phone: string; // required
  couponCode?: string;
  createAccount?: boolean;
  password?: string;
  saveCard?: boolean;
};

// Stripe's minimum GBP charge is £0.30 — anything below it (incl. a full
// discount) is treated as "nothing to pay": no card, booking confirmed instantly.
const STRIPE_MIN_PENCE = 30;

// Reserve the chosen slots (across one or more days) and either open a Stripe
// PaymentIntent, or — when there's nothing to pay — confirm immediately. Paid
// bookings are finalised by the webhook; free ones are finalised here. Both
// send the confirmation email.
export async function startFieldBooking(input: StartInput): Promise<StartResult> {
  const ip = await clientIp();
  if (!rateLimit(`field-book:${ip}`, 12, 10 * 60_000).ok) {
    return { ok: false, error: friendlyTooMany };
  }

  const now = new Date();
  // Self-heal: release any abandoned holds before we validate availability.
  await releaseStaleFieldHolds(now).catch(() => {});

  const name = String(input.name || "").trim();
  const email = String(input.email || "").trim().toLowerCase();
  const phone = String(input.phone || "").trim();

  if (!name) return { ok: false, error: "Please enter your name." };
  if (!EMAIL_RE.test(email)) return { ok: false, error: "Please enter a valid email address." };
  if (phone.replace(/[^0-9]/g, "").length < 7) {
    return { ok: false, error: "Please enter a valid phone number." };
  }

  const settings = await getFieldSettings();
  const todayKey = dayKey(now);
  const horizonKey = dayKey(new Date(now.getTime() + settings.maxAdvanceDays * 86400000));

  // Validate + flatten the multi-day selection into unique {dateKey, hour} slots.
  const flat: { dateKey: string; hour: number }[] = [];
  const seen = new Set<string>();
  for (const group of input.selection || []) {
    const key = String(group?.dateKey || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return { ok: false, error: "Please choose a date." };
    if (key < todayKey) return { ok: false, error: "One of those dates has already passed." };
    if (key > horizonKey) {
      return { ok: false, error: `Bookings only open ${settings.maxAdvanceDays} days ahead.` };
    }
    const valid = new Set(slotHoursForDay(settings, key));
    for (const h of (group.hours || []).map((x) => Math.floor(x))) {
      if (!valid.has(h)) {
        return { ok: false, error: "One of those times isn't available on that day." };
      }
      const startMs = new Date(`${key}T${String(h).padStart(2, "0")}:00:00.000Z`).getTime();
      if (startMs <= now.getTime()) {
        return { ok: false, error: "One of those times has already started. Please refresh and pick again." };
      }
      const sk = `${key}:${h}`;
      if (seen.has(sk)) continue;
      seen.add(sk);
      flat.push({ dateKey: key, hour: h });
    }
  }
  if (!flat.length) return { ok: false, error: "Please choose at least one time slot." };

  // Availability check per distinct day (the unique [date,hour] index is the
  // hard guarantee; this gives a friendlier message).
  const days = [...new Set(flat.map((f) => f.dateKey))].sort();
  for (const d of days) {
    const taken = await takenHoursForDay(d);
    if (flat.some((f) => f.dateKey === d && taken.has(f.hour))) {
      return { ok: false, error: "Sorry — one of those times was just taken. Please pick again." };
    }
  }

  // Coupon (optional). A typed-but-invalid code blocks so the customer notices.
  const { coupon, error: couponErr } = await findUsableCoupon(input.couponCode || "", now);
  if (input.couponCode?.trim() && couponErr) return { ok: false, error: couponErr };
  const price = priceFor(settings, flat.length, coupon);
  const isFree = price.total < STRIPE_MIN_PENCE;

  if (!isFree && !stripeConfigured()) {
    return { ok: false, error: "Online payment isn't available right now. Please try again later." };
  }

  // Who is this for? Logged-in field client, a new account, or a guest.
  const current = await getCurrentUser();
  let clientId: string | null = null;
  let wantSaveCard = false;

  if (current && current.role === ROLES.FIELD_CLIENT) {
    if (current.fieldBlockedAt) {
      return { ok: false, error: "Your account can't book right now — please contact us." };
    }
    clientId = current.id;
    wantSaveCard = !!input.saveCard;
  } else if (input.createAccount) {
    const password = String(input.password || "");
    if (password.length < 8) {
      return { ok: false, error: "Choose a password of at least 8 characters." };
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return { ok: false, error: "An account with that email already exists — please log in first." };
    }
    const user = await prisma.user.create({
      data: {
        email,
        name,
        phone,
        passwordHash: await hashPassword(password),
        role: ROLES.FIELD_CLIENT,
        status: USER_STATUS.ACTIVE,
        approvedAt: now,
      },
    });
    clientId = user.id;
    wantSaveCard = !!input.saveCard;
    // Log them in so they land in their account after booking.
    await createSession({ uid: user.id, role: user.role, name: user.name });
  }

  const earliestKey = days[0];
  const reference = makeReference(earliestKey);

  // Reserve the slots (unique [date,hour] blocks any concurrent double-book).
  let bookingId: string;
  try {
    const booking = await prisma.$transaction(async (tx) => {
      const b = await tx.fieldBooking.create({
        data: {
          reference,
          clientId,
          name,
          email,
          phone,
          date: atUtcMidnight(earliestKey),
          slotPrice: price.slotPrice,
          numSlots: price.numSlots,
          subtotal: price.subtotal,
          discount: price.discount,
          total: price.total,
          couponCode: price.couponCode,
          status: FIELD_BOOKING_STATUS.PENDING,
        },
      });
      await tx.fieldSlot.createMany({
        data: flat.map((f) => ({
          date: atUtcMidnight(f.dateKey),
          hour: f.hour,
          kind: FIELD_SLOT_KIND.BOOKING,
          bookingId: b.id,
        })),
      });
      return b;
    });
    bookingId = booking.id;
  } catch {
    return { ok: false, error: "Sorry — one of those times was just taken. Please pick again." };
  }

  // Nothing to pay (full discount): confirm now + send the email, no Stripe.
  if (isFree) {
    try {
      await finalizeFieldBookingPaid(bookingId, null);
    } catch {
      /* email is best-effort; the booking is already reserved + confirmed */
    }
    return { ok: true, free: true, reference };
  }

  // Otherwise open the PaymentIntent (card entered + confirmed on the page).
  try {
    let customerId: string | null = null;
    if (clientId && wantSaveCard) customerId = await ensureCustomer(clientId);

    const intent = await createFieldPaymentIntent({
      amount: price.total,
      description: `Playground hire — ${reference} (${flat.length} × 1hr)`,
      metadata: { fieldBookingId: bookingId, reference },
      customerId,
      saveCard: wantSaveCard,
      receiptEmail: email,
    });

    if (!intent.client_secret) throw new Error("no client secret");

    await prisma.fieldBooking.update({
      where: { id: bookingId },
      data: { stripePaymentIntentId: intent.id },
    });

    return { ok: true, free: false, clientSecret: intent.client_secret, reference, total: price.total };
  } catch {
    // Roll back the reservation so the slots free up again.
    await prisma.fieldBooking.delete({ where: { id: bookingId } }).catch(() => {});
    return {
      ok: false,
      error: `We couldn't start the £${penceToPounds(price.total)} payment. Please try again.`,
    };
  }
}
