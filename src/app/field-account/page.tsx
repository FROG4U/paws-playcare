import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { atUtcMidnight, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { slotLabel } from "@/lib/field";
import { FIELD_BOOKING_STATUS } from "@/lib/constants";
import { Icon } from "@/components/Icon";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function FieldAccountHome() {
  const user = (await getCurrentUser())!;
  const today = atUtcMidnight(new Date());

  const [upcoming, totalCount] = await Promise.all([
    prisma.fieldBooking.findMany({
      where: { clientId: user.id, status: FIELD_BOOKING_STATUS.PAID, date: { gte: today } },
      include: { slots: true },
      orderBy: { date: "asc" },
    }),
    prisma.fieldBooking.count({
      where: { clientId: user.id, status: FIELD_BOOKING_STATUS.PAID },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Hello, {user.name.split(" ")[0]} 🐾</h1>
          <p className="text-muted">Your playground bookings</p>
        </div>
        <Link href="/field" className="btn-primary">
          <Icon name="calendar" className="h-5 w-5" />
          Book the field
        </Link>
      </div>

      {/* Upcoming */}
      <section className="space-y-3">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Upcoming</h2>
        {upcoming.length === 0 ? (
          <div className="card text-sm text-muted">
            No upcoming bookings yet.{" "}
            <Link href="/field" className="font-semibold text-brand">Book a slot →</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {upcoming.map((b) => {
              const hours = b.slots.map((s) => s.hour).sort((a, c) => a - c);
              return (
                <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold">{formatDate(b.date)}</p>
                    <p className="text-sm text-muted">{hours.map(slotLabel).join(", ")}</p>
                    <p className="mt-0.5 text-xs text-muted">Ref {b.reference}</p>
                  </div>
                  <span className="badge bg-success/15 text-success">{formatMoney(b.total)} paid</span>
                </div>
              );
            })}
          </div>
        )}
        {totalCount > upcoming.length && (
          <Link href="/field-account/history" className="text-sm font-semibold text-brand">
            View booking history →
          </Link>
        )}
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact details */}
        <section className="card">
          <h2 className="mb-3 font-bold">Your details</h2>
          <ProfileForm name={user.name} email={user.email} phone={user.phone} />
        </section>

        {/* Saved card */}
        <section className="card">
          <h2 className="mb-3 font-bold">Payment</h2>
          {user.cardLast4 ? (
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-16 place-items-center rounded-xl bg-brand-soft text-xs font-bold uppercase text-brand-dark">
                {user.cardBrand ?? "Card"}
              </span>
              <div>
                <p className="font-bold capitalize">{user.cardBrand} ···· {user.cardLast4}</p>
                {user.cardExpMonth && user.cardExpYear && (
                  <p className="text-sm text-muted">
                    Expires {String(user.cardExpMonth).padStart(2, "0")}/{String(user.cardExpYear).slice(-2)}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted">No saved card. You can save one for faster booking.</p>
          )}
          <Link href="/field-account/card" className="btn-outline mt-4 inline-flex">
            {user.cardLast4 ? "Manage card" : "Save a card"}
          </Link>
        </section>
      </div>
    </div>
  );
}
