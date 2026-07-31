import { prisma } from "@/lib/prisma";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "bg-success/15 text-success",
  PENDING: "bg-warn/15 text-warn",
  SUSPENDED: "bg-danger/10 text-danger",
};

export default async function ClientsPage() {
  const clients = await prisma.user.findMany({
    where: { role: ROLES.CLIENT },
    include: { _count: { select: { dogs: true } } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const active = clients.filter((c) => c.status === USER_STATUS.ACTIVE).length;

  return (
    <div className="space-y-5">
      <PageHeader
        icon="users"
        title="Clients"
        subtitle={`${clients.length} total · ${active} active`}
      />

      {clients.length === 0 ? (
        <EmptyState icon="users" title="No clients yet">
          New client registrations will appear here for approval.
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {clients.map((c) => {
            const hasCard = !!c.paymentMethodId;
            return (
              <div key={c.id} className="card flex flex-wrap items-center justify-between gap-3">
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
