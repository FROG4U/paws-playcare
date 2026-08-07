import type Stripe from "stripe";
import { getStripe, stripeConfigured } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";
import { INVOICE_STATUS, FIELD_BOOKING_STATUS, NOTIF_TYPE } from "@/lib/constants";
import { notify } from "@/lib/notifications";
import { markFieldBookingPaid } from "@/lib/field-run";
import { formatMoney } from "@/lib/money";

export const dynamic = "force-dynamic";

// Stripe payment webhook. Confirms every charge back to the app so invoice
// status is reliable even if a cron run is interrupted. Inert (503) until
// STRIPE_WEBHOOK_SECRET is set. Add the endpoint in Stripe →
// https://pawsplaycare.co.uk/api/stripe/webhook and paste the whsec_… secret.
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripeConfigured() || !secret) {
    return new Response("Stripe webhook not configured", { status: 503 });
  }

  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  const body = await req.text(); // raw body required for signature check
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(body, sig, secret);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  if (
    event.type === "payment_intent.succeeded" ||
    event.type === "payment_intent.payment_failed"
  ) {
    const pi = event.data.object as Stripe.PaymentIntent;

    // Field / playground bookings (paid on the page, finalised here).
    const fieldBookingId = pi.metadata?.fieldBookingId;
    if (fieldBookingId) {
      if (event.type === "payment_intent.succeeded") {
        await markFieldBookingPaid(fieldBookingId, pi);
      } else {
        // Leave the slots reserved briefly so the customer can retry the same
        // PaymentIntent; the stale-hold reaper frees them if they don't.
        await prisma.fieldBooking.updateMany({
          where: { id: fieldBookingId, status: FIELD_BOOKING_STATUS.PENDING },
          data: { status: FIELD_BOOKING_STATUS.FAILED },
        });
      }
      return Response.json({ received: true });
    }

    const invoiceId = pi.metadata?.invoiceId;
    if (invoiceId) {
      const invoice = await prisma.invoice.findUnique({ where: { id: invoiceId } });
      if (invoice && invoice.status !== INVOICE_STATUS.PAID) {
        if (event.type === "payment_intent.succeeded") {
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              status: INVOICE_STATUS.PAID,
              paidAt: new Date(),
              stripePaymentIntentId: pi.id,
              failureReason: null,
            },
          });
          await notify({
            userId: invoice.clientId,
            type: NOTIF_TYPE.PAYMENT_SUCCEEDED,
            title: `Payment received — ${formatMoney(invoice.total)}`,
            body: `Thanks! We've received ${formatMoney(invoice.total)} for invoice ${invoice.number}.`,
            link: "/client/invoices",
          });
        } else {
          await prisma.invoice.update({
            where: { id: invoiceId },
            data: {
              status: INVOICE_STATUS.FAILED,
              failureReason: pi.last_payment_error?.message ?? "Payment failed",
            },
          });
        }
      }
    }
  }

  return Response.json({ received: true });
}
