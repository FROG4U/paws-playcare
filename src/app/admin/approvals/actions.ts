"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { sendApprovalEmail } from "@/lib/account-emails";
import { NOTIF_TYPE, ROLES, USER_STATUS, BOOKING_SLOTS } from "@/lib/constants";

const VALID_SLOTS = new Set<string>(BOOKING_SLOTS.map((s) => s.key));

// Edit a pending client's requested walk schedule before approving them — the
// admin can change each requested day/slot, add or remove one, and adjust the
// preferred start date. Saves back onto the client's registration fields.
export async function updateRequestedWalks(
  userId: string,
  slots: string[],
  startDate: string | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole([ROLES.ADMIN]);
  const client = await prisma.user.findUnique({ where: { id: userId } });
  if (!client || client.role !== ROLES.CLIENT) {
    return { ok: false, error: "Client not found." };
  }

  // Keep only known slot keys, de-duplicated, in the canonical week order.
  const clean = BOOKING_SLOTS.map((s) => s.key).filter((k) => slots.includes(k));
  for (const s of slots) {
    if (!VALID_SLOTS.has(s)) return { ok: false, error: "Unknown walk slot." };
  }

  let start: Date | null = null;
  if (startDate) {
    const d = new Date(startDate + "T00:00:00.000Z");
    if (Number.isNaN(d.getTime())) return { ok: false, error: "Invalid start date." };
    start = d;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { regSlots: JSON.stringify(clean), regStartDate: start },
  });

  revalidatePath("/admin/approvals");
  return { ok: true };
}

export async function approveClient(userId: string) {
  const admin = await requireRole([ROLES.ADMIN]);
  const client = await prisma.user.findUnique({ where: { id: userId } });
  if (!client || client.role !== ROLES.CLIENT) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: USER_STATUS.ACTIVE,
      approvedAt: new Date(),
      approvedById: admin.id,
      suspendReason: null,
      suspendedAt: null,
    },
  });

  await notify({
    userId,
    type: NOTIF_TYPE.ACCOUNT_APPROVED,
    title: "Your account is approved! 🎉",
    body: "Add a payment card to start booking walks.",
    link: "/client/payment",
  });

  try {
    await sendApprovalEmail(client.email, client.name);
  } catch {
    // ignore — approval succeeds regardless of email
  }

  revalidatePath("/admin/approvals");
  revalidatePath("/admin");
}

export async function rejectClient(userId: string, reason?: string) {
  await requireRole([ROLES.ADMIN]);
  const client = await prisma.user.findUnique({ where: { id: userId } });
  if (!client || client.role !== ROLES.CLIENT) return;

  await prisma.user.update({
    where: { id: userId },
    data: {
      status: USER_STATUS.SUSPENDED,
      suspendedAt: new Date(),
      suspendReason: reason || "Registration declined",
    },
  });

  await notify({
    userId,
    type: NOTIF_TYPE.ACCOUNT_SUSPENDED,
    title: "Account not approved",
    body: reason || "Please contact Paws Playcare for details.",
  });

  revalidatePath("/admin/approvals");
  revalidatePath("/admin");
}
