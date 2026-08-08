// The two scheduled billing jobs:
//   finalizeDueInvoices — run ~7pm: for any client whose period ended today,
//     lock the invoice (set dueAt), email it, and notify them.
//   chargeDueInvoices   — run later that night: charge the saved card for every
//     issued invoice whose dueAt has passed; mark Paid / Failed.
// Both are idempotent and safe to run more than once.

import { prisma } from "./prisma";
import { INVOICE_STATUS, NOTIF_TYPE, USER_STATUS, WALK_STATUS, ROLES } from "./constants";
import { atUtcMidnight, dayKey, formatDate } from "./dates";
import { formatMoney } from "./money";
import { dueAtFor, periodLabel } from "./billing";
import { chargeOffSession } from "./stripe";
import { sendEmail, emailShell } from "./email";
import { sendCardReminderEmail } from "./account-emails";
import { notify, notifyAdmins } from "./notifications";

const GRACE_DAYS = 7; // how long an unpaid invoice is retried before the account is blocked

const appUrl = () =>
  (process.env.NEXT_PUBLIC_APP_URL || "https://pawsplaycare.co.uk").replace(/\/$/, "");

type InvoiceWithItems = {
  id: string;
  number: string;
  cadence: string;
  periodStart: Date;
  periodEnd: Date;
  total: number;
  dueAt: Date;
  items: { description: string; amount: number }[];
  clientName: string;
};

function invoiceEmailHtml(inv: InvoiceWithItems): string {
  const rows = inv.items
    .map(
      (it) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #eef2f7;">${it.description}</td>
         <td style="padding:8px 0;border-bottom:1px solid #eef2f7;text-align:right;font-weight:600;">${formatMoney(it.amount)}</td></tr>`
    )
    .join("");

  const body = `
    <p style="margin:0 0 16px;">Hi ${inv.clientName.split(" ")[0]}, here's your final invoice for
      <strong>${periodLabel(inv.cadence, { start: inv.periodStart, end: inv.periodEnd })}</strong>.</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px;">${rows}
      <tr><td style="padding:12px 0 0;font-weight:800;">Total</td>
          <td style="padding:12px 0 0;text-align:right;font-weight:800;font-size:18px;">${formatMoney(inv.total)}</td></tr>
    </table>
    <p style="margin:20px 0 0;padding:12px 16px;background:#eef7fb;border-radius:10px;color:#1f6f95;font-size:14px;">
      💳 We'll take <strong>${formatMoney(inv.total)}</strong> from your card on file on <strong>${formatDate(inv.dueAt)}</strong>.
      Nothing to do — just making sure you've seen it first.</p>
    <p style="margin:20px 0 0;">
      <a href="${appUrl()}/client/invoices/${inv.id}"
         style="display:inline-block;background:#2ea6d8;color:#fff;text-decoration:none;padding:11px 20px;border-radius:12px;font-weight:700;">View &amp; download invoice</a>
    </p>
    <p style="margin:20px 0 0;color:#333a41;">Thank you for choosing us — we loved spending time with your dog! 🐾</p>
    <p style="margin:12px 0 0;font-size:13px;color:#64748b;">Invoice ${inv.number}</p>`;

  return emailShell("Your invoice is ready", body);
}

export async function finalizeDueInvoices(now: Date = new Date()) {
  const todayKey = dayKey(now);
  const candidates = await prisma.invoice.findMany({
    where: { status: INVOICE_STATUS.OPEN, dueAt: null },
    include: {
      items: { orderBy: { date: "asc" } },
      client: { select: { id: true, name: true, email: true } },
    },
  });

  let issued = 0;
  let emailed = 0;
  let voided = 0;

  for (const inv of candidates) {
    if (dayKey(inv.periodEnd) > todayKey) continue; // period not finished yet

    if (inv.total <= 0 || inv.items.length === 0) {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { status: INVOICE_STATUS.VOID },
      });
      voided++;
      continue;
    }

    const dueAt = dueAtFor(inv.periodEnd);
    await prisma.invoice.update({ where: { id: inv.id }, data: { dueAt } });
    issued++;

    await notify({
      userId: inv.client.id,
      type: NOTIF_TYPE.INVOICE_ISSUED,
      title: `Your invoice: ${formatMoney(inv.total)}`,
      body: `Your ${periodLabel(inv.cadence, { start: inv.periodStart, end: inv.periodEnd })} invoice is ${formatMoney(inv.total)}. Payment will be taken ${formatDate(dueAt)}.`,
      link: "/client/invoices",
    });

    const res = await sendEmail({
      to: inv.client.email,
      subject: `Your Paws Playcare invoice — ${formatMoney(inv.total)}`,
      html: invoiceEmailHtml({
        id: inv.id,
        number: inv.number,
        cadence: inv.cadence,
        periodStart: inv.periodStart,
        periodEnd: inv.periodEnd,
        total: inv.total,
        dueAt,
        items: inv.items,
        clientName: inv.client.name,
      }),
    });
    if (res.ok && !res.skipped) emailed++;
  }

  return { issued, emailed, voided };
}

export async function chargeDueInvoices(now: Date = new Date()) {
  const graceStart = new Date(now.getTime() - GRACE_DAYS * 86400000);

  // Issued invoices that are due: OPEN (first attempt) plus FAILED ones still
  // inside the grace window (nightly retry — e.g. after the client fixes a card).
  const due = await prisma.invoice.findMany({
    where: {
      status: { in: [INVOICE_STATUS.OPEN, INVOICE_STATUS.FAILED] },
      dueAt: { not: null, lte: now },
    },
    include: {
      client: { select: { id: true, status: true, paymentMethodId: true } },
    },
  });

  let paid = 0;
  let failed = 0;

  for (const inv of due) {
    // Overdue past grace → leave it for blockOverdueClients, don't keep retrying.
    if (inv.status === INVOICE_STATUS.FAILED && inv.dueAt && inv.dueAt < graceStart) {
      continue;
    }

    if (!inv.client.paymentMethodId) {
      await prisma.invoice.update({
        where: { id: inv.id },
        data: {
          status: INVOICE_STATUS.FAILED,
          failureReason: "No card on file",
          attemptCount: { increment: 1 },
        },
      });
      await notify({
        userId: inv.client.id,
        type: NOTIF_TYPE.PAYMENT_FAILED,
        title: "Add a card to pay your invoice",
        body: `We couldn't take ${formatMoney(inv.total)} — there's no card on your account. Please add one.`,
        link: "/client/payment",
      });
      failed++;
      continue;
    }

    try {
      const pi = await chargeOffSession({
        userId: inv.client.id,
        amount: inv.total,
        description: `Paws Playcare invoice ${inv.number}`,
        // Per-attempt key so retries genuinely re-charge, not return the old result.
        idempotencyKey: `inv_${inv.id}_${inv.attemptCount}`,
        metadata: { invoiceId: inv.id, invoiceNumber: inv.number },
      });
      await prisma.invoice.update({
        where: { id: inv.id },
        data: {
          status: INVOICE_STATUS.PAID,
          paidAt: new Date(),
          stripePaymentIntentId: pi.id,
          failureReason: null,
          attemptCount: { increment: 1 },
        },
      });
      // If they were suspended for non-payment, paying reactivates them.
      if (inv.client.status === USER_STATUS.SUSPENDED) {
        await prisma.user.update({
          where: { id: inv.client.id },
          data: { status: USER_STATUS.ACTIVE, suspendReason: null },
        });
        await notify({
          userId: inv.client.id,
          type: NOTIF_TYPE.ACCOUNT_APPROVED,
          title: "Account reactivated",
          body: "Thanks for settling up — your account is active again and you can book walks.",
          link: "/client/book",
        });
      }
      await notify({
        userId: inv.client.id,
        type: NOTIF_TYPE.PAYMENT_SUCCEEDED,
        title: `Payment received — ${formatMoney(inv.total)}`,
        body: `Thanks! We've taken ${formatMoney(inv.total)} for invoice ${inv.number}.`,
        link: "/client/invoices",
      });
      paid++;
    } catch (e) {
      const reason = e instanceof Error ? e.message : "Payment failed";
      await prisma.invoice.update({
        where: { id: inv.id },
        data: {
          status: INVOICE_STATUS.FAILED,
          failureReason: reason,
          attemptCount: { increment: 1 },
        },
      });
      await notify({
        userId: inv.client.id,
        type: NOTIF_TYPE.PAYMENT_FAILED,
        title: "Payment failed",
        body: `We couldn't take ${formatMoney(inv.total)} for invoice ${inv.number}. Please check your card.`,
        link: "/client/payment",
      });
      failed++;
    }
  }

  return { paid, failed };
}

// ── Daily maintenance ──────────────────────────────────────────────────────

// Warn clients whose saved card expires soon (within ~45 days) — once per card.
// saveCardFromSetupIntent resets cardExpiryNotifiedAt when a new card is saved.
export async function warnExpiringCards(now: Date = new Date()) {
  const WINDOW_DAYS = 45;
  const users = await prisma.user.findMany({
    where: {
      paymentMethodId: { not: null },
      cardExpMonth: { not: null },
      cardExpYear: { not: null },
      cardExpiryNotifiedAt: null,
    },
    select: {
      id: true,
      name: true,
      email: true,
      cardBrand: true,
      cardLast4: true,
      cardExpMonth: true,
      cardExpYear: true,
    },
  });

  let warned = 0;
  for (const u of users) {
    // Last moment the card is valid = end of its expiry month.
    const expEnd = new Date(
      Date.UTC(u.cardExpYear!, u.cardExpMonth!, 0, 23, 59, 59, 999)
    );
    const days = (expEnd.getTime() - now.getTime()) / 86400000;
    if (days > WINDOW_DAYS) continue;

    const mmYY = `${String(u.cardExpMonth).padStart(2, "0")}/${String(u.cardExpYear).slice(-2)}`;
    const cardLabel = `${u.cardBrand ?? "card"} ···· ${u.cardLast4 ?? "----"}`;
    const expired = days < 0;

    await notify({
      userId: u.id,
      type: NOTIF_TYPE.CARD_EXPIRING,
      title: expired ? "Your card has expired" : "Your card is expiring soon",
      body: `Your ${cardLabel} ${expired ? "expired" : "expires"} ${mmYY}. Please add a new card so payments don't fail.`,
      link: "/client/payment",
    });

    await sendEmail({
      to: u.email,
      subject: expired
        ? "Your Paws Playcare card has expired"
        : "Your Paws Playcare card expires soon",
      html: emailShell(
        expired ? "Your card has expired" : "Your card is expiring soon",
        `<p style="margin:0 0 12px;">Hi ${u.name.split(" ")[0]}, your saved card (<strong>${cardLabel}</strong>) ${expired ? "expired" : "expires"} <strong>${mmYY}</strong>.</p>
         <p style="margin:0 0 16px;">Please add a new card so your walk payments keep going through.</p>
         <a href="${(process.env.NEXT_PUBLIC_APP_URL || "https://pawsplaycare.co.uk").replace(/\/$/, "")}/client/payment"
            style="display:inline-block;background:#2ea6d8;color:#fff;text-decoration:none;padding:12px 20px;border-radius:12px;font-weight:700;">Update my card</a>`
      ),
    });

    await prisma.user.update({
      where: { id: u.id },
      data: { cardExpiryNotifiedAt: now },
    });
    warned++;
  }

  return { warned };
}

// Block clients with an invoice still unpaid more than GRACE_DAYS past its due
// date: suspend the account and cancel their upcoming walks. They reactivate by
// paying (handled in chargeDueInvoices).
// Chase active clients who still have no payment card on file — an in-app
// notification + email asking them to add one. Deduped: at most once every 3
// days per client (won't repeat while a recent ADD_CARD notification exists).
export async function remindClientsWithoutCard(now: Date = new Date()) {
  const clients = await prisma.user.findMany({
    where: {
      role: ROLES.CLIENT,
      status: USER_STATUS.ACTIVE,
      paymentMethodId: null,
      archivedAt: null,
    },
    select: { id: true, name: true, email: true },
  });

  const since = new Date(now.getTime() - 3 * 86400000);
  let cardReminders = 0;
  for (const c of clients) {
    const recent = await prisma.notification.findFirst({
      where: { userId: c.id, type: NOTIF_TYPE.ADD_CARD, createdAt: { gte: since } },
      select: { id: true },
    });
    if (recent) continue;

    await notify({
      userId: c.id,
      type: NOTIF_TYPE.ADD_CARD,
      title: "Add your payment details",
      body: "Please enter your payment card to secure your bookings — without a card on file, your bookings may be cancelled.",
      link: "/client/payment",
    });
    try {
      await sendCardReminderEmail(c.email, c.name);
    } catch {
      // ignore email failures
    }
    cardReminders += 1;
  }
  return { cardReminders };
}

export async function blockOverdueClients(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - GRACE_DAYS * 86400000);

  const overdue = await prisma.invoice.findMany({
    where: {
      status: INVOICE_STATUS.FAILED,
      dueAt: { not: null, lt: cutoff },
      client: { status: USER_STATUS.ACTIVE },
    },
    select: {
      clientId: true,
      number: true,
      total: true,
      client: { select: { name: true } },
    },
    orderBy: { dueAt: "asc" },
  });

  const handled = new Set<string>();
  let blocked = 0;

  for (const inv of overdue) {
    if (handled.has(inv.clientId)) continue;
    handled.add(inv.clientId);

    const reason = `Payment overdue — invoice ${inv.number} (${formatMoney(inv.total)}) has been unpaid for over ${GRACE_DAYS} days.`;

    await prisma.user.update({
      where: { id: inv.clientId },
      data: { status: USER_STATUS.SUSPENDED, suspendReason: reason },
    });

    await prisma.walk.updateMany({
      where: {
        clientId: inv.clientId,
        status: {
          in: [WALK_STATUS.REQUESTED, WALK_STATUS.ASSIGNED, WALK_STATUS.ACCEPTED],
        },
        date: { gte: atUtcMidnight(now) },
      },
      data: {
        status: WALK_STATUS.CANCELLED,
        cancelledAt: now,
        cancelReason: "Account on hold — unpaid invoice",
      },
    });

    await notify({
      userId: inv.clientId,
      type: NOTIF_TYPE.ACCOUNT_SUSPENDED,
      title: "Account on hold",
      body: `Invoice ${inv.number} (${formatMoney(inv.total)}) is still unpaid. We've paused your bookings and cancelled upcoming walks. Add a working card to settle up and reactivate.`,
      link: "/client/payment",
    });

    await notifyAdmins({
      type: NOTIF_TYPE.ACCOUNT_SUSPENDED,
      title: `${inv.client.name} suspended (unpaid)`,
      body: `Invoice ${inv.number} (${formatMoney(inv.total)}) unpaid for ${GRACE_DAYS}+ days. Upcoming walks cancelled.`,
      link: "/admin/clients",
    });

    blocked++;
  }

  return { blocked };
}

// Evening nudge: if any walks up to today still aren't completed, remind the
// admins to mark them done (also delivered as a phone push). Run ~7pm.
export async function remindAdminsToComplete(
  now: Date
): Promise<{ completeReminder: number }> {
  const todayEnd = new Date(dayKey(now) + "T23:59:59.999Z");
  const count = await prisma.walk.count({
    where: {
      status: { in: [WALK_STATUS.REQUESTED, WALK_STATUS.ASSIGNED, WALK_STATUS.ACCEPTED] },
      date: { lte: todayEnd },
    },
  });
  if (count === 0) return { completeReminder: 0 };
  await notifyAdmins({
    type: NOTIF_TYPE.COMPLETE_REMINDER,
    title: `${count} walk${count > 1 ? "s" : ""} to complete`,
    body: `You have ${count} walk${count > 1 ? "s" : ""} up to today ready to mark as done.`,
    link: "/admin/bookings",
  });
  return { completeReminder: count };
}
