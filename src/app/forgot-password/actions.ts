"use server";

import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { sendPasswordResetEmail } from "@/lib/account-emails";
import { rateLimit, clientIp, friendlyTooMany } from "@/lib/rate-limit";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function sha256(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export type ForgotState = { done?: boolean; error?: string };

// Create a single-use reset token and email the link. Always reports success so
// the form never reveals whether an email is registered.
export async function requestPasswordReset(_prev: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email) return { error: "Please enter your email address." };

  // Throttle reset spam: cap per IP and per target email (anti email-bombing).
  const ip = await clientIp();
  if (!rateLimit(`forgot:ip:${ip}`, 10, 60 * 60_000).ok) return { error: friendlyTooMany };
  if (!rateLimit(`forgot:email:${email}`, 4, 60 * 60_000).ok) return { done: true };

  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    const raw = crypto.randomBytes(32).toString("hex");
    await prisma.passwordResetToken.create({
      data: { tokenHash: sha256(raw), userId: user.id, expiresAt: new Date(Date.now() + TOKEN_TTL_MS) },
    });
    try {
      await sendPasswordResetEmail(user.email, raw);
    } catch {
      // ignore send failures — don't leak state
    }
  }
  return { done: true };
}

export type ResetState = { ok?: boolean; error?: string };

export async function resetPassword(_prev: ResetState, formData: FormData): Promise<ResetState> {
  const token = String(formData.get("token") || "");
  const password = String(formData.get("password") || "");
  const confirm = String(formData.get("confirm") || "");

  const ip = await clientIp();
  if (!rateLimit(`reset:ip:${ip}`, 20, 60 * 60_000).ok) return { error: friendlyTooMany };

  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirm) return { error: "Those passwords don't match." };

  const rec = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!rec || rec.usedAt || rec.expiresAt < new Date()) {
    return { error: "This reset link is invalid or has expired. Please request a new one." };
  }

  await prisma.$transaction([
    prisma.user.update({ where: { id: rec.userId }, data: { passwordHash: await hashPassword(password) } }),
    // Consume this token and invalidate any other outstanding reset links.
    prisma.passwordResetToken.deleteMany({ where: { userId: rec.userId } }),
  ]);
  return { ok: true };
}

// Server-side check so the reset page can show a friendly message for a
// bad/expired link before rendering the form.
export async function checkResetToken(token: string): Promise<boolean> {
  if (!token) return false;
  const rec = await prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(token) } });
  return !!rec && !rec.usedAt && rec.expiresAt >= new Date();
}
