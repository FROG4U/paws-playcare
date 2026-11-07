// Events: one-off days out (fun days, group walks, puppy socials) that show on
// the public Events page while they're switched on and still to come.
//
// "Past" is decided by the date alone, so an event drops off the website the
// day after it runs even if nothing has run the archive sweep yet. The sweep
// (in the daily maintenance cron) just stamps archivedAt so the admin list can
// file it away.
import { prisma } from "./prisma";
import { atUtcMidnight, dayKey, formatDate } from "./dates";
import { formatMoney } from "./money";

export const EVENT_SIGNUP_STATUS = { BOOKED: "BOOKED", CANCELLED: "CANCELLED" } as const;

export function slugifyEvent(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "event"
  );
}

// A slug nothing else is using (adds -2, -3 ... if needed).
export async function uniqueEventSlug(title: string, ignoreId?: string): Promise<string> {
  const base = slugifyEvent(title);
  for (let i = 0; i < 50; i++) {
    const slug = i === 0 ? base : `${base}-${i + 1}`;
    const clash = await prisma.event.findUnique({ where: { slug }, select: { id: true } });
    if (!clash || clash.id === ignoreId) return slug;
  }
  return `${base}-${Date.now().toString().slice(-5)}`;
}

export function isPastEvent(date: Date, now: Date = new Date()): boolean {
  return dayKey(date) < dayKey(now);
}

// "Sat 12 Dec 2026, 10:00 to 13:00"
export function eventWhen(e: { date: Date; startTime: string | null; endTime: string | null }): string {
  const times = [e.startTime, e.endTime].filter(Boolean).join(" to ");
  return times ? `${formatDate(e.date)}, ${times}` : formatDate(e.date);
}

export function eventPriceLabel(pricePence: number | null): string {
  if (pricePence == null) return "Free";
  return `${formatMoney(pricePence)} per person`;
}

// Places left, or null when the event has no limit.
export function placesLeft(capacity: number | null, booked: number): number | null {
  if (capacity == null) return null;
  return Math.max(0, capacity - booked);
}

// What the public site shows: switched on, not archived, today or later.
export async function getLiveEvents() {
  const todayStart = atUtcMidnight(dayKey(new Date()));
  return prisma.event.findMany({
    where: { active: true, archivedAt: null, date: { gte: todayStart } },
    orderBy: { date: "asc" },
    include: { _count: { select: { signups: { where: { status: EVENT_SIGNUP_STATUS.BOOKED } } } } },
  });
}

// Archive anything whose day has been and gone. Run daily; safe to re-run.
export async function archivePastEvents(now: Date = new Date()): Promise<{ eventsArchived: number }> {
  const todayStart = atUtcMidnight(dayKey(now));
  const res = await prisma.event.updateMany({
    where: { archivedAt: null, date: { lt: todayStart } },
    data: { archivedAt: now },
  });
  return { eventsArchived: res.count };
}

// Tell the clients about an event the first time it goes live: an in-app
// notification each (which also fires their phone push), and the pop-up on
// their dashboard. Only ever announced once, so flicking the switch off and
// on again doesn't pester anyone twice.
export async function announceEvent(eventId: string): Promise<{ announcedTo: number }> {
  const { notify } = await import("./notifications");
  const { NOTIF_TYPE, ROLES, USER_STATUS } = await import("./constants");

  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) return { announcedTo: 0 };
  if (!event.active || event.announcedAt || event.archivedAt) return { announcedTo: 0 };
  if (isPastEvent(event.date)) return { announcedTo: 0 };

  const clients = await prisma.user.findMany({
    where: { role: ROLES.CLIENT, status: USER_STATUS.ACTIVE, archivedAt: null },
    select: { id: true },
  });

  const price = event.pricePence == null ? "Free" : eventPriceLabel(event.pricePence);
  for (const c of clients) {
    await notify({
      userId: c.id,
      type: NOTIF_TYPE.BOOKING_CREATED,
      title: `New event: ${event.title}`,
      body: `${eventWhen(event)} · ${price}. Tap to book your place.`,
      link: `/client/events`,
    });
  }

  await prisma.event.update({ where: { id: eventId }, data: { announcedAt: new Date() } });
  return { announcedTo: clients.length };
}

// Events a client should be shown, with whether they've already booked.
export async function getEventsForClient(userId: string) {
  const events = await getLiveEvents();
  if (events.length === 0) return [];
  const mine = await prisma.eventSignup.findMany({
    where: { userId, eventId: { in: events.map((e) => e.id) }, status: EVENT_SIGNUP_STATUS.BOOKED },
    select: { eventId: true },
  });
  const booked = new Set(mine.map((m) => m.eventId));
  return events.map((e) => ({ ...e, booked: booked.has(e.id) }));
}
