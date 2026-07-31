import { prisma } from "./prisma";
import { ROLES } from "./constants";

type NotifyInput = {
  userId: string;
  type: string;
  title: string;
  body?: string;
  link?: string;
};

export async function notify(input: NotifyInput) {
  return prisma.notification.create({ data: input });
}

// Notify every admin (e.g. new client pending approval, worker accepted a walk).
export async function notifyAdmins(
  input: Omit<NotifyInput, "userId">
) {
  const admins = await prisma.user.findMany({
    where: { role: ROLES.ADMIN },
    select: { id: true },
  });
  if (admins.length === 0) return;
  await prisma.notification.createMany({
    data: admins.map((a) => ({ ...input, userId: a.id })),
  });
}

export async function unreadCount(userId: string) {
  return prisma.notification.count({ where: { userId, read: false } });
}
