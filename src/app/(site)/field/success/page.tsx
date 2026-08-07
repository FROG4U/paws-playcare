import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getFieldSettings, slotLabel, groupSlotsByDay } from "@/lib/field";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Icon } from "@/components/Icon";
import { FIELD_BOOKING_STATUS } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Booking confirmed — Paws Playcare",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FieldSuccess({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const { ref } = await searchParams;
  const booking = ref
    ? await prisma.fieldBooking.findUnique({
        where: { reference: ref },
        include: { slots: true },
      })
    : null;
  const settings = await getFieldSettings();
  const paid = booking?.status === FIELD_BOOKING_STATUS.PAID;
  const groups = booking ? groupSlotsByDay(booking.slots) : [];
  const totalSlots = groups.reduce((n, g) => n + g.hours.length, 0);

  return (
    <div className="mx-auto w-full max-w-xl px-5 py-14">
      <div className="card text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success">
          <Icon name="check" className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold">Thank you — you&apos;re booked!</h1>
        {booking ? (
          <>
            <p className="mt-2 text-muted">
              {booking.total === 0 ? "Free booking" : formatMoney(booking.total)}
            </p>
            <div className="mt-4 rounded-xl bg-mist px-4 py-3 text-left text-sm">
              <p className="font-semibold text-brand-dark">Your session{totalSlots > 1 ? "s" : ""}</p>
              {groups.map((g) => (
                <p key={g.dateKey} className="mt-1">
                  <span className="font-medium">{formatDate(g.date)}</span>{" "}
                  <span className="text-muted">{g.hours.map(slotLabel).join(", ")}</span>
                </p>
              ))}
              <p className="mt-2 text-xs text-muted">Reference {booking.reference}</p>
            </div>
            <p className="mt-4 text-sm text-muted">
              {paid
                ? `We've emailed your confirmation and gate access codes to ${booking.email}.`
                : `Your payment is being confirmed — we'll email your gate access codes to ${booking.email} the moment it clears (usually within a minute).`}
            </p>
          </>
        ) : (
          <p className="mt-2 text-muted">
            Your booking is confirmed. Check your email for your gate access codes.
          </p>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link href="/field" className="btn-outline">Book another slot</Link>
          <Link href="/" className="btn-ghost">Back to home</Link>
        </div>
        <p className="mt-5 text-xs text-muted">
          Playground postcode {settings.postcode} · Any questions? Call {settings.contactPhone}.
        </p>
      </div>
    </div>
  );
}
