import { prisma } from "@/lib/prisma";
import { formatMoney } from "@/lib/money";
import { formatDate } from "@/lib/dates";
import { ROLES, FIELD_BOOKING_STATUS } from "@/lib/constants";
import { ClientActions } from "./ClientActions";

export const dynamic = "force-dynamic";

export default async function FieldClientsPage() {
  const [users, spend] = await Promise.all([
    prisma.user.findMany({
      where: { role: ROLES.FIELD_CLIENT },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { fieldBookings: true } } },
    }),
    prisma.fieldBooking.groupBy({
      by: ["clientId"],
      where: { status: FIELD_BOOKING_STATUS.PAID, clientId: { not: null } },
      _sum: { total: true },
    }),
  ]);
  const spendMap = new Map(spend.map((s) => [s.clientId, s._sum.total ?? 0]));

  const active = users.filter((u) => !u.archivedAt);
  const archived = users.filter((u) => u.archivedAt);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Field clients</h1>
        <p className="text-muted">
          {active.length} account{active.length === 1 ? "" : "s"} · playground-hire customers (separate from
          dog-walking clients)
        </p>
      </div>

      <List users={active} spendMap={spendMap} />

      {archived.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Archived ({archived.length})</h2>
          <List users={archived} spendMap={spendMap} />
        </section>
      )}
    </div>
  );
}

function List({
  users,
  spendMap,
}: {
  users: {
    id: string; name: string; email: string; phone: string | null; carReg: string | null; createdAt: Date;
    fieldBlockedAt: Date | null; fieldBlockReason: string | null; archivedAt: Date | null;
    _count: { fieldBookings: number };
  }[];
  spendMap: Map<string | null, number>;
}) {
  if (users.length === 0) {
    return <div className="card text-sm text-muted">No field clients yet.</div>;
  }
  return (
    <div className="space-y-2">
      {users.map((u) => (
        <div key={u.id} className="card flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-bold">
              {u.name}
              {u.fieldBlockedAt && <span className="badge ml-2 bg-danger/15 text-danger">Blocked</span>}
            </p>
            <p className="text-sm text-muted">
              {u.email}{u.phone ? ` · ${u.phone}` : ""}{u.carReg ? ` · 🚗 ${u.carReg}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-muted">
              {u._count.fieldBookings} booking{u._count.fieldBookings === 1 ? "" : "s"} ·{" "}
              {formatMoney(spendMap.get(u.id) ?? 0)} spent · joined {formatDate(u.createdAt)}
              {u.fieldBlockReason ? ` · ${u.fieldBlockReason}` : ""}
            </p>
          </div>
          <ClientActions id={u.id} blocked={!!u.fieldBlockedAt} archived={!!u.archivedAt} />
        </div>
      ))}
    </div>
  );
}
