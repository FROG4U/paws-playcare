"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES, NOTIF_TYPE, WALK_STATUS } from "@/lib/constants";
import { notify } from "@/lib/notifications";
import { addCompletedWalkToInvoice, nextPaymentDate } from "@/lib/billing";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

function refresh() {
  revalidatePath("/admin/bookings");
  revalidatePath("/admin");
  revalidatePath("/client/walks");
  revalidatePath("/client/invoices");
  revalidatePath("/client");
}

type Result = { ok: true } | { ok: false; error: string };

// Mark a walk as done → it's added to the client's current invoice and they're
// told what they owe and when it'll be taken.
export async function completeWalk(walkId: string): Promise<Result> {
  const user = await requireRole([ROLES.ADMIN, ROLES.WORKER]);
  const walk = await prisma.walk.findUnique({
    where: { id: walkId },
    include: { client: { select: { id: true, payCadence: true } } },
  });
  if (!walk) return { ok: false, error: "Walk not found." };
  if (walk.status === WALK_STATUS.CANCELLED)
    return { ok: false, error: "That walk was cancelled." };
  if (walk.status === WALK_STATUS.COMPLETED)
    return { ok: false, error: "That walk is already completed." };

  await prisma.walk.update({
    where: { id: walkId },
    data: {
      status: WALK_STATUS.COMPLETED,
      completedAt: new Date(),
      completedById: user.id,
    },
  });

  if (walk.noCharge) {
    // Completed as a courtesy — not billed.
    await notify({
      userId: walk.client.id,
      type: NOTIF_TYPE.WALK_COMPLETED,
      title: "Walk completed 🐾",
      body: `${walk.serviceName ?? "Your walk"} on ${formatDate(walk.date)} is done — no charge this time.`,
      link: "/client/walks",
    });
    refresh();
    return { ok: true };
  }

  await addCompletedWalkToInvoice(walkId);

  const due = nextPaymentDate(walk.client.payCadence, walk.date);
  await notify({
    userId: walk.client.id,
    type: NOTIF_TYPE.WALK_COMPLETED,
    title: "Walk completed 🐾",
    body: `${walk.serviceName ?? "Your walk"} on ${formatDate(walk.date)} is done — ${formatMoney(walk.price)} added to your account. Payment due ${formatDate(due)}.`,
    link: "/client/invoices",
  });

  refresh();
  return { ok: true };
}

// Complete several walks at once ("select all"). Each is added to the client's
// invoice exactly like a single completion.
export async function completeWalks(
  ids: string[]
): Promise<{ ok: true; completed: number; failed: number }> {
  await requireRole([ROLES.ADMIN, ROLES.WORKER]);
  let completed = 0;
  let failed = 0;
  for (const id of [...new Set(ids)].slice(0, 300)) {
    const res = await completeWalk(id);
    if (res.ok) completed++;
    else failed++;
  }
  return { ok: true, completed, failed };
}

// Undo an accidental completion (same-day safety) — pulls it back off the
// invoice, but only while that invoice is still open (not yet issued/charged).
export async function undoComplete(walkId: string): Promise<Result> {
  await requireRole([ROLES.ADMIN]);
  const walk = await prisma.walk.findUnique({
    where: { id: walkId },
    include: { invoiceItem: { include: { invoice: true } } },
  });
  if (!walk) return { ok: false, error: "Walk not found." };
  if (walk.status !== WALK_STATUS.COMPLETED)
    return { ok: false, error: "That walk isn't completed." };

  const invoice = walk.invoiceItem?.invoice;
  if (invoice && (invoice.status !== "OPEN" || invoice.dueAt)) {
    return { ok: false, error: "That walk is on an invoice that's already been issued." };
  }

  await prisma.$transaction(async (tx) => {
    if (walk.invoiceItem) {
      const invoiceId = walk.invoiceItem.invoiceId;
      await tx.invoiceItem.delete({ where: { id: walk.invoiceItem.id } });
      const agg = await tx.invoiceItem.aggregate({
        where: { invoiceId },
        _sum: { amount: true },
      });
      const remaining = agg._sum.amount ?? 0;
      if (remaining === 0) {
        await tx.invoice.delete({ where: { id: invoiceId } });
      } else {
        await tx.invoice.update({
          where: { id: invoiceId },
          data: { subtotal: remaining, total: remaining },
        });
      }
    }
    await tx.walk.update({
      where: { id: walkId },
      data: { status: WALK_STATUS.ACCEPTED, completedAt: null, completedById: null },
    });
  });

  refresh();
  return { ok: true };
}
