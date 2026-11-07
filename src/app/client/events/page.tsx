import { requireClient } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { EventBooking } from "@/components/EventBooking";
import {
  getEventsForClient,
  eventWhen,
  eventPriceLabel,
  placesLeft,
} from "@/lib/events";
import { renderMarkdown } from "@/lib/pages";

export default async function ClientEventsPage() {
  const user = await requireClient();
  const [events, dogs, mySignups] = await Promise.all([
    getEventsForClient(user.id),
    prisma.dog.findMany({
      where: { ownerId: user.id },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.eventSignup.findMany({
      where: { userId: user.id },
      select: { eventId: true, dogName: true },
    }),
  ]);
  const dogNamesByEvent = new Map(mySignups.map((s) => [s.eventId, s.dogName]));

  return (
    <div className="space-y-5">
      <PageHeader
        icon="sparkles"
        title="Events"
        subtitle="Fun days, group walks and socials. Book your place here."
      />

      {events.length === 0 ? (
        <EmptyState icon="sparkles" title="Nothing on at the moment">
          When we put an event on you&apos;ll get a message, and it&apos;ll show up here to book.
        </EmptyState>
      ) : (
        events.map((e) => {
          const left = placesLeft(e.capacity, e._count.signups);
          return (
            <section key={e.id} className="card space-y-3">
              <div className="flex flex-wrap items-start gap-4">
                {e.imagePath && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={e.imagePath} alt="" className="h-28 w-full rounded-xl object-cover sm:w-44" />
                )}
                <div className="min-w-0 flex-1 space-y-1">
                  <h2 className="text-lg font-extrabold">{e.title}</h2>
                  <p className="flex items-center gap-1.5 text-sm text-muted">
                    <Icon name="calendar" className="h-4 w-4 shrink-0 text-brand" />
                    {eventWhen(e)}
                  </p>
                  {e.address && (
                    <p className="flex items-center gap-1.5 text-sm text-muted">
                      <Icon name="mapPin" className="h-4 w-4 shrink-0 text-brand" />
                      {e.address}
                    </p>
                  )}
                  <p className="flex flex-wrap items-center gap-2 pt-0.5 text-sm font-bold">
                    {eventPriceLabel(e.pricePence)}
                    {e.booked ? (
                      <span className="badge bg-success/15 text-success">You&apos;re booked in</span>
                    ) : left === 0 ? (
                      <span className="badge bg-warn/15 text-warn">Fully booked</span>
                    ) : left != null ? (
                      <span className="badge bg-brand-soft text-brand-dark">{left} places left</span>
                    ) : null}
                  </p>
                </div>
              </div>

              {e.description && (
                <div
                  className="prose-site text-sm"
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(e.description) }}
                />
              )}

              <EventBooking
                eventId={e.id}
                askDogName={e.askDogName}
                full={left === 0}
                priceLabel={eventPriceLabel(e.pricePence)}
                signedIn
                booked={e.booked}
                dogs={dogs}
                bookedDogNames={dogNamesByEvent.get(e.id) ?? null}
                billingNote={
                  e.pricePence
                    ? "It goes on your next invoice and is taken with your usual payment."
                    : null
                }
                defaults={{ name: user.name, email: user.email, phone: user.phone ?? "" }}
              />
            </section>
          );
        })
      )}
    </div>
  );
}
