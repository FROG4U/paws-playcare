import { prisma } from "@/lib/prisma";
import { dayKey, atUtcMidnight, isoWeekday } from "@/lib/dates";

// The business does NOT operate on weekends or UK bank holidays — clients can
// never book those days, and any recurring occurrence landing on one is skipped
// (and the client notified). This is the single source of truth for the
// booking flow.
export const CLOSED_WEEKDAYS = new Set([6, 7]); // Sat = 6, Sun = 7 (ISO)

// All stored bank-holiday calendar days as a Set of yyyy-mm-dd keys.
export async function bankHolidayKeys(): Promise<Set<string>> {
  const rows = await prisma.bankHoliday.findMany({ select: { date: true } });
  return new Set(rows.map((r) => dayKey(r.date)));
}

// Ad-hoc admin-closed days.
export async function closedDayKeys(): Promise<Set<string>> {
  const rows = await prisma.closedDay.findMany({ select: { date: true } });
  return new Set(rows.map((r) => dayKey(r.date)));
}

// Every non-working day (bank holidays + admin closures). This is the set the
// booking generator and rollover skip, so nothing is ever scheduled on them.
export async function blockedDateKeys(): Promise<Set<string>> {
  const [bh, closed] = await Promise.all([bankHolidayKeys(), closedDayKeys()]);
  for (const k of closed) bh.add(k);
  return bh;
}

export type UnavailableReason = "weekend" | "bank_holiday" | "not_scheduled";

// Can a service that runs on `weekdays` be booked on `date`?
export function checkBookable(
  date: Date | string,
  weekdays: number[],
  bhKeys: Set<string>,
): { ok: boolean; reason?: UnavailableReason } {
  const wd = isoWeekday(date);
  if (CLOSED_WEEKDAYS.has(wd)) return { ok: false, reason: "weekend" };
  if (bhKeys.has(dayKey(date))) return { ok: false, reason: "bank_holiday" };
  if (!weekdays.includes(wd)) return { ok: false, reason: "not_scheduled" };
  return { ok: true };
}

// Expand a recurring booking (selected `weekdays`, inclusive start→end) into the
// individual walk dates, separating out any that fall on a bank holiday so the
// caller can skip them and notify the client. Weekends are never produced.
export function expandRecurring(
  weekdays: number[],
  start: Date | string,
  end: Date | string,
  bhKeys: Set<string>,
): { dates: Date[]; skippedBankHolidays: Date[] } {
  const dates: Date[] = [];
  const skippedBankHolidays: Date[] = [];
  let cursor = atUtcMidnight(start);
  const last = atUtcMidnight(end);
  let guard = 0;
  while (cursor.getTime() <= last.getTime() && guard++ < 3660) {
    const wd = isoWeekday(cursor);
    if (weekdays.includes(wd) && !CLOSED_WEEKDAYS.has(wd)) {
      if (bhKeys.has(dayKey(cursor))) skippedBankHolidays.push(new Date(cursor));
      else dates.push(new Date(cursor));
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return { dates, skippedBankHolidays };
}
