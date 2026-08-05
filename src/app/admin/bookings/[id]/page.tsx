import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { formatDate, dayKey } from "@/lib/dates";
import { getServices, serviceForName } from "@/lib/services";
import { serviceColorMap } from "@/lib/service-colors";
import { WALK_STATUS, WALK_STATUS_LABELS } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { ServiceBadge } from "@/components/ServiceBadge";
import { Icon } from "@/components/Icon";
import { BookingEditor, type WalkLite } from "./BookingEditor";

const EDITABLE: string[] = [
  WALK_STATUS.REQUESTED,
  WALK_STATUS.ASSIGNED,
  WALK_STATUS.ACCEPTED,
  WALK_STATUS.DECLINED,
];

export default async function BookingEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const booking = await prisma.booking.findUnique({
    where: { id },
    include: {
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          dogs: { select: { id: true, name: true }, orderBy: { createdAt: "asc" } },
        },
      },
      walks: { orderBy: { date: "asc" } },
    },
  });
  if (!booking) notFound();

  const services = await getServices();
  const colorMap = serviceColorMap(services);
  const colorIndex = booking.serviceName != null ? colorMap[booking.serviceName] ?? null : null;
  const service = serviceForName(services, booking.serviceId, booking.serviceName);

  let selectedDogIds: string[] = [];
  try {
    const parsed = JSON.parse(booking.dogIds);
    if (Array.isArray(parsed)) selectedDogIds = parsed;
  } catch {
    // leave empty
  }

  const walks: WalkLite[] = booking.walks.map((w) => ({
    id: w.id,
    dateIso: dayKey(w.date),
    label: formatDate(w.date),
    status: w.status,
    statusLabel: WALK_STATUS_LABELS[w.status] ?? w.status,
    editable: EDITABLE.includes(w.status),
    price: w.price,
    noCharge: w.noCharge,
  }));

  const paused = booking.status === "PAUSED";
  const isPending = booking.reviewedAt == null && booking.status === "ACTIVE";

  return (
    <div className="space-y-5">
      <Link
        href="/admin/new-bookings"
        className="inline-flex items-center gap-2 text-sm font-semibold text-muted hover:text-brand-dark"
      >
        <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
        Back to bookings
      </Link>

      <PageHeader
        icon="clipboard"
        title="Edit booking"
        subtitle={`${booking.type === "RECURRING" ? "Repeating" : "One-off"} booking for ${booking.client.name}`}
        action={
          <Link href={`/admin/clients/${booking.client.id}/edit`} className="btn-outline">
            <Icon name="pencil" className="h-4 w-4" />
            Edit client &amp; dogs
          </Link>
        }
      />

      <div className="card flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ServiceBadge name={booking.serviceName ?? "Walk"} colorIndex={colorIndex} />
          <span className="text-sm text-muted">
            {booking.client.name}
            {booking.client.email ? ` · ${booking.client.email}` : ""}
          </span>
        </div>
        <Link href={`/admin/clients/${booking.client.id}`} className="text-sm font-semibold text-brand">
          View client
        </Link>
      </div>

      <BookingEditor
        bookingId={booking.id}
        dogs={booking.client.dogs}
        selectedDogIds={selectedDogIds}
        walks={walks}
        decision={booking.decision}
        isPending={isPending}
        pricePerDog={service ? service.pricePerDog : null}
        paused={paused}
      />
    </div>
  );
}
