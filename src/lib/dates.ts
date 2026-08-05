// Date helpers. All "day" comparisons use a UTC yyyy-mm-dd key so that a walk's
// calendar day is stable regardless of server timezone.

export function dayKey(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

// Midnight UTC for a given calendar day — used when storing walk/holiday dates.
export function atUtcMidnight(d: Date | string): Date {
  return new Date(dayKey(d) + "T00:00:00.000Z");
}

export function isSameDay(a: Date | string, b: Date | string): boolean {
  return dayKey(a) === dayKey(b);
}

export function isWithinRange(
  day: Date | string,
  start: Date | string,
  end: Date | string
): boolean {
  const k = dayKey(day);
  return k >= dayKey(start) && k <= dayKey(end);
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function formatDate(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return `${DAY_NAMES[date.getUTCDay()]} ${date.getUTCDate()} ${
    MONTHS[date.getUTCMonth()]
  } ${date.getUTCFullYear()}`;
}

// Date + clock time in UK local time — used for the T&C agreement timestamp.
export function formatDateTime(d: Date | string): string {
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/London",
  });
}

// ISO weekday: Monday = 1 ... Sunday = 7
export function isoWeekday(d: Date | string): number {
  const date = typeof d === "string" ? new Date(d) : d;
  const wd = date.getUTCDay();
  return wd === 0 ? 7 : wd;
}
