import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireClient } from "@/lib/guard";
import { WALK_STATUS, WALK_STATUS_LABELS, CHANGE_REQUEST_TYPE, CHANGE_REQUEST_STATUS, CANCEL_NOTICE_DAYS } from "@/lib/constants";
import { formatDate, atUtcMidnight } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { getServices } from "@/lib/services";
import { serviceColorMap } from "@/lib/service-colors";
import { PageHeader, EmptyState } from "@/components/ui";
import { ServiceBadge } from "@/components/ServiceBadge";
import { Icon } from "@/components/Icon";
import { CancelWalk } from "./CancelWalk";

const STATUS_CLASS: Record<string, string> = {
  REQUESTED: "bg-warn/15 text-warn",
  ASSIGNED: "bg-brand-soft text-brand-dark",
  ACCEPTED: "bg-brand-soft text-brand-dark",
  COMPLETED: "bg-success/15 text-success",
  CANCELLED: "bg-border text-muted",
  DECLINED: "bg-danger/10 text-danger",
};

const DAY_MS = 86400000;

export default async function WalksPage() {
  const user = await requireClient();
  const [walks, pendingCancels, colorMap] = await Promise.all([
    prisma.walk.findMany({
      where: { clientId: user.id },
      orderBy: { date: "asc" },
      select: { id: true, date: true, timeSlot: true, serviceName: true, numDogs: true, price: true, status: true, lateCancelled: true },
    }),
    prisma.changeRequest.findMany({
      where: { requestedById: user.id, type: CHANGE_REQUEST_TYPE.CANCELLATION, status: CHANGE_REQUEST_STATUS.PENDING },
      select: { walkId: true },
    }),
    getServices().then(serviceColorMap),
  ]);

  const pendingSet = new Set(pendingCancels.map((c) => c.walkId));
  const todayMs = atUtcMidnight(new Date()).getTime();

  const rows: WalkRow[] = walks.map((w) => {
    const daysNotice = Math.round((atUtcMidnight(w.date).getTime() - todayMs) / DAY_MS);
    return {
      ...w,
      colorIndex: w.serviceName != null ? colorMap[w.serviceName] ?? null : null,
      daysNotice,
      pendingCancel: pendingSet.has(w.id),
    };
  });

  const cancellable = (w: WalkRow) =>
    w.status !== WALK_STATUS.COMPLETED && w.status !== WALK_STATUS.CANCELLED;

  const nextTwoWeeks = rows.filter((w) => w.daysNotice >= 0 && w.daysNotice <= 14 && cancellable(w));
  const later = rows.filter((w) => w.daysNotice > 14 && cancellable(w));
  const past = rows.filter((w) => w.daysNotice < 0 || !cancellable(w)).reverse();

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
          <section className="space-y-2">
            <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Next 2 weeks</h2>
            <p className="text-xs text-muted">
              Need to cancel? {CANCEL_NOTICE_DAYS}+ days&apos; notice avoids a charge. Cancellations are approved by our team.
            </p>
            <WalkList walks={nextTwoWeeks} emptyText="No walks in the next 2 weeks." />
          </section>
          {later.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Later</h2>
              <WalkList walks={later} />
            </section>
          )}
          {past.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-sm font-bold uppercase tracking-wide text-muted">Past &amp; cancelled</h2>
              <WalkList walks={past} muted />
            </section>
          )}
        </>
      )}
    </div>
  );
}

type WalkRow = {
  id: string;
  date: Date;
  timeSlot: string;
  serviceName: string | null;
  numDogs: number;
  price: number;
  status: string;
  lateCancelled: boolean;
  colorIndex: number | null;
  daysNotice: number;
  pendingCancel: boolean;
};

function WalkList({ walks, emptyText, muted }: { walks: WalkRow[]; emptyText?: string; muted?: boolean }) {
  if (walks.length === 0) {
    return emptyText ? <p className="text-sm text-muted">{emptyText}</p> : null;
  }
  return (
    <ul className="space-y-2">
      {walks.map((w) => {
        const canCancel = w.status !== WALK_STATUS.COMPLETED && w.status !== WALK_STATUS.CANCELLED;
        return (
          <li key={w.id} className={`card flex flex-wrap items-center justify-between gap-2 ${muted ? "opacity-70" : ""}`}>
            <div>
              <p className="flex items-center gap-2 font-semibold">
                <ServiceBadge name={w.serviceName ?? "Walk"} colorIndex={w.colorIndex} />
                {formatDate(w.date)}
              </p>
              <p className="text-sm text-muted">
                {w.numDogs} dog{w.numDogs !== 1 ? "s" : ""} · {formatMoney(w.price)}
                {w.lateCancelled ? " · Late cancellation (charged)" : ""}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className={`badge ${STATUS_CLASS[w.status] ?? "bg-border text-muted"}`}>
                {WALK_STATUS_LABELS[w.status] ?? w.status}
              </span>
              {canCancel && (
                <CancelWalk
                  walkId={w.id}
                  within7={w.daysNotice < CANCEL_NOTICE_DAYS}
                  price={w.price}
                  pending={w.pendingCancel}
                />
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
