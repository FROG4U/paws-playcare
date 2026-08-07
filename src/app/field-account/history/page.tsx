import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { slotLabel } from "@/lib/field";
import { FIELD_BOOKING_STATUS } from "@/lib/constants";

export const dynamic = "force-dynamic";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default async function FieldHistory() {
  const user = (await getCurrentUser())!;
  const bookings = await prisma.fieldBooking.findMany({
    where: { clientId: user.id, status: FIELD_BOOKING_STATUS.PAID },
    include: { slots: true },
    orderBy: { date: "desc" },
  });

  // Group by year → month (most recent first).
  const byYear = new Map<number, Map<number, typeof bookings>>();
  let grandTotal = 0;
  for (const b of bookings) {
    grandTotal += b.total;
    const y = b.date.getUTCFullYear();
    const m = b.date.getUTCMonth();
    if (!byYear.has(y)) byYear.set(y, new Map());
    const months = byYear.get(y)!;
    if (!months.has(m)) months.set(m, []);
    months.get(m)!.push(b);
  }
  const years = [...byYear.keys()].sort((a, b) => b - a);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">Booking history</h1>
          <p className="text-muted">
            {bookings.length} booking{bookings.length === 1 ? "" : "s"} · {formatMoney(grandTotal)} total
          </p>
        </div>
        <Link href="/field" className="btn-outline">Book again</Link>
      </div>

      {bookings.length === 0 && (
        <div className="card text-sm text-muted">
          You haven&apos;t booked the field yet.{" "}
          <Link href="/field" className="font-semibold text-brand">Book a slot →</Link>
        </div>
      )}

      {years.map((y) => {
        const months = byYear.get(y)!;
        const monthKeys = [...months.keys()].sort((a, b) => b - a);
        const yearTotal = [...months.values()].flat().reduce((s, b) => s + b.total, 0);
        return (
          <section key={y} className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-bold">{y}</h2>
              <span className="text-sm text-muted">{formatMoney(yearTotal)}</span>
            </div>
            {monthKeys.map((m) => {
              const list = months.get(m)!;
              const monthTotal = list.reduce((s, b) => s + b.total, 0);
              return (
                <div key={m} className="card">
                  <div className="mb-2 flex items-baseline justify-between">
                    <h3 className="font-semibold">{MONTHS[m]}</h3>
                    <span className="text-sm text-muted">{formatMoney(monthTotal)}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map((b) => {
                      const hours = b.slots.map((s) => s.hour).sort((a, c) => a - c);
                      return (
                        <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 first:border-0 first:pt-0">
                          <div>
                            <p className="text-sm font-semibold">{formatDate(b.date)}</p>
                            <p className="text-xs text-muted">
                              {hours.map(slotLabel).join(", ")} · Ref {b.reference}
                            </p>
                          </div>
                          <span className="text-sm font-semibold">{formatMoney(b.total)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
