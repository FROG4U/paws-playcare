import type { Metadata } from "next";
import Link from "next/link";
import { PageHero } from "@/components/site";
import { Icon } from "@/components/Icon";
import { getLiveEvents, eventWhen, eventPriceLabel, placesLeft } from "@/lib/events";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Events — Paws Playcare",
  description: "Fun days, group walks and socials with Paws Playcare in Watford.",
};

export default async function EventsPage() {
  const events = await getLiveEvents();

  return (
    <>
      <PageHero
        heading="Events"
        sub="Fun days, group walks and socials - come and join us."
        image={events.find((e) => e.imagePath)?.imagePath ?? null}
      />

      <section className="mx-auto w-full max-w-5xl px-5 py-14">
        {events.length === 0 ? (
          <div className="card text-center">
            <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-brand-soft text-brand">
              <Icon name="sparkles" className="h-7 w-7" />
            </span>
            <h2 className="mt-4 text-xl font-extrabold">Nothing in the diary just now</h2>
            <p className="mt-2 text-muted">
              Check back soon - we&apos;ll put our next get-together up here.
            </p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {events.map((e) => {
              const left = placesLeft(e.capacity, e._count.signups);
              return (
                <Link
                  key={e.id}
                  href={`/events/${e.slug}`}
                  className="card group overflow-hidden p-0 transition hover:border-brand/30 hover:shadow-md"
                >
                  {e.imagePath ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.imagePath} alt="" className="h-44 w-full object-cover" />
                  ) : (
                    <div className="grid h-44 w-full place-items-center bg-gradient-to-br from-brand to-brand-dark text-white">
                      <Icon name="sparkles" className="h-10 w-10" />
                    </div>
                  )}
                  <div className="space-y-1.5 p-5">
                    <h2 className="text-lg font-extrabold group-hover:text-brand">{e.title}</h2>
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
                    <p className="flex flex-wrap items-center gap-2 pt-1 text-sm font-bold">
                      {eventPriceLabel(e.pricePence)}
                      {left === 0 ? (
                        <span className="badge bg-warn/15 text-warn">Fully booked</span>
                      ) : left != null ? (
                        <span className="badge bg-brand-soft text-brand-dark">{left} places left</span>
                      ) : null}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </>
  );
}
