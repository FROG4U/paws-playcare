"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  ROLES,
  NOTIF_TYPE,
  WALK_STATUS,
  CHANGE_REQUEST_STATUS,
} from "@/lib/constants";
import { notify } from "@/lib/notifications";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { addCompletedWalkToInvoice } from "@/lib/billing";

type Result = { ok: true; message?: string } | { ok: false; error: string };

function refresh() {
  revalidatePath("/admin/cancellations");
  revalidatePath("/admin");
  revalidatePath("/admin/bookings");
  revalidatePath("/client/walks");
}

// Approve or decline a client's cancellation request.
// - Approve + within notice window: walk is cancelled, no charge.
// - Approve + late (feeApplies): walk is cancelled BUT billed at full price and
//   flagged as a late cancellation on the invoice + the client's account.
export async function resolveCancellation(
  requestId: string,
  approve: boolean,
  charge = true
): Promise<Result> {
  const admin = await requireRole([ROLES.ADMIN]);

  const req = await prisma.changeRequest.findUnique({
    where: { id: requestId },
    include: { walk: true },
  });
  if (!req) return { ok: false, error: "Request not found." };
  if (req.status !== CHANGE_REQUEST_STATUS.PENDING) return { ok: false, error: "This request was already handled." };
  const walk = req.walk;

  if (!approve) {
    await prisma.changeRequest.update({
      where: { id: requestId },
      data: { status: CHANGE_REQUEST_STATUS.REJECTED, resolvedById: admin.id, resolvedAt: new Date() },
    });
    await notify({
      userId: walk.clientId,
      type: NOTIF_TYPE.CANCELLATION_RESOLVED,
      title: "Cancellation declined",
      body: `Your request to cancel the ${walk.serviceName ?? "walk"} on ${formatDate(walk.date)} wasn't approved. Please get in touch if you need help.`,
      link: "/client/walks",
    });
    refresh();
    return { ok: true, message: "Cancellation declined." };
  }

  // Approve — cancel the walk. A within-7-days walk would normally still be
  // charged, but the admin can waive that (charge = false).
  const late = req.feeApplies && walk.status !== WALK_STATUS.COMPLETED;
  const willCharge = late && charge;
  await prisma.$transaction([
    prisma.changeRequest.update({
      where: { id: requestId },
      data: { status: CHANGE_REQUEST_STATUS.APPROVED, resolvedById: admin.id, resolvedAt: new Date() },
    }),
    prisma.walk.update({
      where: { id: walk.id },
      data: {
        status: WALK_STATUS.CANCELLED,
        cancelledAt: new Date(),
        cancelledById: admin.id,
        lateCancelled: willCharge,
        noCharge: !willCharge,
        cancelReason: willCharge
          ? "Cancelled with less than 7 days' notice — charged"
          : late
          ? "Cancelled within 7 days — fee waived by admin"
          : "Cancelled by client (approved)",
      },
    }),
  ]);

  if (willCharge) {
    // Still billed at full price (flagged on the invoice).
    await addCompletedWalkToInvoice(walk.id);
    await notify({
      userId: walk.clientId,
      type: NOTIF_TYPE.CANCELLATION_RESOLVED,
      title: "Cancellation approved — charge applies",
      body: `Your ${walk.serviceName ?? "walk"} on ${formatDate(walk.date)} is cancelled. As it was within 7 days, the full price (${formatMoney(walk.price)}) still applies and appears on your invoice.`,
      link: "/client/invoices",
    });
  } else {
    await notify({
      userId: walk.clientId,
      type: NOTIF_TYPE.CANCELLATION_RESOLVED,
      title: "Cancellation approved",
      body: `Your ${walk.serviceName ?? "walk"} on ${formatDate(walk.date)} is cancelled — no charge.${late ? " We've waived the within-7-days fee this time." : " Thanks for the notice!"}`,
      link: "/client/walks",
    });
  }

  refresh();
  return {
    ok: true,
    message: willCharge
      ? "Cancelled — charged (late notice)."
      : late
      ? "Cancelled — fee waived, no charge."
      : "Cancelled — no charge.",
  };
}
