"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { poundsToPence } from "@/lib/money";
import { syncBankHolidays } from "@/lib/bankHolidays";

export async function savePricing(formData: FormData) {
  await requireRole([ROLES.ADMIN]);
  const num = (k: string) => poundsToPence(String(formData.get(k) || "0"));
  const int = (k: string, d: number) => {
    const v = parseInt(String(formData.get(k) || ""), 10);
    return Number.isFinite(v) ? v : d;
  };

  await prisma.setting.update({
    where: { id: 1 },
    data: {
      baseWalkPrice: num("baseWalkPrice"),
      extraDogFee: num("extraDogFee"),
      bankHolidayWalkPrice: num("bankHolidayWalkPrice"),
      bankHolidayExtraDogFee: num("bankHolidayExtraDogFee"),
      workerFlatRate: num("workerFlatRate"),
      unpaidGraceDays: int("unpaidGraceDays", 7),
      cardExpiryWarnDays: int("cardExpiryWarnDays", 30),
      bankHolidayDivision: String(formData.get("bankHolidayDivision") || "england-and-wales"),
    },
  });
  revalidatePath("/admin/pricing");
}

export async function addHolidayRate(formData: FormData) {
  await requireRole([ROLES.ADMIN]);
  const name = String(formData.get("name") || "").trim();
  const start = String(formData.get("startDate") || "");
  const end = String(formData.get("endDate") || "");
  if (!name || !start || !end) return;

  await prisma.holidayRate.create({
    data: {
      name,
      startDate: new Date(start + "T00:00:00.000Z"),
      endDate: new Date(end + "T00:00:00.000Z"),
      walkPrice: poundsToPence(String(formData.get("walkPrice") || "0")),
      extraDogFee: poundsToPence(String(formData.get("extraDogFee") || "0")),
      active: true,
    },
  });
  revalidatePath("/admin/pricing");
}

export async function toggleHolidayRate(id: string, active: boolean) {
  await requireRole([ROLES.ADMIN]);
  await prisma.holidayRate.update({ where: { id }, data: { active } });
  revalidatePath("/admin/pricing");
}

export async function deleteHolidayRate(id: string) {
  await requireRole([ROLES.ADMIN]);
  await prisma.holidayRate.delete({ where: { id } });
  revalidatePath("/admin/pricing");
}

export async function syncHolidaysNow() {
  await requireRole([ROLES.ADMIN]);
  await syncBankHolidays();
  revalidatePath("/admin/pricing");
}
