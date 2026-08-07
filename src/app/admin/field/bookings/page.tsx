import { prisma } from "@/lib/prisma";
import { atUtcMidnight, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { slotLabel, groupSlotsByDay } from "@/lib/field";
import { FIELD_BOOKING_STATUS } from "@/lib/constants";
import { CancelButton } from "./CancelButton";

export const dynamic = "force-dynamic";

type Row = Awaited<ReturnType<typeof load>>["upcoming"][number];

async function load() {
  const today = atUtcMidnight(new Date());
  const [upcoming, past, revenue] = await Promise.all([
    prisma.fieldBooking.findMany({
      where: { status: FIELD_BOOKING_STATUS.PAID, date: { gte: today } },
      include: { slots: true, client: { select: { id: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.fieldBooking.findMany({
      where: { status: FIELD_BOOKING_STATUS.PAID, date: { lt: today } },
      include: { slots: true, client: { select: { id: true } } },
      orderBy: { date: "desc" },
      take: 100,
    }),
    prisma.fieldBooking.aggregate({
      where: { status: FIELD_BOOKING_STATUS.PAID },
      _sum: { total: true },
      _count: true,
    }),
  ]);
  return { upcoming, past, revenue };
}

export default async function FieldBookingsPage() {
  const { upcoming, past, revenue } = await load();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Field bookings</h1>
          <p className="text-muted">Playground hire — fully automated, no approval needed.</p>
        </div>
        <div className="rounded-xl bg-success/10 px-4 py-2 text-right">
          <p className="text-xs font-semibold uppercase text-success">Total taken</p>
          <p className="text-lg font-bold text-success">{formatMoney(revenue._sum.total ?? 0)}</p>
          <p className="text-xs text-muted">{revenue._count} booking{revenue._count === 1 ? "" : "s"}</p>
        </div>
      </div>

      <Section title={`Upcoming (${upcoming.length})`} rows={upcoming} cancellable />
      <Section title={`Completed (${past.length})`} rows={past} />
    </div>
  );
}

function Section({ title, rows, cancellable }: { title: string; rows: Row[]; cancellable?: boolean }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
      {rows.length === 0 ? (
        <div className="card text-sm text-muted">Nothing here yet.</div>
      ) : (
        <div className="space-y-2">
          {rows.map((b) => {
            const groups = groupSlotsByDay(b.slots);
            return (
              <div key={b.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  {groups.map((g) => (
                    <p key={g.dateKey} className="font-bold">
                      {formatDate(g.date)}{" "}
                      <span className="ml-1 text-sm font-normal text-muted">{g.hours.map(slotLabel).join(", ")}</span>
                    </p>
                  ))}
                  <p className="text-sm text-muted">
                    {b.name} · {b.email}
                    {b.phone ? ` · ${b.phone}` : ""}
                    {b.carReg ? ` · 🚗 ${b.carReg}` : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-muted">
                    Ref {b.reference} ·{" "}
                    <span className={b.client ? "text-brand-dark" : ""}>
                      {b.client ? "Account" : "Guest"}
                    </span>
                    {b.couponCode ? ` · ${b.couponCode}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="badge bg-success/15 text-success">{formatMoney(b.total)}</span>
                  {cancellable && <CancelButton id={b.id} />}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
