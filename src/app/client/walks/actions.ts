"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import {
  ROLES,
  NOTIF_TYPE,
  WALK_STATUS,
  CHANGE_REQUEST_TYPE,
  CHANGE_REQUEST_STATUS,
  CANCEL_NOTICE_DAYS,
} from "@/lib/constants";
import { notifyAdmins } from "@/lib/notifications";
import { atUtcMidnight, formatDate } from "@/lib/dates";

type CancelResult = { ok: true; feeApplies: boolean } | { ok: false; error: string };

// Client asks to cancel one upcoming walk. This does NOT cancel it immediately —
// it creates a request the admin must approve. Cancellations made with less than
// 7 days' notice are flagged as chargeable.
export async function requestWalkCancellation(walkId: string): Promise<CancelResult> {
  const user = await requireRole([ROLES.CLIENT]);

  const walk = await prisma.walk.findUnique({ where: { id: walkId } });
  if (!walk || walk.clientId !== user.id) return { ok: false, error: "Walk not found." };
  if (walk.status === WALK_STATUS.COMPLETED || walk.status === WALK_STATUS.CANCELLED) {
    return { ok: false, error: "This walk can no longer be cancelled." };
  }

  const existing = await prisma.changeRequest.findFirst({
    where: { walkId, type: CHANGE_REQUEST_TYPE.CANCELLATION, status: CHANGE_REQUEST_STATUS.PENDING },
  });
  if (existing) {
    return { ok: false, error: "You've already asked to cancel this walk — it's awaiting approval." };
  }

  const today = atUtcMidnight(new Date());
  const walkDay = atUtcMidnight(walk.date);
  const daysNotice = Math.round((walkDay.getTime() - today.getTime()) / 86400000);
  const feeApplies = daysNotice < CANCEL_NOTICE_DAYS;

  await prisma.changeRequest.create({
    data: {
      walkId,
      requestedById: user.id,
      type: CHANGE_REQUEST_TYPE.CANCELLATION,
      feeApplies,
      status: CHANGE_REQUEST_STATUS.PENDING,
      note: feeApplies ? "Less than 7 days' notice — chargeable" : "7+ days' notice",
    },
  });

  await notifyAdmins({
    type: NOTIF_TYPE.CANCELLATION_REQUESTED,
    title: "Cancellation request",
    body: `${user.name} asked to cancel their ${walk.serviceName ?? "walk"} on ${formatDate(walk.date)}${
      feeApplies ? " — within 7 days, so it's still chargeable." : "."
    }`,
    link: "/admin/cancellations",
  });

  revalidatePath("/client/walks");
  revalidatePath("/admin/cancellations");
  revalidatePath("/admin");
  return { ok: true, feeApplies };
}
