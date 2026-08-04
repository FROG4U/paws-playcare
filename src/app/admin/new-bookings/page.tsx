import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { WALK_STATUS } from "@/lib/constants";
import { formatDate, dayKey } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getServices } from "@/lib/services";
import { serviceColorMap } from "@/lib/service-colors";
import { PageHeader, EmptyState } from "@/components/ui";
import { ServiceBadge } from "@/components/ServiceBadge";
import { Icon } from "@/components/Icon";
import { BookingActions, type WalkLite } from "./BookingActions";

function bookingStatusLabel(b: { reviewedAt: Date | null; decision: string | null; status: string }): string {
  if (b.status === "CANCELLED" || b.decision === "REJECTED") return "Rejected";
  if (b.reviewedAt == null) return "Awaiting review";
  if (b.decision === "ACCEPTED") return "Accepted";
  return "Reviewed";
}

export default async function NewBookingsPage() {
  const [bookings, allBookings, services] = await Promise.all([
    prisma.booking.findMany({
      where: { reviewedAt: null, status: "ACTIVE" },
      include: {
        client: { select: { name: true, email: true, phone: true } },
        walks: { orderBy: { date: "asc" } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.booking.findMany({
      include: {
        client: { select: { name: true } },
        _count: { select: { walks: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    getServices(),
  ]);

  const colorMap = serviceColorMap(services);
  const colorOf = (name: string | null) => (name != null ? colorMap[name] ?? null : null);

  return (
    <div className="space-y-5">
      <PageHeader
        icon="inbox"
        title="Bookings"
        subtitle="Accept, edit, or reject requests — and edit any booking at any time."
      />

      <section className="space-y-4">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Awaiting review ({bookings.length})</h2>

        {bookings.length === 0 && (
          <EmptyState icon="inbox" title="Inbox zero">
            No new booking requests right now. New ones will land here.
          </EmptyState>
        )}

        {bookings.map((b) => {
          const activeWalks = b.walks.filter((w) => w.status !== WALK_STATUS.CANCELLED);
          const total = activeWalks.reduce((sum, w) => sum + w.price, 0);
          const walkLites: WalkLite[] = b.walks.map((w) => ({
            id: w.id,
            dateIso: dayKey(w.date),
            label: formatDate(w.date),
            editable: w.status !== WALK_STATUS.COMPLETED && w.status !== WALK_STATUS.CANCELLED,
          }));

          return (
            <div key={b.id} className="card space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-bold">
                    <ServiceBadge name={b.serviceName ?? "Walk"} colorIndex={colorOf(b.serviceName)} />
                    <span className="badge bg-brand-soft text-brand-dark">
                      {b.type === "RECURRING" ? "Repeating" : "One-off"}
                    </span>
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    {b.client.name}
                    {b.client.phone ? ` · ${b.client.phone}` : ""} · {b.numDogs} dog
                    {b.numDogs !== 1 ? "s" : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">Requested {formatDate(b.createdAt)}</p>
                </div>
                <div className="text-right">
                  <p className="text-lg font-extrabold">{formatMoney(total)}</p>
                  <p className="text-xs text-muted">
                    {activeWalks.length} walk{activeWalks.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {b.walks.map((w) => (
                  <span
                    key={w.id}
                    className={`badge ${
                      w.status === WALK_STATUS.CANCELLED
                        ? "bg-border text-muted line-through"
                        : "bg-background text-foreground"
                    }`}
                  >
                    {formatDate(w.date)} · {w.timeSlot}
                  </span>
                ))}
              </div>

              {b.notes && <p className="text-sm text-muted">Note: {b.notes}</p>}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <BookingActions bookingId={b.id} walks={walkLites} />
                <Link href={`/admin/bookings/${b.id}`} className="btn-outline">
                  <Icon name="pencil" className="h-4 w-4" />
                  Edit booking
                </Link>
              </div>
            </div>
          );
        })}
      </section>

      {/* All bookings — edit any of them at any time */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">All bookings ({allBookings.length})</h2>
        {allBookings.length === 0 ? (
          <p className="text-sm text-muted">No bookings yet.</p>
        ) : (
          <div className="space-y-2">
            {allBookings.map((b) => (
              <Link
                key={b.id}
                href={`/admin/bookings/${b.id}`}
                className="card flex flex-wrap items-center justify-between gap-2 transition hover:border-brand/30 hover:shadow-md"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <ServiceBadge name={b.serviceName ?? "Walk"} colorIndex={colorOf(b.serviceName)} />
                  <span className="font-semibold">{b.client.name}</span>
                  <span className="text-sm text-muted">
                    {b._count.walks} walk{b._count.walks !== 1 ? "s" : ""} · {formatDate(b.createdAt)}
                  </span>
                </div>
                <span className="badge bg-mist text-muted">{bookingStatusLabel(b)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
