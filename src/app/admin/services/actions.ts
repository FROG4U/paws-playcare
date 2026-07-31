"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES, TIME_SLOTS } from "@/lib/constants";
import { poundsToPence } from "@/lib/money";

function parseDays(formData: FormData): string {
  const days = formData
    .getAll("days")
    .map((d) => parseInt(String(d), 10))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5) // Mon–Fri only (weekends closed)
    .sort((a, b) => a - b);
  return JSON.stringify([...new Set(days)]);
}

function parseSlot(formData: FormData): string {
  const s = String(formData.get("timeSlot") || "AM");
  return (TIME_SLOTS as readonly string[]).includes(s) ? s : "AM";
}

export async function addService(formData: FormData) {
  await requireRole([ROLES.ADMIN]);
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  const max = await prisma.service.aggregate({ _max: { sortOrder: true } });
  await prisma.service.create({
    data: {
      name,
      pricePerDog: poundsToPence(String(formData.get("pricePerDog") || "0")),
      daysOfWeek: parseDays(formData),
      timeSlot: parseSlot(formData),
      active: true,
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
  });
  revalidatePath("/admin/services");
}

export async function updateService(id: string, formData: FormData) {
  await requireRole([ROLES.ADMIN]);
  const name = String(formData.get("name") || "").trim();
  if (!name) return;
  await prisma.service.update({
    where: { id },
    data: {
      name,
      pricePerDog: poundsToPence(String(formData.get("pricePerDog") || "0")),
      daysOfWeek: parseDays(formData),
      timeSlot: parseSlot(formData),
    },
  });
  revalidatePath("/admin/services");
}

export async function toggleService(id: string, active: boolean) {
  await requireRole([ROLES.ADMIN]);
  await prisma.service.update({ where: { id }, data: { active } });
  revalidatePath("/admin/services");
}

export async function deleteService(id: string) {
  await requireRole([ROLES.ADMIN]);
  await prisma.service.delete({ where: { id } });
  revalidatePath("/admin/services");
}
