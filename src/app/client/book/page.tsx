import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireClient } from "@/lib/guard";
import { getServices, serviceDays } from "@/lib/services";
import { bankHolidayKeys } from "@/lib/availability";
import { dayKey } from "@/lib/dates";
import { PageHeader, EmptyState } from "@/components/ui";
import { BookingForm, type BookServiceOption, type BookDogOption } from "./BookingForm";

export default async function BookPage() {
  const user = await requireClient();

  if (user.status !== "ACTIVE") {
    return (
      <div className="card space-y-2">
        <h1 className="text-xl font-bold">Booking</h1>
        <p className="text-muted">
          Your account is still awaiting approval. Once an admin approves you,
          you&apos;ll be able to book here.
        </p>
      </div>
    );
  }

  const [dogs, services, bhKeys] = await Promise.all([
    prisma.dog.findMany({ where: { ownerId: user.id, archivedAt: null }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
    getServices(),
    bankHolidayKeys(),
  ]);
  const todayIso = dayKey(new Date());

  const serviceOptions: BookServiceOption[] = services
    .filter((s) => s.active)
    .map((s) => ({ id: s.id, name: s.name, timeSlot: s.timeSlot, pricePerDog: s.pricePerDog, days: serviceDays(s) }))
    .filter((s) => s.days.length > 0);

  const dogOptions: BookDogOption[] = dogs.map((d) => ({ id: d.id, name: d.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        icon="calendar"
        title="Book a walk"
        subtitle="Pick a service, choose your dog(s), and book a day or a repeating schedule."
      />

      {dogOptions.length === 0 ? (
        <EmptyState
          icon="paw"
          title="No dogs on your account"
          action={<Link href="/client/profile" className="btn-outline">Go to my profile</Link>}
        >
          Add a dog on your profile first, then you can book walks.
        </EmptyState>
      ) : serviceOptions.length === 0 ? (
        <EmptyState icon="clock" title="No services available">
          There&apos;s nothing to book right now — please check back soon.
        </EmptyState>
      ) : (
        <BookingForm services={serviceOptions} dogs={dogOptions} bankHolidays={[...bhKeys]} todayIso={todayIso} hasCard={!!user.paymentMethodId} payCadence={user.payCadence} />
      )}
    </div>
  );
}
