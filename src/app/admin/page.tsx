import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ROLES, USER_STATUS, WALK_STATUS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { dayKey } from "@/lib/dates";

export default async function AdminHome() {
  const todayStart = new Date(dayKey(new Date()) + "T00:00:00.000Z");
  const todayEnd = new Date(dayKey(new Date()) + "T23:59:59.999Z");

  const [pendingClients, unassigned, todayWalks, activeClients, openInvoices] =
    await Promise.all([
      prisma.user.count({
        where: { role: ROLES.CLIENT, status: USER_STATUS.PENDING },
      }),
      prisma.walk.count({ where: { status: WALK_STATUS.REQUESTED } }),
      prisma.walk.findMany({
        where: {
          date: { gte: todayStart, lte: todayEnd },
          status: { in: [WALK_STATUS.ACCEPTED, WALK_STATUS.ASSIGNED] },
        },
        include: { client: true, worker: true },
        orderBy: { timeSlot: "asc" },
      }),
      prisma.user.count({
        where: { role: ROLES.CLIENT, status: USER_STATUS.ACTIVE },
      }),
      prisma.invoice.aggregate({
        where: { status: "OPEN" },
        _sum: { total: true },
        _count: true,
      }),
    ]);

  const stats = [
    { label: "Awaiting approval", value: pendingClients, href: "/admin/approvals", accent: pendingClients > 0 },
    { label: "Unassigned walks", value: unassigned, href: "/admin/bookings", accent: unassigned > 0 },
    { label: "Active clients", value: activeClients, href: "/admin/clients" },
    { label: "Outstanding", value: formatMoney(openInvoices._sum.total ?? 0), href: "/admin/invoices" },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className={`card transition hover:shadow-md ${
              s.accent ? "ring-2 ring-brand/30" : ""
            }`}
          >
            <p className="text-sm text-muted">{s.label}</p>
            <p className="mt-1 text-2xl font-extrabold">{s.value}</p>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold">Today&apos;s walks</h2>
          <Link href="/admin/calendar" className="text-sm font-semibold text-brand">
            View calendar →
          </Link>
        </div>
        {todayWalks.length === 0 ? (
          <p className="mt-3 text-muted">No walks scheduled for today.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {todayWalks.map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-semibold">
                    {w.timeSlot} · {w.client.name}
                  </p>
                  <p className="text-sm text-muted">
                    {w.numDogs} dog{w.numDogs > 1 ? "s" : ""} ·{" "}
                    {w.worker ? `Walker: ${w.worker.name}` : "Unassigned"}
                  </p>
                </div>
                <span className="badge bg-brand-soft text-brand-dark">
                  {w.status === WALK_STATUS.ACCEPTED
                    ? "Walk accepted"
                    : "Awaiting worker"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
