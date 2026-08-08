"use server";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type SubJson = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

// Save (or refresh) this device's push subscription for the current user.
export async function savePushSubscription(sub: SubJson): Promise<{ ok: boolean }> {
  const user = await requireUser();
  if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false };

  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    create: {
      userId: user.id,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
    },
  });
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<{ ok: boolean }> {
  await requireUser();
  if (endpoint) {
    await prisma.pushSubscription.deleteMany({ where: { endpoint } });
  }
  return { ok: true };
}
