"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { NOTIF_TYPE, ROLES, USER_STATUS } from "@/lib/constants";

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
