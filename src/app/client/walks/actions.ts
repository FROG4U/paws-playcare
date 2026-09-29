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
import { getServices, requestedWalkOptions } from "@/lib/services";

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

// Ask to change the regular weekly days (drop one, add one, or swap). Nothing
// moves until an admin approves it, so the bill can't change behind the scenes.
export async function requestSlotChange(
  slots: string[],
  note?: string
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const user = await requireRole([ROLES.CLIENT]);

  const services = await getServices();
  const offered = new Set(requestedWalkOptions(services).map((o) => o.value));
  const wanted = [...new Set(slots)].filter((s) => offered.has(s));
  if (slots.some((s) => !offered.has(s))) {
    return { ok: false, error: "One of those days isn't offered any more - please pick from the list." };
  }

  let current: string[] = [];
  try {
    const parsed = JSON.parse(user.regSlots || "[]");
    if (Array.isArray(parsed)) current = parsed;
  } catch {}

  if (JSON.stringify([...wanted].sort()) === JSON.stringify([...current].sort())) {
    return { ok: false, error: "That's the same as your current days." };
  }

  const existing = await prisma.slotChangeRequest.findFirst({
    where: { clientId: user.id, status: CHANGE_REQUEST_STATUS.PENDING },
  });
  if (existing) {
    return { ok: false, error: "You've already got a change waiting - we'll come back to you on that one first." };
  }

  await prisma.slotChangeRequest.create({
    data: {
      clientId: user.id,
      currentSlots: JSON.stringify(current),
      requestedSlots: JSON.stringify(wanted),
      note: note?.trim() || null,
    },
  });

  await notifyAdmins({
    type: NOTIF_TYPE.CHANGE_REQUESTED,
    title: `${user.name} wants to change their regular days`,
    body: `Now: ${current.join(", ") || "none"}. Wants: ${wanted.join(", ") || "none"}.`,
    link: `/admin/clients/${user.id}`,
  });

  revalidatePath("/client/walks");
  return {
    ok: true,
    message: "Sent - we'll let you know once it's approved. Nothing changes on your bill until then.",
  };
}

// Withdraw a change that hasn't been actioned yet.
export async function withdrawSlotChange(): Promise<{ ok: true } | { ok: false; error: string }> {
  const user = await requireRole([ROLES.CLIENT]);
  const req = await prisma.slotChangeRequest.findFirst({
    where: { clientId: user.id, status: CHANGE_REQUEST_STATUS.PENDING },
  });
  if (!req) return { ok: false, error: "There's nothing waiting to withdraw." };
  await prisma.slotChangeRequest.delete({ where: { id: req.id } });
  revalidatePath("/client/walks");
  return { ok: true };
}
