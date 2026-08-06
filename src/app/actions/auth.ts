"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createSession,
  destroySession,
  verifyPassword,
} from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { rateLimit, clientIp, friendlyTooMany } from "@/lib/rate-limit";

export type AuthState = { error?: string };

export async function loginAction(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  const password = String(formData.get("password") || "");

  if (!email || !password) return { error: "Enter your email and password." };

  // Throttle brute-force: by IP and per-email.
  const ip = await clientIp();
  if (!rateLimit(`login:ip:${ip}`, 20, 15 * 60_000).ok) return { error: friendlyTooMany };
  if (!rateLimit(`login:email:${email}`, 8, 15 * 60_000).ok) return { error: friendlyTooMany };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return { error: "Incorrect email or password." };
  }

  await createSession({ uid: user.id, role: user.role, name: user.name });

  const dest =
    user.role === ROLES.ADMIN
      ? "/admin"
      : user.role === ROLES.WORKER
      ? "/worker"
      : "/client";
  redirect(dest);
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
