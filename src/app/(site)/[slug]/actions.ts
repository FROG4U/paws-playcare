"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { notifyAdmins } from "@/lib/notifications";
import { NOTIF_TYPE } from "@/lib/constants";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const schema = z.object({
  name: z.string().trim().min(2, "Please enter your name."),
  email: z.string().trim().email("Please enter a valid email."),
  phone: z.string().trim().optional().default(""),
  message: z.string().trim().min(5, "Please enter a short message."),
});

export type ContactState = { ok?: boolean; error?: string };

// Spam-protected: hidden honeypot field + submit-timing check. Bots that fill
// the honeypot or submit instantly get a fake success and nothing is stored.
export async function submitContact(
  _prev: ContactState,
  formData: FormData
): Promise<ContactState> {
  const honeypot = String(formData.get("company") || "");
  const ts = Number(formData.get("ts") || 0);
  const tooFast = ts > 0 && Date.now() - ts < 2500;
  // Honeypot / timing / per-IP rate cap — all silently drop suspected spam.
  if (honeypot || tooFast || !rateLimit(`contact:ip:${await clientIp()}`, 6, 60 * 60_000).ok) {
    return { ok: true };
  }

  const parsed = schema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    message: formData.get("message"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message || "Please check the form." };
  }
  const data = parsed.data;

  await prisma.contactMessage.create({
    data: {
      name: data.name,
      email: data.email.toLowerCase(),
      phone: data.phone || null,
      message: data.message,
    },
  });

  await notifyAdmins({
    type: NOTIF_TYPE.CONTACT_MESSAGE,
    title: "New contact message",
    body: `${data.name} (${data.email}) sent a message.`,
    link: "/admin/messages",
  });

  return { ok: true };
}
