import { prisma } from "./prisma";
import { dayKey, isWithinRange } from "./dates";

export type PriceResult = {
  price: number; // pence
  isBankHoliday: boolean;
  holidayRateId: string | null;
  reason: "base" | "bank_holiday" | "holiday_rate";
};

export async function getSettings() {
  const s = await prisma.setting.findUnique({ where: { id: 1 } });
  if (s) return s;
  return prisma.setting.create({ data: { id: 1 } });
}

// Resolve the price for a walk on `date` with `numDogs` dogs.
// Precedence: admin custom holiday rate > bank holiday > base rate.
export async function resolveWalkPrice(
  date: Date,
  numDogs: number
): Promise<PriceResult> {
  const settings = await getSettings();
  const dogs = Math.max(1, numDogs);

  // 1. Custom holiday-rate ranges set by admin
  const holidayRates = await prisma.holidayRate.findMany({
    where: { active: true },
  });
  const match = holidayRates.find((h) =>
    isWithinRange(date, h.startDate, h.endDate)
  );
  if (match) {
    return {
      price: match.walkPrice + match.extraDogFee * (dogs - 1),
      isBankHoliday: false,
      holidayRateId: match.id,
      reason: "holiday_rate",
    };
  }

  // 2. Auto-scooped UK bank holiday
  const bh = await prisma.bankHoliday.findFirst({
    where: { date: new Date(dayKey(date) + "T00:00:00.000Z") },
  });
  if (bh) {
    return {
      price:
        settings.bankHolidayWalkPrice +
        settings.bankHolidayExtraDogFee * (dogs - 1),
      isBankHoliday: true,
      holidayRateId: null,
      reason: "bank_holiday",
    };
  }

  // 3. Base rate
  return {
    price: settings.baseWalkPrice + settings.extraDogFee * (dogs - 1),
    isBankHoliday: false,
    holidayRateId: null,
    reason: "base",
  };
}
