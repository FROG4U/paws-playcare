import { prisma } from "@/lib/prisma";
import { ROLES, WALK_STATUS } from "@/lib/constants";
import { getServices } from "@/lib/services";
import { dayKey, formatDate } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { ExtraDaysForm, type ClientOption, type ServiceOption, type AddedDay } from "./ExtraDaysForm";

export default async function ExtraDaysPage() {
  const [clients, services, added] = await Promise.all([
    prisma.user.findMany({
      where: { role: ROLES.CLIENT, archivedAt: null },
      select: {
        id: true, name: true, email: true, payCadence: true,
        dogs: { select: { id: true, name: true }, orderBy: { createdAt: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    getServices(),
    prisma.walk.findMany({
      where: { isExtra: true, status: { not: WALK_STATUS.CANCELLED } },
      include: {
        client: { select: { name: true } },
        invoiceItem: { include: { invoice: { select: { number: true, status: true, dueAt: true, paidAt: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  const clientOptions: ClientOption[] = clients.map((c) => ({
    id: c.id,
    name: c.name,
    email: c.email,
    cadence: c.payCadence.toLowerCase(),
    dogs: c.dogs,
  }));

  const serviceOptions: ServiceOption[] = services
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: s.name, pricePerDog: s.pricePerDog }));

  const addedDays: AddedDay[] = added.map((w) => {
    const inv = w.invoiceItem?.invoice;
    return {
      id: w.id,
      client: w.client.name,
      dateLabel: formatDate(w.date),
      serviceName: w.serviceName,
      numDogs: w.numDogs,
      price: w.price,
      invoiceNumber: inv?.number ?? null,
      invoiceState: !inv ? "not-invoiced" : inv.paidAt || inv.status === "PAID" ? "paid" : inv.dueAt ? "issued" : "open",
      completed: w.status === WALK_STATUS.COMPLETED,
    };
  });

  return (
    <div className="space-y-5">
      <PageHeader
        icon="plus"
        title="Add days"
        subtitle="Put extra days on a client's account by hand and bill them on their own pay cycle."
      />

      <ExtraDaysForm
        clients={clientOptions}
        services={serviceOptions}
        todayIso={dayKey(new Date())}
        added={addedDays}
      />

      {addedDays.length === 0 && (
        <p className="card flex items-center gap-2 text-sm text-muted">
          <Icon name="clipboard" className="h-4 w-4" />
          Days you add by hand will be listed here so you can change the price or take them off again.
        </p>
      )}
    </div>
  );
}
