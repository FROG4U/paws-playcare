import { prisma } from "@/lib/prisma";
import { dayKey, formatDate, formatDateTime } from "@/lib/dates";
import { penceToPounds } from "@/lib/money";
import { PageHeader } from "@/components/ui";
import {
  EVENT_SIGNUP_STATUS,
  eventWhen,
  eventPriceLabel,
  placesLeft,
  archivePastEvents,
} from "@/lib/events";
import { EventsAdmin, type EventLite } from "./EventsAdmin";

export default async function AdminEventsPage() {
  // Keep the list tidy even between cron runs.
  await archivePastEvents();

  const events = await prisma.event.findMany({
    orderBy: [{ date: "desc" }],
    include: {
      signups: {
        where: { status: EVENT_SIGNUP_STATUS.BOOKED },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const rows: EventLite[] = events.map((e) => ({
    id: e.id,
    slug: e.slug,
    title: e.title,
    description: e.description,
    imagePath: e.imagePath,
    address: e.address,
    dateIso: dayKey(e.date),
    whenLabel: eventWhen(e),
    startTime: e.startTime,
    endTime: e.endTime,
    pricePounds: e.pricePence == null ? null : penceToPounds(e.pricePence),
    priceLabel: eventPriceLabel(e.pricePence),
    capacity: e.capacity,
    askDogName: e.askDogName,
    active: e.active,
    archived: e.archivedAt != null,
    booked: e.signups.length,
    placesLeft: placesLeft(e.capacity, e.signups.length),
    signups: e.signups.map((s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      phone: s.phone,
      dogName: s.dogName,
      note: s.note,
      whenLabel: formatDateTime(s.createdAt),
    })),
  }));

  return (
    <div className="space-y-5">
      <PageHeader
        icon="sparkles"
        title="Events"
        subtitle="Fun days, group walks and socials. Switched-on events show on the website until the day is over."
      />
      <EventsAdmin events={rows} todayIso={dayKey(new Date())} />
    </div>
  );
}
