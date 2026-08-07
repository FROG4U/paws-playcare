"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES, NOTIF_TYPE } from "@/lib/constants";
import { notifyAdmins } from "@/lib/notifications";

// A client can't pause a committed plan themselves — they ask an admin, who
// actions it. This records the request and alerts the admins.
export async function requestPause(reason: string) {
  const user = await requireRole([ROLES.CLIENT]);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      pauseRequestedAt: new Date(),
      pauseRequestReason: String(reason || "").trim().slice(0, 500) || null,
    },
  });
  await notifyAdmins({
    type: NOTIF_TYPE.PAUSE_REQUESTED,
    title: `Pause requested — ${user.name}`,
    body: `${user.name} has asked to pause their walks${
      reason ? `: "${String(reason).trim().slice(0, 140)}"` : "."
    }`,
    link: `/admin/clients/${user.id}`,
  });
  revalidatePath("/client");
}

// Client withdraws a pending pause request (before an admin has actioned it).
export async function cancelPauseRequest() {
  const user = await requireRole([ROLES.CLIENT]);
  await prisma.user.update({
    where: { id: user.id },
    data: { pauseRequestedAt: null, pauseRequestReason: null },
  });
  revalidatePath("/client");
}
