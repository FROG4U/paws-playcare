// Finalising a field booking once its card payment clears. Called from the
// Stripe webhook. Idempotent — safe to run more than once for the same intent.

import type Stripe from "stripe";
import { prisma } from "./prisma";
import { getStripe } from "./stripe";
import { getFieldSettings, groupSlotsByDay } from "./field";
import { sendFieldConfirmation } from "./field-email";
import { notifyAdmins } from "./notifications";
import { FIELD_BOOKING_STATUS, NOTIF_TYPE } from "./constants";
import { formatMoney } from "./money";
import { formatDate } from "./dates";

// Back-compat wrapper for the Stripe webhook (paid via a PaymentIntent).
export async function markFieldBookingPaid(
  bookingId: string,
  pi: Stripe.PaymentIntent
): Promise<void> {
  return finalizeFieldBookingPaid(bookingId, pi);
}

// Finalise a reserved booking: mark PAID, count the coupon, cache a saved card
// (if a PaymentIntent opted in), send the confirmation email and notify admins.
// `pi` is null for free bookings (a full discount → nothing to pay), which
// still get the confirmation email exactly as paid ones do.
export async function finalizeFieldBookingPaid(
  bookingId: string,
  pi?: Stripe.PaymentIntent | null
): Promise<void> {
  const booking = await prisma.fieldBooking.findUnique({
    where: { id: bookingId },
    include: { slots: true },
  });
  if (!booking || booking.status === FIELD_BOOKING_STATUS.PAID) return; // idempotent

  await prisma.fieldBooking.update({
    where: { id: bookingId },
    data: {
      status: FIELD_BOOKING_STATUS.PAID,
      paidAt: new Date(),
      stripePaymentIntentId: pi?.id ?? booking.stripePaymentIntentId,
    },
  });

  // Count a coupon use exactly once (on payment, not on reservation).
  if (booking.couponCode) {
    await prisma.fieldCoupon.updateMany({
      where: { code: booking.couponCode },
      data: { usedCount: { increment: 1 } },
    });
  }

  // Cache the saved card onto the account holder if they opted in.
  if (booking.clientId && pi?.setup_future_usage && pi.payment_method) {
    try {
      const pmId =
        typeof pi.payment_method === "string" ? pi.payment_method : pi.payment_method.id;
      const stripe = getStripe();
      const pm = await stripe.paymentMethods.retrieve(pmId);
      if (typeof pi.customer === "string") {
        await stripe.customers.update(pi.customer, {
          invoice_settings: { default_payment_method: pmId },
        });
      }
      await prisma.user.update({
        where: { id: booking.clientId },
        data: {
          paymentMethodId: pmId,
          cardBrand: pm.card?.brand ?? null,
          cardLast4: pm.card?.last4 ?? null,
          cardExpMonth: pm.card?.exp_month ?? null,
          cardExpYear: pm.card?.exp_year ?? null,
          cardExpiryNotifiedAt: null,
        },
      });
    } catch {
      /* card caching is best-effort; payment already succeeded */
    }
  }

  // The confirmation email (with the gate/padlock access codes) — send once.
  if (!booking.emailSentAt) {
    const settings = await getFieldSettings();
    const res = await sendFieldConfirmation({
      settings,
      to: booking.email,
      clientName: booking.name,
      reference: booking.reference,
      groups: groupSlotsByDay(booking.slots),
      total: booking.total,
    });
    if (res.ok) {
      await prisma.fieldBooking.update({
        where: { id: bookingId },
        data: { emailSentAt: new Date() },
      });
    }
  }

  await notifyAdmins({
    type: NOTIF_TYPE.FIELD_BOOKING_PAID,
    title: `Field booking paid — ${formatMoney(booking.total)}`,
    body: `${booking.name} booked ${booking.numSlots} slot${
      booking.numSlots > 1 ? "s" : ""
    } on ${formatDate(booking.date)} · ${booking.reference}.`,
    link: "/admin/field/bookings",
  });
}
