import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireClient } from "@/lib/guard";
import { WALK_STATUS_LABELS } from "@/lib/constants";
import { formatDate, atUtcMidnight } from "@/lib/dates";
import { formatMoney } from "@/lib/money";

const STATUS_CLASS: Record<string, string> = {
  REQUESTED: "bg-warn/15 text-warn",
  ASSIGNED: "bg-brand-soft text-brand-dark",
  ACCEPTED: "bg-brand-soft text-brand-dark",
  COMPLETED: "bg-success/15 text-success",
  CANCELLED: "bg-border text-muted",
  DECLINED: "bg-danger/10 text-danger",
};

export default async function WalksPage() {
  const user = await requireClient();
  const walks = await prisma.walk.findMany({
    where: { clientId: user.id },
    orderBy: { date: "asc" },
    select: { id: true, date: true, timeSlot: true, serviceName: true, numDogs: true, price: true, status: true },
  });

  const todayKey = atUtcMidnight(new Date()).getTime();
  const upcoming = walks.filter((w) => atUtcMidnight(w.date).getTime() >= todayKey);
  const past = walks.filter((w) => atUtcMidnight(w.date).getTime() < todayKey).reverse();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">My walks</h1>
        <Link href="/client/book" className="btn-primary">Book</Link>
      </div>

      {walks.length === 0 ? (
        <div className="card space-y-2 text-center">
          <p className="text-muted">You haven&apos;t booked any walks yet.</p>
          <Link href="/client/book" className="btn-primary mx-auto w-fit">Book your first walk</Link>
        </div>
      ) : (
        <>
          <WalkList title="Upcoming" walks={upcoming} emptyText="No upcoming walks." />
          {past.length > 0 && <WalkList title="Past" walks={past} muted />}
        </>
      )}
    </div>
  );
}

type WalkRow = {
  id: string; date: Date; timeSlot: string; serviceName: string | null;
  numDogs: number; price: number; status: string;
};

function WalkList({ title, walks, emptyText, muted }: { title: string; walks: WalkRow[]; emptyText?: string; muted?: boolean }) {
  return (
    <section className="space-y-2">
      <h2 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h2>
      {walks.length === 0 ? (
        <p className="text-sm text-muted">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {walks.map((w) => (
            <li key={w.id} className={`card flex flex-wrap items-center justify-between gap-2 ${muted ? "opacity-70" : ""}`}>
              <div>
                <p className="font-semibold">{w.serviceName ?? "Walk"} · {formatDate(w.date)}</p>
                <p className="text-sm text-muted">
                  {w.numDogs} dog{w.numDogs !== 1 ? "s" : ""} · {formatMoney(w.price)}
                </p>
              </div>
              <span className={`badge ${STATUS_CLASS[w.status] ?? "bg-border text-muted"}`}>
                {WALK_STATUS_LABELS[w.status] ?? w.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
