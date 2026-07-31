import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireClient } from "@/lib/guard";
import { getServices, serviceDays } from "@/lib/services";
import { bankHolidayKeys } from "@/lib/availability";
import { dayKey } from "@/lib/dates";
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
    prisma.dog.findMany({ where: { ownerId: user.id }, select: { id: true, name: true }, orderBy: { createdAt: "asc" } }),
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
      <div>
        <h1 className="text-2xl font-extrabold">Book a walk</h1>
        <p className="text-sm text-muted">
          Choose a service, pick your dog(s), and book a single day or a repeating schedule.
        </p>
      </div>

      {dogOptions.length === 0 ? (
        <div className="card space-y-2">
          <p className="text-muted">You don&apos;t have any dogs on your account yet.</p>
          <Link href="/client" className="btn-outline w-fit">Go to your account</Link>
        </div>
      ) : serviceOptions.length === 0 ? (
        <div className="card">
          <p className="text-muted">There are no services available to book right now. Please check back soon.</p>
        </div>
      ) : (
        <BookingForm services={serviceOptions} dogs={dogOptions} bankHolidays={[...bhKeys]} todayIso={todayIso} />
      )}
    </div>
  );
}
