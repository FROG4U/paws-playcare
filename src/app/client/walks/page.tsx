import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireClient } from "@/lib/guard";
import { WALK_STATUS_LABELS } from "@/lib/constants";
import { formatDate, atUtcMidnight } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getServices } from "@/lib/services";
import { serviceColorMap } from "@/lib/service-colors";
import { PageHeader, EmptyState } from "@/components/ui";
import { ServiceBadge } from "@/components/ServiceBadge";
import { Icon } from "@/components/Icon";

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

  const colorMap = serviceColorMap(await getServices());

  const todayKey = atUtcMidnight(new Date()).getTime();
  const upcoming = walks.filter((w) => atUtcMidnight(w.date).getTime() >= todayKey);
  const past = walks.filter((w) => atUtcMidnight(w.date).getTime() < todayKey).reverse();

  return (
    <div className="space-y-6">
      <PageHeader
        icon="paw"
        title="My walks"
        action={
          <Link href="/client/book" className="btn-primary">
            <Icon name="plus" className="h-4 w-4" />
            Book
          </Link>
        }
      />

      {walks.length === 0 ? (
        <EmptyState
          icon="paw"
          title="No walks yet"
          action={
            <Link href="/client/book" className="btn-primary">
              <Icon name="plus" className="h-4 w-4" />
              Book your first walk
            </Link>
          }
        >
          Book a walk and it&apos;ll appear here.
        </EmptyState>
      ) : (
        <>
          <WalkList title="Upcoming" walks={upcoming} colorMap={colorMap} emptyText="No upcoming walks." />
          {past.length > 0 && <WalkList title="Past" walks={past} colorMap={colorMap} muted />}
        </>
      )}
    </div>
  );
}

type WalkRow = {
  id: string; date: Date; timeSlot: string; serviceName: string | null;
  numDogs: number; price: number; status: string;
};

function WalkList({ title, walks, colorMap, emptyText, muted }: { title: string; walks: WalkRow[]; colorMap: Record<string, number>; emptyText?: string; muted?: boolean }) {
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
                <p className="flex items-center gap-2 font-semibold">
                  <ServiceBadge name={w.serviceName ?? "Walk"} colorIndex={w.serviceName != null ? colorMap[w.serviceName] ?? null : null} />
                  {formatDate(w.date)}
                </p>
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
