"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, createSession } from "@/lib/auth";
import { ROLES, USER_STATUS } from "@/lib/constants";

const schema = z.object({
  token: z.string().min(10),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional().default(""),
});

export type WorkerRegResult =
  | { ok: true }
  | { ok: false; error: string };

// Validate an invite token (used by the page to gate the form).
export async function checkInvite(token: string) {
  const invite = await prisma.workerInvite.findUnique({ where: { token } });
  if (!invite) return { valid: false as const, reason: "not_found" };
  if (invite.usedAt) return { valid: false as const, reason: "used" };
  if (invite.expiresAt < new Date())
    return { valid: false as const, reason: "expired" };
  return { valid: true as const, email: invite.email, name: invite.name };
}

export async function registerWorker(raw: unknown): Promise<WorkerRegResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const f = parsed.error.issues[0];
    return { ok: false, error: f ? `${f.path.join(".")}: ${f.message}` : "Invalid form." };
  }
  const data = parsed.data;

  const invite = await prisma.workerInvite.findUnique({
    where: { token: data.token },
  });
  if (!invite || invite.usedAt || invite.expiresAt < new Date()) {
    return { ok: false, error: "This invite link is invalid or has expired." };
  }

  const email = data.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with this email already exists." };
  }

  const passwordHash = await hashPassword(data.password);
  const worker = await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: ROLES.WORKER,
      status: USER_STATUS.ACTIVE, // invited by admin -> active immediately
      canWork: true,
      name: data.name.trim(),
      phone: data.phone,
    },
  });

  await prisma.workerInvite.update({
    where: { id: invite.id },
    data: { usedAt: new Date(), usedByUserId: worker.id },
  });

  await createSession({ uid: worker.id, role: worker.role, name: worker.name });
  return { ok: true };
}
