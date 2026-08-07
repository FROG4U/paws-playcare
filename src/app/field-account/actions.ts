"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

export type ProfileState = { ok?: boolean; error?: string };

// Field customer updates their own contact details.
export async function updateFieldProfile(
  _prev: ProfileState,
  formData: FormData
): Promise<ProfileState> {
  const user = await requireRole([ROLES.FIELD_CLIENT]);
  const name = String(formData.get("name") || "").trim();
  const phone = String(formData.get("phone") || "").trim() || null;
  if (!name) return { error: "Please enter your name." };

  await prisma.user.update({
    where: { id: user.id },
    data: { name, phone },
  });
  revalidatePath("/field-account");
  return { ok: true };
}
