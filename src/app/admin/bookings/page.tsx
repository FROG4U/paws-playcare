import { prisma } from "@/lib/prisma";
import { WALK_STATUS, WALK_STATUS_LABELS } from "@/lib/constants";
import { formatDate, dayKey, isoWeekday } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getServices } from "@/lib/services";
import { serviceColorMap } from "@/lib/service-colors";
import { PageHeader, EmptyState } from "@/components/ui";
import { ServiceBadge } from "@/components/ServiceBadge";
import { Icon } from "@/components/Icon";
import { UndoButton } from "./WalkActions";
import { BookingsBoard, type WalkCard, type Week } from "./BookingsBoard";

const OPEN_STATUSES = [WALK_STATUS.REQUESTED, WALK_STATUS.ASSIGNED, WALK_STATUS.ACCEPTED];

// Monday (yyyy-mm-dd) of the week containing this date.
function weekMondayKey(d: Date): string {
  const wd = isoWeekday(d); // Mon=1 … Sun=7
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() - (wd - 1));
  return dayKey(monday);
}

export default async function BookingsPage() {
  const todayEnd = new Date(dayKey(new Date()) + "T23:59:59.999Z");

  const [ready, upcoming, recentlyCompleted] = await Promise.all([
    prisma.walk.findMany({
      where: { status: { in: OPEN_STATUSES }, date: { lte: todayEnd } },
      include: { client: { select: { name: true } }, worker: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.walk.findMany({
      where: { status: { in: OPEN_STATUSES }, date: { gt: todayEnd } },
      include: { client: { select: { name: true } }, worker: { select: { name: true } } },
      orderBy: { date: "asc" },
      take: 400,
    }),
    prisma.walk.findMany({
      where: { status: WALK_STATUS.COMPLETED },
      include: { client: { select: { name: true } } },
      orderBy: { completedAt: "desc" },
      take: 15,
    }),
  ]);

  const colorMap = serviceColorMap(await getServices());
  const colorOf = (name: string | null) => (name != null ? colorMap[name] ?? null : null);

  type WalkRow = (typeof upcoming)[number];
  const toCard = (w: WalkRow): WalkCard => ({
    id: w.id,
    client: w.client.name,
    service: w.serviceName,
    colorIndex: colorOf(w.serviceName),
    dateLabel: formatDate(w.date),
    numDogs: w.numDogs,
    priceLabel: w.noCharge ? "No charge" : formatMoney(w.price),
    worker: w.worker?.name ?? null,
    statusLabel: WALK_STATUS_LABELS[w.status] ?? w.status,
    bookingId: w.bookingId,
  });

  const readyCards = ready.map(toCard);

  // Group upcoming into weeks.
  const weekMap = new Map<string, WalkRow[]>();
  for (const w of upcoming) {
    const k = weekMondayKey(w.date);
    if (!weekMap.has(k)) weekMap.set(k, []);
    weekMap.get(k)!.push(w);
  }
  const weeks: Week[] = [...weekMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([key, rows]) => {
      const monday = new Date(key + "T00:00:00.000Z");
      const sunday = new Date(monday.getTime() + 6 * 86400000);
      return { key, label: `Week of ${formatDate(monday)} – ${formatDate(sunday)}`, walks: rows.map(toCard) };
    });

  const hasAny = readyCards.length > 0 || weeks.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon="clipboard"
        title="Bookings"
        subtitle="Mark walks as done — each completed walk is added to the client's invoice. Select several to complete at once."
      />

      {readyCards.length === 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Icon name="footprints" className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-bold">Ready to complete</h2>
            <span className="badge bg-mist text-muted">0</span>
          </div>
          <EmptyState icon="check" title="Nothing to complete">
            Walks up to today appear here to mark as done. You can also complete any upcoming walk below.
          </EmptyState>
        </section>
      )}

      {hasAny && <BookingsBoard ready={readyCards} weeks={weeks} />}

      {/* Recently completed */}
      {recentlyCompleted.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Icon name="check" className="h-5 w-5 text-brand" />
            <h2 className="text-lg font-bold">Recently completed</h2>
            <span className="badge bg-mist text-muted">{recentlyCompleted.length}</span>
          </div>
          <div className="space-y-2">
            {recentlyCompleted.map((w) => (
              <div key={w.id} className="card flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="flex items-center gap-2 font-semibold">
                    {w.client.name}
                    <ServiceBadge name={w.serviceName ?? "Walk"} colorIndex={colorOf(w.serviceName)} />
                  </p>
                  <p className="text-sm text-muted">
                    {formatDate(w.date)} · {w.numDogs} dog{w.numDogs > 1 ? "s" : ""} · {formatMoney(w.price)}
                    {w.completedAt ? ` · done ${formatDate(w.completedAt)}` : ""}
                  </p>
                </div>
                <UndoButton walkId={w.id} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
