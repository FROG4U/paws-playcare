"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

const INVITE_DAYS = 14;

export async function createWorkerInvite(formData: FormData) {
  const admin = await requireRole([ROLES.ADMIN]);
  const name = String(formData.get("name") || "").trim() || null;
  const email = String(formData.get("email") || "").trim().toLowerCase() || null;

  const token = crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000);

  await prisma.workerInvite.create({
    data: { token, name, email, createdById: admin.id, expiresAt },
  });
  revalidatePath("/admin/workers");
}

export async function revokeInvite(id: string) {
  await requireRole([ROLES.ADMIN]);
  await prisma.workerInvite.delete({ where: { id } });
  revalidatePath("/admin/workers");
}

export async function toggleWorkerActive(userId: string, active: boolean) {
  await requireRole([ROLES.ADMIN]);
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.role !== ROLES.WORKER) return;
  await prisma.user.update({
    where: { id: userId },
    data: { status: active ? "ACTIVE" : "SUSPENDED", canWork: active },
  });
  revalidatePath("/admin/workers");
}
