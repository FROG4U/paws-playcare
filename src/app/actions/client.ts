"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/constants";

export async function setServicesPaused(paused: boolean) {
  const user = await requireRole([ROLES.CLIENT]);
  await prisma.user.update({
    where: { id: user.id },
    data: { servicesPaused: paused },
  });
  revalidatePath("/client");
}
