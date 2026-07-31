import { prisma } from "@/lib/prisma";
import { WALK_STATUS } from "@/lib/constants";
import { formatDate, dayKey } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { BookingActions, type WalkLite } from "./BookingActions";

export default async function NewBookingsPage() {
  const bookings = await prisma.booking.findMany({
    where: { reviewedAt: null, status: "ACTIVE" },
    include: {
      client: { select: { name: true, email: true, phone: true } },
      walks: { orderBy: { date: "asc" } },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">New Bookings</h1>
        <p className="text-muted">
          Incoming requests from clients. Accept, edit the dates, or reject —
          the client is notified of whatever you decide.
        </p>
      </div>

      {bookings.length === 0 && (
        <div className="card text-center text-muted">📥 No new booking requests right now.</div>
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
                <h2 className="text-lg font-bold">
                  {b.serviceName ?? "Walk"}{" "}
                  <span className="badge bg-brand-soft text-brand-dark">
                    {b.type === "RECURRING" ? "Repeating" : "One-off"}
                  </span>
                </h2>
                <p className="text-sm text-muted">
                  {b.client.name}
                  {b.client.phone ? ` · ${b.client.phone}` : ""} · {b.numDogs} dog
                  {b.numDogs !== 1 ? "s" : ""}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  Requested {formatDate(b.createdAt)}
                </p>
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

            <BookingActions bookingId={b.id} walks={walkLites} />
          </div>
        );
      })}
    </div>
  );
}
