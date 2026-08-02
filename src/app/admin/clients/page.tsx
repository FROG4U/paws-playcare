import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-success/15 text-success",
  PENDING: "bg-warn/15 text-warn",
  SUSPENDED: "bg-danger/10 text-danger",
};

async function loadClients() {
  return prisma.user.findMany({
    where: { role: ROLES.CLIENT },
    include: { _count: { select: { dogs: true } } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });
}
type ClientRow = Awaited<ReturnType<typeof loadClients>>[number];

export default async function ClientsPage() {
  const clients = await loadClients();
  const active = clients.filter((c) => !c.archivedAt);
  const archived = clients.filter((c) => c.archivedAt);
  const activeCount = active.filter((c) => c.status === USER_STATUS.ACTIVE).length;

  return (
    <div className="space-y-5">
      <PageHeader
        icon="users"
        title="Clients"
        subtitle={`${active.length} client${active.length !== 1 ? "s" : ""} · ${activeCount} active${archived.length ? ` · ${archived.length} archived` : ""}`}
      />

      {active.length === 0 ? (
        <EmptyState icon="users" title="No clients yet">
          New client registrations will appear here for approval.
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {active.map((c) => (
            <ClientCard key={c.id} c={c} />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="space-y-3 pt-2">
          <h2 className="flex items-center gap-2 text-sm font-bold text-muted">
            <Icon name="inbox" className="h-4 w-4" />
            Archived ({archived.length})
          </h2>
          <div className="grid gap-3">
            {archived.map((c) => (
              <ClientCard key={c.id} c={c} archived />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ClientCard({ c, archived }: { c: ClientRow; archived?: boolean }) {
  const hasCard = !!c.paymentMethodId;
  return (
    <Link
      href={`/admin/clients/${c.id}`}
      className={`card flex flex-wrap items-center justify-between gap-3 transition hover:border-brand/30 hover:shadow-md ${archived ? "opacity-70" : ""}`}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-dark">
          {c.name.split(" ").slice(0, 2).map((p) => p[0]?.toUpperCase()).join("")}
        </span>
        <div>
          <p className="font-bold">
            {c.name}
            <span className={`ml-2 badge ${STATUS_BADGE[c.status] ?? "bg-border text-muted"}`}>
              {c.status.toLowerCase()}
            </span>
            {archived && <span className="ml-1 badge bg-border text-muted">archived</span>}
          </p>
          <p className="text-sm text-muted">
            {c.email}
            {c.phone ? ` · ${c.phone}` : ""}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="badge bg-background text-foreground">
          <Icon name="paw" className="h-3.5 w-3.5" />
          {c._count.dogs} dog{c._count.dogs !== 1 ? "s" : ""}
        </span>
        <span className="badge bg-background capitalize text-foreground">
          <Icon name="clock" className="h-3.5 w-3.5" />
          {c.payCadence.toLowerCase()}
        </span>
        <span className={`badge ${hasCard ? "bg-success/15 text-success" : "bg-warn/15 text-warn"}`}>
          <Icon name="card" className="h-3.5 w-3.5" />
          {hasCard ? "Card on file" : "No card"}
        </span>
        <Icon name="chevronRight" className="h-4 w-4 text-muted" />
      </div>
    </Link>
  );
}
