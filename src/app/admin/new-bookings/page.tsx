import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { WALK_STATUS, PAY_CADENCE } from "@/lib/constants";
import { formatDate, dayKey } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { billingPeriodFor } from "@/lib/billing";
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

const CADENCE_UNIT: Record<string, string> = {
  [PAY_CADENCE.DAILY]: "day",
  [PAY_CADENCE.WEEKLY]: "week",
  [PAY_CADENCE.MONTHLY]: "month",
};
const CADENCE_ADVERB: Record<string, string> = {
  [PAY_CADENCE.DAILY]: "daily",
  [PAY_CADENCE.WEEKLY]: "weekly",
  [PAY_CADENCE.MONTHLY]: "monthly",
};

// How this booking bills under the client's pay cadence: the amount for one
// full billing period (a typical week/month/day), not the whole schedule total.
// The card shows this instead of the misleading multi-week lump sum.
function perCycleCharge(
  cadence: string,
  walks: { date: Date; price: number }[]
): { perCycle: number; periods: number } {
  const buckets = new Map<string, number>();
  for (const w of walks) {
    const key = dayKey(billingPeriodFor(cadence, w.date).start);
    buckets.set(key, (buckets.get(key) ?? 0) + w.price);
  }
  // Use the largest full period as the representative charge (the last period
  // can be short if the schedule ends mid-week).
  const perCycle = buckets.size ? Math.max(...buckets.values()) : 0;
  return { perCycle, periods: buckets.size };
}

export default async function NewBookingsPage() {
  const [bookings, allBookings, services] = await Promise.all([
    prisma.booking.findMany({
      where: { reviewedAt: null, status: "ACTIVE" },
      include: {
        client: { select: { name: true, email: true, phone: true, payCadence: true } },
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
          const cadence = b.client.payCadence;
          const recurring = b.type === "RECURRING";
          const { perCycle, periods } = perCycleCharge(cadence, activeWalks);
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
                  {recurring ? (
                    <>
                      <p className="text-lg font-extrabold">
                        {formatMoney(perCycle)}
                        <span className="text-sm font-semibold text-muted"> / {CADENCE_UNIT[cadence] ?? "week"}</span>
                      </p>
                      <p className="text-xs text-muted">
                        billed {CADENCE_ADVERB[cadence] ?? "weekly"} · {activeWalks.length} walk
                        {activeWalks.length !== 1 ? "s" : ""} over {periods}{" "}
                        {CADENCE_UNIT[cadence] ?? "week"}{periods !== 1 ? "s" : ""}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg font-extrabold">{formatMoney(total)}</p>
                      <p className="text-xs text-muted">
                        {activeWalks.length} walk{activeWalks.length !== 1 ? "s" : ""}
                      </p>
                    </>
                  )}
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
