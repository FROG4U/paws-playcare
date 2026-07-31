import Link from "next/link";
import { requireClient } from "@/lib/guard";
import { prisma } from "@/lib/prisma";
import { USER_STATUS, WALK_STATUS, WALK_STATUS_LABELS } from "@/lib/constants";
import { formatDate, dayKey } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { PauseToggle } from "@/components/PauseToggle";

export default async function ClientHome() {
  const user = await requireClient();
  const hasCard = !!user.paymentMethodId;
  const todayKey = dayKey(new Date());

  const upcoming = await prisma.walk.findMany({
    where: {
      clientId: user.id,
      date: { gte: new Date(todayKey + "T00:00:00.000Z") },
      status: {
        in: [WALK_STATUS.REQUESTED, WALK_STATUS.ASSIGNED, WALK_STATUS.ACCEPTED],
      },
    },
    include: { worker: true },
    orderBy: { date: "asc" },
    take: 10,
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Hi, {user.name.split(" ")[0]} 👋</h1>
        {user.status === USER_STATUS.ACTIVE && (
          <PauseToggle paused={user.servicesPaused} />
        )}
      </div>

      {/* Status banners */}
      {user.status === USER_STATUS.PENDING && (
        <Banner tone="warn" title="Account awaiting approval">
          A Paws Playcare admin is reviewing your account. You&apos;ll be able to
          add a card and book walks once approved.
        </Banner>
      )}
      {user.status === USER_STATUS.SUSPENDED && (
        <Banner tone="danger" title="Bookings paused">
          {user.suspendReason ||
            "Your account is on hold. Please contact us or settle any outstanding invoices."}
        </Banner>
      )}
      {user.status === USER_STATUS.ACTIVE && !hasCard && (
        <Banner tone="brand" title="Add a payment card to start booking">
          We collect payment automatically after each completed walk.{" "}
          <Link href="/client/payment" className="font-bold underline">
            Add card →
          </Link>
        </Banner>
      )}
      {user.status === USER_STATUS.ACTIVE && user.servicesPaused && (
        <Banner tone="warn" title="Walks paused">
          You&apos;ve paused all walks. Resume any time to book again.
        </Banner>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/client/book" className="card flex items-center gap-3 hover:shadow-md">
          <span className="text-2xl">📅</span>
          <div>
            <p className="font-bold">Book a walk</p>
            <p className="text-sm text-muted">One-off or repeating</p>
          </div>
        </Link>
        <Link href="/client/payment" className="card flex items-center gap-3 hover:shadow-md">
          <span className="text-2xl">💳</span>
          <div>
            <p className="font-bold">Payment</p>
            <p className="text-sm text-muted">
              {hasCard
                ? `${user.cardBrand ?? "Card"} ···· ${user.cardLast4}`
                : "No card on file"}
            </p>
          </div>
        </Link>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold">Upcoming walks</h2>
        {upcoming.length === 0 ? (
          <p className="mt-2 text-muted">No upcoming walks booked.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {upcoming.map((w) => (
              <li key={w.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="font-semibold">
                    {formatDate(w.date)} · {w.timeSlot}
                  </p>
                  <p className="text-sm text-muted">
                    {w.numDogs} dog{w.numDogs > 1 ? "s" : ""} ·{" "}
                    {formatMoney(w.price)}
                    {w.worker ? ` · ${w.worker.name}` : ""}
                  </p>
                </div>
                <span className="badge bg-brand-soft text-brand-dark">
                  {WALK_STATUS_LABELS[w.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Banner({
  tone,
  title,
  children,
}: {
  tone: "brand" | "warn" | "danger";
  title: string;
  children: React.ReactNode;
}) {
  const tones = {
    brand: "bg-brand-soft text-brand-dark",
    warn: "bg-warn/10 text-warn",
    danger: "bg-danger/10 text-danger",
  };
  return (
    <div className={`rounded-xl p-4 ${tones[tone]}`}>
      <p className="font-bold">{title}</p>
      <p className="text-sm">{children}</p>
    </div>
  );
}
