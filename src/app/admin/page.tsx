import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ROLES, USER_STATUS, WALK_STATUS, walkStatusBadge } from "@/lib/constants";
import { formatMoney } from "@/lib/money";
import { dayKey, formatDate } from "@/lib/dates";
import { getServices } from "@/lib/services";
import { serviceColorMap } from "@/lib/service-colors";
import { PageHeader, StatCard, EmptyState } from "@/components/ui";
import { ServiceBadge } from "@/components/ServiceBadge";
import { Icon } from "@/components/Icon";

export default async function AdminHome() {
  const todayStart = new Date(dayKey(new Date()) + "T00:00:00.000Z");
  const todayEnd = new Date(dayKey(new Date()) + "T23:59:59.999Z");

  const [pendingClients, newBookings, todayWalks, activeClients, openInvoices] =
    await Promise.all([
      prisma.user.count({ where: { role: ROLES.CLIENT, status: USER_STATUS.PENDING } }),
      prisma.booking.count({ where: { reviewedAt: null, status: "ACTIVE" } }),
      // Every live walk today — most sit at REQUESTED because walks are
      // completed directly rather than assigned to a walker first, and filtering
      // on ASSIGNED/ACCEPTED left this empty while the Calendar showed them.
      prisma.walk.findMany({
        where: {
          date: { gte: todayStart, lte: todayEnd },
          status: { notIn: [WALK_STATUS.CANCELLED, WALK_STATUS.DECLINED] },
        },
        include: {
          client: { select: { name: true } },
          worker: { select: { name: true } },
          booking: { select: { dogIds: true } },
        },
        orderBy: [{ timeSlot: "asc" }, { createdAt: "asc" }],
      }),
      prisma.user.count({ where: { role: ROLES.CLIENT, status: USER_STATUS.ACTIVE } }),
      prisma.invoice.aggregate({ where: { status: "OPEN" }, _sum: { total: true } }),
    ]);

  const colorMap = serviceColorMap(await getServices());

  // Resolve each walk's dog name(s) from its booking, like Bookings/Calendar do.
  const dogIdSet = new Set<string>();
  for (const w of todayWalks) {
    try {
      for (const id of JSON.parse(w.booking?.dogIds || "[]")) dogIdSet.add(id);
    } catch {}
  }
  const dogRows = dogIdSet.size
    ? await prisma.dog.findMany({ where: { id: { in: [...dogIdSet] } }, select: { id: true, name: true } })
    : [];
  const dogNameById = new Map(dogRows.map((d) => [d.id, d.name]));
  const petsFor = (w: (typeof todayWalks)[number]) => {
    try {
      const names = (JSON.parse(w.booking?.dogIds || "[]") as string[])
        .map((id) => dogNameById.get(id))
        .filter(Boolean) as string[];
      if (names.length === 1) return names[0];
      if (names.length > 1) return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
    } catch {}
    return `${w.numDogs} dog${w.numDogs > 1 ? "s" : ""}`;
  };

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
              Walks booked for today will show up here.
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
                    <p className="flex items-center gap-2 font-semibold">
                      {w.timeSlot} · {petsFor(w)}
                      <ServiceBadge name={w.serviceName ?? "Walk"} colorIndex={w.serviceName != null ? colorMap[w.serviceName] ?? null : null} />
                    </p>
                    <p className="text-sm text-muted">
                      {w.client.name} · {w.numDogs} dog{w.numDogs > 1 ? "s" : ""}
                      {w.worker ? ` · ${w.worker.name}` : ""}
                    </p>
                  </div>
                </div>
                {walkStatusBadge(w.status) && (
                  <span
                    className={`badge ${w.status === WALK_STATUS.COMPLETED ? "bg-success/15 text-success" : "bg-brand-soft text-brand-dark"}`}
                  >
                    {walkStatusBadge(w.status)}
                  </span>
                )}
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
