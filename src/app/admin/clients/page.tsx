import { prisma } from "@/lib/prisma";
import { ROLES, USER_STATUS } from "@/lib/constants";
import { PageHeader, EmptyState } from "@/components/ui";
import { ClientsList, type ClientRow } from "./ClientsList";

export default async function ClientsPage() {
  const clients = await prisma.user.findMany({
    where: { role: ROLES.CLIENT },
    include: { dogs: { select: { name: true }, orderBy: { createdAt: "asc" } } },
    orderBy: [{ status: "asc" }, { name: "asc" }],
  });

  const rows: ClientRow[] = clients.map((c) => ({
    id: c.id,
    owner: c.name,
    dogs: c.dogs.map((d) => d.name),
    email: c.email,
    phone: c.phone,
    status: c.status,
    payCadence: c.payCadence,
    hasCard: !!c.paymentMethodId,
    archived: !!c.archivedAt,
  }));

  const active = rows.filter((r) => !r.archived);
  const archived = rows.filter((r) => r.archived);
  const activeCount = active.filter((r) => r.status === USER_STATUS.ACTIVE).length;

  return (
    <div className="space-y-5">
      <PageHeader
        icon="users"
        title="Clients"
        subtitle={`${active.length} client${active.length !== 1 ? "s" : ""} · ${activeCount} active${archived.length ? ` · ${archived.length} archived` : ""}`}
      />

      {rows.length === 0 ? (
        <EmptyState icon="users" title="No clients yet">
          New client registrations will appear here for approval.
        </EmptyState>
      ) : (
        <ClientsList rows={rows} />
      )}
    </div>
  );
}
