import { prisma } from "@/lib/prisma";
import { WALK_STATUS, WALK_STATUS_LABELS } from "@/lib/constants";
import { formatDate, dayKey } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PageHeader, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { CompleteButton, UndoButton } from "./WalkActions";

const OPEN_STATUSES = [
  WALK_STATUS.REQUESTED,
  WALK_STATUS.ASSIGNED,
  WALK_STATUS.ACCEPTED,
];

export default async function BookingsPage() {
  const todayEnd = new Date(dayKey(new Date()) + "T23:59:59.999Z");

  const [toComplete, upcoming, recentlyCompleted] = await Promise.all([
    prisma.walk.findMany({
      where: { status: { in: OPEN_STATUSES }, date: { lte: todayEnd } },
      include: { client: { select: { name: true } }, worker: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.walk.findMany({
      where: { status: { in: OPEN_STATUSES }, date: { gt: todayEnd } },
      include: { client: { select: { name: true } }, worker: { select: { name: true } } },
      orderBy: { date: "asc" },
      take: 30,
    }),
    prisma.walk.findMany({
      where: { status: WALK_STATUS.COMPLETED },
      include: { client: { select: { name: true } } },
      orderBy: { completedAt: "desc" },
      take: 15,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon="clipboard"
        title="Bookings"
        subtitle="Mark walks as done — each completed walk is added to the client's invoice."
      />

      {/* Ready to complete */}
      <section className="space-y-3">
        <SectionTitle icon="footprints" title="Ready to complete" count={toComplete.length} />
        {toComplete.length === 0 ? (
          <EmptyState icon="check" title="Nothing to complete">
            Walks up to today will appear here to mark as done.
          </EmptyState>
        ) : (
          <div className="space-y-2">
            {toComplete.map((w) => (
              <div key={w.id} className="card flex flex-wrap items-center justify-between gap-3">
                <WalkFacts
                  client={w.client.name}
                  service={w.serviceName}
                  date={w.date}
                  numDogs={w.numDogs}
                  price={w.price}
                  worker={w.worker?.name ?? null}
                />
                <CompleteButton walkId={w.id} />
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Recently completed */}
      {recentlyCompleted.length > 0 && (
        <section className="space-y-3">
          <SectionTitle icon="check" title="Recently completed" count={recentlyCompleted.length} />
          <div className="space-y-2">
            {recentlyCompleted.map((w) => (
              <div key={w.id} className="card flex flex-wrap items-center justify-between gap-3">
                <WalkFacts
                  client={w.client.name}
                  service={w.serviceName}
                  date={w.date}
                  numDogs={w.numDogs}
                  price={w.price}
                  worker={null}
                  completedAt={w.completedAt}
                />
                <UndoButton walkId={w.id} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <section className="space-y-3">
          <SectionTitle icon="calendar" title="Upcoming" count={upcoming.length} />
          <div className="space-y-2">
            {upcoming.map((w) => (
              <div key={w.id} className="card flex flex-wrap items-center justify-between gap-3">
                <WalkFacts
                  client={w.client.name}
                  service={w.serviceName}
                  date={w.date}
                  numDogs={w.numDogs}
                  price={w.price}
                  worker={w.worker?.name ?? null}
                />
                <span className="badge bg-brand-soft text-brand-dark">
                  {WALK_STATUS_LABELS[w.status] ?? w.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SectionTitle({ icon, title, count }: { icon: string; title: string; count: number }) {
  return (
    <div className="flex items-center gap-2">
      <Icon name={icon} className="h-5 w-5 text-brand" />
      <h2 className="text-lg font-bold">{title}</h2>
      <span className="badge bg-mist text-muted">{count}</span>
    </div>
  );
}

function WalkFacts({
  client,
  service,
  date,
  numDogs,
  price,
  worker,
  completedAt,
}: {
  client: string;
  service: string | null;
  date: Date;
  numDogs: number;
  price: number;
  worker: string | null;
  completedAt?: Date | null;
}) {
  return (
    <div>
      <p className="font-semibold">
        {client} · {service ?? "Walk"}
      </p>
      <p className="text-sm text-muted">
        {formatDate(date)} · {numDogs} dog{numDogs > 1 ? "s" : ""} · {formatMoney(price)}
        {worker ? ` · ${worker}` : ""}
        {completedAt ? ` · done ${formatDate(completedAt)}` : ""}
      </p>
    </div>
  );
}
