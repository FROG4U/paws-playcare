"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES, WALK_STATUS, NOTIF_TYPE } from "@/lib/constants";
import { atUtcMidnight, formatDate } from "@/lib/dates";
import { notify } from "@/lib/notifications";
import { sendDayOffEmail } from "@/lib/account-emails";
import { rolloverOngoingBookings } from "@/lib/rollover";

export type CloseResult =
  | { ok: true; cancelled: number; clients: number }
  | { ok: false; error: string };

// Close a specific day: record it (so no walks are ever generated on it),
// cancel that day's walks with no charge, and email + notify each affected
// client with the reason.
export async function closeDay(dateKey: string, reason: string): Promise<CloseResult> {
  await requireRole([ROLES.ADMIN]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return { ok: false, error: "Please choose a date." };
  const r = String(reason || "").trim();
  if (!r) return { ok: false, error: "Please add a reason (the clients will see it)." };

  const date = atUtcMidnight(dateKey);
  await prisma.closedDay.upsert({
    where: { date },
    update: { reason: r },
    create: { date, reason: r },
  });

  const walks = await prisma.walk.findMany({
    where: {
      date,
      status: { in: [WALK_STATUS.REQUESTED, WALK_STATUS.ASSIGNED, WALK_STATUS.ACCEPTED] },
    },
    include: { client: { select: { id: true, name: true, email: true } } },
  });

  if (walks.length > 0) {
    await prisma.walk.updateMany({
      where: { id: { in: walks.map((w) => w.id) } },
      data: {
        status: WALK_STATUS.CANCELLED,
        cancelledAt: new Date(),
        cancelReason: `Closed: ${r}`,
        noCharge: true,
      },
    });
  }

  // One email + notification per affected client.
  const byClient = new Map<string, { name: string; email: string }>();
  for (const w of walks) byClient.set(w.client.id, { name: w.client.name, email: w.client.email });
  const label = formatDate(date);
  for (const [clientId, c] of byClient) {
    await notify({
      userId: clientId,
      type: NOTIF_TYPE.WALK_SKIPPED,
      title: `No walks on ${label}`,
      body: `We're not walking on ${label} — ${r}. Your walk that day is cancelled with no charge.`,
      link: "/client/walks",
    });
    await sendDayOffEmail(c.email, c.name, label, r).catch(() => {});
  }

  revalidatePath("/admin/days-off");
  revalidatePath("/admin/bookings");
  revalidatePath("/admin/calendar");
  revalidatePath("/client/walks");
  return { ok: true, cancelled: walks.length, clients: byClient.size };
}

// Reopen a previously closed day. Ongoing bookings are topped back up so the
// day's walks return (existing cancelled ones stay cancelled as a record).
export async function reopenDay(dateKey: string): Promise<{ ok: boolean }> {
  await requireRole([ROLES.ADMIN]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return { ok: false };
  await prisma.closedDay.deleteMany({ where: { date: atUtcMidnight(dateKey) } });
  // Restore the walks the closure cancelled on that day, then top up any dates
  // that never had a walk.
  await prisma.walk.updateMany({
    where: {
      date: atUtcMidnight(dateKey),
      status: WALK_STATUS.CANCELLED,
      cancelReason: { startsWith: "Closed:" },
    },
    data: { status: WALK_STATUS.REQUESTED, cancelledAt: null, cancelledById: null, cancelReason: null, noCharge: false },
  });
  await rolloverOngoingBookings(new Date()).catch(() => {});
  revalidatePath("/admin/days-off");
  revalidatePath("/admin/calendar");
  return { ok: true };
}
