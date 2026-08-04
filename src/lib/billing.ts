// Billing engine — turns completed walks into invoices and works out when the
// client's card should be charged, based on their pay cadence.
//
//   DAILY   — each working day is its own period, charged that night.
//   WEEKLY  — Monday–Friday (the working week), charged Friday night.
//   MONTHLY — the calendar month, charged on the last day, that night.
//
// The final invoice is "issued" the evening of the period's last day (a 7pm
// cron), then the card is charged later that night (the charge cron). An OPEN
// invoice with dueAt == null is still accruing; once dueAt is set it's locked
// and awaiting payment.

import { prisma } from "./prisma";
import { PAY_CADENCE, INVOICE_STATUS } from "./constants";
import { atUtcMidnight, dayKey, formatDate, isoWeekday } from "./dates";

export type BillingPeriod = { start: Date; end: Date };

// Which billing period a walk on `day` belongs to (by the day it happened).
export function billingPeriodFor(cadence: string, day: Date | string): BillingPeriod {
  const d = atUtcMidnight(day);

  if (cadence === PAY_CADENCE.DAILY) {
    return { start: d, end: d };
  }

  if (cadence === PAY_CADENCE.MONTHLY) {
    const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
    const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    return { start, end };
  }

  // WEEKLY — Monday to Friday of the week containing `day`.
  const wd = isoWeekday(d); // Mon = 1 … Sun = 7
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (wd - 1));
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  return { start: monday, end: friday };
}

// When the card is actually charged for a period: the last day, at night (9pm
// UTC — a few hours after the 7pm "final invoice" email so the client sees it
// coming). The exact hour only matters relative to when the charge cron runs.
export function dueAtFor(end: Date): Date {
  return new Date(dayKey(end) + "T21:00:00.000Z");
}

// The next payment date for a client, for display ("Payment due Fri 8 Aug").
export function nextPaymentDate(cadence: string, from: Date | string = new Date()): Date {
  return billingPeriodFor(cadence, from).end;
}

// Human label for a period, e.g. "Mon 4 Aug – Fri 8 Aug" or "August 2026".
export function periodLabel(cadence: string, p: BillingPeriod): string {
  if (cadence === PAY_CADENCE.DAILY) return formatDate(p.start);
  if (cadence === PAY_CADENCE.MONTHLY) {
    const MONTHS = ["January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"];
    return `${MONTHS[p.start.getUTCMonth()]} ${p.start.getUTCFullYear()}`;
  }
  return `${formatDate(p.start)} – ${formatDate(p.end)}`;
}

function invoiceLineFor(
  walk: { serviceName: string | null; date: Date },
  dogLabel: string
): string {
  const svc = walk.serviceName ?? "Walk";
  return `${svc} · ${formatDate(walk.date)} · ${dogLabel}`;
}

// Full invoice-line description for a walk, resolving dog names. Reused both when
// an invoice item is first created and when rendering (so older items whose
// stored text still says "1 dog" display the dog's name too).
export async function invoiceLineForWalk(walk: {
  serviceName: string | null;
  date: Date;
  numDogs: number;
  booking: { dogIds: string } | null;
}): Promise<string> {
  return invoiceLineFor(walk, await dogLabelFor(walk));
}

// "Buddy" · "Buddy & Rex" · "Buddy, Max & Rex"
function joinDogNames(names: string[]): string {
  if (names.length <= 1) return names[0] ?? "";
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

// Dog names for a walk's invoice line, from its booking's dog list.
// Falls back to a plain count if the walk has no booking / recorded dogs.
async function dogLabelFor(walk: {
  numDogs: number;
  booking: { dogIds: string } | null;
}): Promise<string> {
  try {
    const ids = walk.booking?.dogIds ? JSON.parse(walk.booking.dogIds) : [];
    if (Array.isArray(ids) && ids.length) {
      const dogs = await prisma.dog.findMany({
        where: { id: { in: ids } },
        select: { name: true },
        orderBy: { createdAt: "asc" },
      });
      const names = dogs.map((d) => d.name).filter(Boolean);
      if (names.length) return joinDogNames(names);
    }
  } catch {}
  return `${walk.numDogs} dog${walk.numDogs > 1 ? "s" : ""}`;
}

// Readable, unique-ish invoice number: INV-YYYYMMDD-XXXX (period end + random).
async function generateInvoiceNumber(end: Date): Promise<string> {
  const base = `INV-${dayKey(end).replace(/-/g, "")}`;
  for (let i = 0; i < 8; i++) {
    const suffix = Math.floor(1000 + Math.random() * 9000);
    const number = `${base}-${suffix}`;
    const clash = await prisma.invoice.findUnique({ where: { number } });
    if (!clash) return number;
  }
  return `${base}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

async function recomputeTotals(invoiceId: string): Promise<void> {
  const agg = await prisma.invoiceItem.aggregate({
    where: { invoiceId },
    _sum: { amount: true },
  });
  const subtotal = agg._sum.amount ?? 0;
  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { subtotal, total: subtotal },
  });
}

// Add a completed walk to its client's open invoice for the right period,
// creating that invoice if it doesn't exist yet. Idempotent: a walk that's
// already on an invoice is skipped (InvoiceItem.walkId is unique).
export async function addCompletedWalkToInvoice(walkId: string): Promise<string | null> {
  const walk = await prisma.walk.findUnique({
    where: { id: walkId },
    include: {
      client: { select: { payCadence: true } },
      invoiceItem: true,
      booking: { select: { dogIds: true } },
    },
  });
  if (!walk) throw new Error("WALK_NOT_FOUND");
  if (walk.invoiceItem) return walk.invoiceItem.invoiceId; // already invoiced
  if (walk.price <= 0) return null;

  const cadence = walk.client.payCadence;
  const { start, end } = billingPeriodFor(cadence, walk.date);

  // Reuse the still-accruing (not yet issued) invoice for this exact period.
  let invoice = await prisma.invoice.findFirst({
    where: {
      clientId: walk.clientId,
      status: INVOICE_STATUS.OPEN,
      dueAt: null,
      periodStart: start,
      periodEnd: end,
    },
  });

  if (!invoice) {
    invoice = await prisma.invoice.create({
      data: {
        number: await generateInvoiceNumber(end),
        clientId: walk.clientId,
        cadence,
        status: INVOICE_STATUS.OPEN,
        periodStart: start,
        periodEnd: end,
      },
    });
  }

  await prisma.invoiceItem.create({
    data: {
      invoiceId: invoice.id,
      walkId: walk.id,
      description: invoiceLineFor(walk, await dogLabelFor(walk)),
      date: walk.date,
      amount: walk.price,
    },
  });
  await recomputeTotals(invoice.id);
  return invoice.id;
}
