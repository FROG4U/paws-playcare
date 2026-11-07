import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ROLES } from "@/lib/constants";
import { renderMarkdown } from "@/lib/pages";
import { Icon } from "@/components/Icon";
import {
  EVENT_SIGNUP_STATUS,
  eventWhen,
  eventPriceLabel,
  placesLeft,
  isPastEvent,
} from "@/lib/events";
import { EventBooking } from "@/components/EventBooking";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  return prisma.event.findUnique({
    where: { slug },
    include: { _count: { select: { signups: { where: { status: EVENT_SIGNUP_STATUS.BOOKED } } } } },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await load(slug);
  if (!event) return { title: "Event — Paws Playcare" };
  return {
    title: `${event.title} — Paws Playcare`,
    description: event.description?.slice(0, 160) ?? undefined,
    openGraph: event.imagePath ? { images: [event.imagePath] } : undefined,
  };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const event = await load(slug);
  if (!event) notFound();

  const user = await getCurrentUser();
  const dogs = user
    ? await prisma.dog.findMany({
        where: { ownerId: user.id },
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      })
    : [];
  const past = isPastEvent(event.date);
  const hidden = !event.active || event.archivedAt != null;

  // An event that's off or finished stays reachable by link for anyone already
  // booked, but it isn't open to new bookings. Staff can always open it, so
  // "View page" works as a preview before it goes live.
  const mine = user
    ? await prisma.eventSignup.findUnique({
        where: { eventId_userId: { eventId: event.id, userId: user.id } },
      })
    : null;
  const isStaff = user?.role === ROLES.ADMIN || user?.role === ROLES.WORKER;
  if ((hidden || past) && !mine && !isStaff) notFound();

  const left = placesLeft(event.capacity, event._count.signups);

  return (
    <article className="mx-auto w-full max-w-3xl px-5 py-12">
      <Link
        href="/events"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-brand"
      >
        <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
        All events
      </Link>

      {event.imagePath && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.imagePath} alt="" className="mt-4 h-64 w-full rounded-2xl object-cover sm:h-80" />
      )}

      {isStaff && (hidden || past) && (
        <p className="mt-4 flex items-start gap-2 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">
          <Icon name="alert" className="mt-0.5 h-4 w-4 shrink-0" />
          {past
            ? "This event has been and gone, so it's no longer on the website. Only you can see this page."
            : "This event is switched off, so it isn't on the website yet. Only you can see this page - turn it on from the Events screen when you're ready."}
        </p>
      )}

      <h1 className="mt-6 text-3xl font-extrabold text-balance">{event.title}</h1>

      <div className="mt-4 grid gap-2 rounded-2xl bg-mist p-4 text-sm sm:grid-cols-2">
        <p className="flex items-center gap-2">
          <Icon name="calendar" className="h-4 w-4 shrink-0 text-brand" />
          {eventWhen(event)}
        </p>
        <p className="flex items-center gap-2">
          <Icon name="pound" className="h-4 w-4 shrink-0 text-brand" />
          {eventPriceLabel(event.pricePence)}
        </p>
        {event.address && (
          <p className="flex items-center gap-2">
            <Icon name="mapPin" className="h-4 w-4 shrink-0 text-brand" />
            {event.address}
          </p>
        )}
        {event.capacity != null && (
          <p className="flex items-center gap-2">
            <Icon name="users" className="h-4 w-4 shrink-0 text-brand" />
            {left === 0 ? "Fully booked" : `${left} of ${event.capacity} places left`}
          </p>
        )}
      </div>

      {event.description && (
        <div
          className="prose-site mt-6"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(event.description) }}
        />
      )}

      <div className="mt-8">
        {past ? (
          <p className="card text-sm text-muted">This event has already taken place.</p>
        ) : isStaff && hidden ? (
          <p className="card text-sm text-muted">
            Bookings open to your clients as soon as you switch this event on.
          </p>
        ) : (
          <EventBooking
            eventId={event.id}
            askDogName={event.askDogName}
            full={left === 0}
            priceLabel={eventPriceLabel(event.pricePence)}
            signedIn={!!user}
            booked={mine?.status === EVENT_SIGNUP_STATUS.BOOKED}
            dogs={dogs}
            bookedDogNames={mine?.dogName ?? null}
            pricePence={event.pricePence}
            billingNote={
              event.pricePence
                ? "It goes on your next invoice and is taken with your usual payment."
                : null
            }
            defaults={{
              name: user?.name ?? "",
              email: user?.email ?? "",
              phone: user?.phone ?? "",
            }}
          />
        )}
      </div>
    </article>
  );
}
