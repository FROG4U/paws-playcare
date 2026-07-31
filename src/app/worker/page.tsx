import Link from "next/link";
import { requireWorker } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { WALK_STATUS, WALK_STATUS_LABELS } from "@/lib/constants";
import { dayKey, formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PageHeader, StatCard, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";

export default async function WorkerHome() {
  const user = await requireWorker();
  const todayStart = new Date(dayKey(new Date()) + "T00:00:00.000Z");
  const todayEnd = new Date(dayKey(new Date()) + "T23:59:59.999Z");
  const active = [WALK_STATUS.ASSIGNED, WALK_STATUS.ACCEPTED];

  const [todayWalks, upcoming, completed, earnings] = await Promise.all([
    prisma.walk.findMany({
      where: { assignedWorkerId: user.id, date: { gte: todayStart, lte: todayEnd }, status: { in: active } },
      include: { client: { select: { name: true } } },
      orderBy: { timeSlot: "asc" },
    }),
    prisma.walk.count({ where: { assignedWorkerId: user.id, date: { gt: todayEnd }, status: { in: active } } }),
    prisma.walk.count({ where: { assignedWorkerId: user.id, status: WALK_STATUS.COMPLETED } }),
    prisma.earning.aggregate({ where: { workerId: user.id }, _sum: { amount: true } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader icon="footprints" title={`Hi, ${user.name.split(" ")[0]}`} subtitle="Your walking day" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="paw" label="Today's walks" value={todayWalks.length} highlight={todayWalks.length > 0} />
        <StatCard icon="calendar" label="Upcoming" value={upcoming} tone="amber" />
        <StatCard icon="check" label="Completed" value={completed} tone="green" />
        <StatCard icon="wallet" label="Earned" value={formatMoney(earnings._sum.amount ?? 0)} href="/worker/earnings" tone="green" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="paw" className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-bold">Today&apos;s walks</h2>
          </div>
          <Link href="/worker/jobs" className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
            Job board <Icon name="chevronRight" className="h-4 w-4" />
          </Link>
        </div>
        {todayWalks.length === 0 ? (
          <div className="mt-3">
            <EmptyState icon="calendar" title="Nothing on today">
              Walks assigned to you will show up here on the day.
            </EmptyState>
          </div>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {todayWalks.map((w) => (
              <li key={w.id} className="flex items-center justify-between py-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                    <Icon name="paw" className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="font-semibold">{w.timeSlot} · {w.client.name}</p>
                    <p className="text-sm text-muted">{formatDate(w.date)} · {w.numDogs} dog{w.numDogs > 1 ? "s" : ""}</p>
                  </div>
                </div>
                <span className="badge bg-brand-soft text-brand-dark">{WALK_STATUS_LABELS[w.status]}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
