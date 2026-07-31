import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ROLES, USER_STATUS, WALK_STATUS } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { dayKey, formatDate } from "@/lib/dates";
import { PageHeader, StatCard, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";

export default async function AdminHome() {
  const todayStart = new Date(dayKey(new Date()) + "T00:00:00.000Z");
  const todayEnd = new Date(dayKey(new Date()) + "T23:59:59.999Z");

  const [pendingClients, newBookings, todayWalks, activeClients, openInvoices] =
    await Promise.all([
      prisma.user.count({ where: { role: ROLES.CLIENT, status: USER_STATUS.PENDING } }),
      prisma.booking.count({ where: { reviewedAt: null, status: "ACTIVE" } }),
      prisma.walk.findMany({
        where: {
          date: { gte: todayStart, lte: todayEnd },
          status: { in: [WALK_STATUS.ACCEPTED, WALK_STATUS.ASSIGNED] },
        },
        include: { client: true, worker: true },
        orderBy: { timeSlot: "asc" },
      }),
      prisma.user.count({ where: { role: ROLES.CLIENT, status: USER_STATUS.ACTIVE } }),
      prisma.invoice.aggregate({ where: { status: "OPEN" }, _sum: { total: true } }),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader icon="home" title="Dashboard" subtitle="Today at a glance" />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon="inbox" label="New bookings" value={newBookings} href="/admin/new-bookings" tone="amber" highlight={newBookings > 0} />
        <StatCard icon="check" label="Awaiting approval" value={pendingClients} href="/admin/approvals" tone="amber" highlight={pendingClients > 0} />
        <StatCard icon="users" label="Active clients" value={activeClients} href="/admin/clients" />
        <StatCard icon="pound" label="Outstanding" value={formatMoney(openInvoices._sum.total ?? 0)} href="/admin/invoices" tone="green" />
      </div>

      <div className="card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="calendar" className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-bold">Today&apos;s walks</h2>
          </div>
          <Link href="/admin/calendar" className="inline-flex items-center gap-1 text-sm font-semibold text-brand">
            Calendar <Icon name="chevronRight" className="h-4 w-4" />
          </Link>
        </div>
        {todayWalks.length === 0 ? (
          <div className="mt-3">
            <EmptyState icon="paw" title="No walks scheduled today">
              When walks are booked and assigned, they&apos;ll show up here.
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
                    <p className="text-sm text-muted">
                      {w.numDogs} dog{w.numDogs > 1 ? "s" : ""} · {w.worker ? w.worker.name : "Unassigned"}
                    </p>
                  </div>
                </div>
                <span className="badge bg-brand-soft text-brand-dark">
                  {w.status === WALK_STATUS.ACCEPTED ? "Walk accepted" : "Awaiting worker"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wider text-muted/70">Quick actions</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { href: "/admin/services", icon: "paw", label: "Services", sub: "Edit what you offer" },
            { href: "/admin/pricing", icon: "tag", label: "Pricing", sub: "Rates & holidays" },
            { href: "/admin/workers", icon: "footprints", label: "Team", sub: "Invite walkers" },
          ].map((a) => (
            <Link key={a.href} href={a.href} className="card flex items-center gap-3 transition hover:border-brand/30 hover:shadow-md">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand-soft text-brand">
                <Icon name={a.icon} className="h-5 w-5" />
              </span>
              <div>
                <p className="font-bold">{a.label}</p>
                <p className="text-sm text-muted">{a.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
