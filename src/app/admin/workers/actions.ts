"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole, hashPassword } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

const INVITE_DAYS = 14;

// Set/reset a staff member's (admin or walker) login password directly — no
// email or command line needed. Also ensures the account is ACTIVE so a
// suspended/locked staff member can get back in.
export async function setStaffPassword(
  userId: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRole([ROLES.ADMIN]);
  const pw = String(newPassword || "");
  if (pw.length < 8) return { ok: false, error: "Password must be at least 8 characters." };

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { role: true } });
  if (!target || (target.role !== ROLES.ADMIN && target.role !== ROLES.WORKER)) {
    return { ok: false, error: "That isn't a staff account." };
  }

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(pw), status: "ACTIVE" },
  });
  revalidatePath("/admin/workers");
  return { ok: true };
}

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
