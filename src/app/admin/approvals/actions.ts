"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { notify } from "@/lib/notifications";
import { sendApprovalEmail } from "@/lib/account-emails";
import { NOTIF_TYPE, ROLES, USER_STATUS, BOOKING_SLOTS } from "@/lib/constants";
import { getServices, requestedWalkOptions } from "@/lib/services";

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

  // Valid = a walk the business currently offers ("Field Play — Monday (AM)"),
  // or something already on this client's registration (a service since
  // changed, or an old-style MON_AM key) so editing never destroys their ask.
  const offered = requestedWalkOptions(await getServices());
  const rank = new Map(offered.map((o, i) => [o.value, i]));
  let existing: string[] = [];
  try {
    existing = JSON.parse(client.regSlots || "[]");
  } catch {}
  const allowed = new Set<string>([
    ...offered.map((o) => o.value),
    ...existing,
    ...BOOKING_SLOTS.map((s) => s.key),
  ]);
  for (const s of slots) {
    if (!allowed.has(s)) return { ok: false, error: "Unknown walk slot." };
  }

  // De-duplicate, then order by the services list so the week reads in order;
  // anything no longer offered keeps its position at the end.
  const clean = [...new Set(slots)].sort(
    (a, b) => (rank.get(a) ?? Number.MAX_SAFE_INTEGER) - (rank.get(b) ?? Number.MAX_SAFE_INTEGER)
  );

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
