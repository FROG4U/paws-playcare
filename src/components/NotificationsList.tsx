import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/dates";
import { NOTIF_TYPE } from "@/lib/constants";
import { PageHeader, EmptyState } from "./ui";
import { Icon } from "./Icon";
import { MarkAllReadButton } from "./MarkAllReadButton";

const N = NOTIF_TYPE;
const ICON: Record<string, { icon: string; tone: string }> = {
  [N.ACCOUNT_PENDING]: { icon: "userPlus", tone: "bg-warn/15 text-warn" },
  [N.ACCOUNT_APPROVED]: { icon: "check", tone: "bg-success/15 text-success" },
  [N.ACCOUNT_SUSPENDED]: { icon: "ban", tone: "bg-danger/10 text-danger" },
  [N.BOOKING_CREATED]: { icon: "inbox", tone: "bg-brand-soft text-brand" },
  [N.BOOKING_ACCEPTED]: { icon: "check", tone: "bg-success/15 text-success" },
  [N.BOOKING_REJECTED]: { icon: "x", tone: "bg-danger/10 text-danger" },
  [N.BOOKING_UPDATED]: { icon: "pencil", tone: "bg-brand-soft text-brand" },
  [N.WALK_ASSIGNED]: { icon: "footprints", tone: "bg-brand-soft text-brand" },
  [N.WALK_ACCEPTED]: { icon: "paw", tone: "bg-success/15 text-success" },
  [N.WALK_COMPLETED]: { icon: "check", tone: "bg-success/15 text-success" },
  [N.WALK_SKIPPED]: { icon: "calendar", tone: "bg-warn/15 text-warn" },
  [N.CHANGE_REQUESTED]: { icon: "clock", tone: "bg-warn/15 text-warn" },
  [N.CHANGE_RESOLVED]: { icon: "check", tone: "bg-success/15 text-success" },
  [N.PAYMENT_FAILED]: { icon: "alert", tone: "bg-danger/10 text-danger" },
  [N.CARD_EXPIRING]: { icon: "card", tone: "bg-warn/15 text-warn" },
  [N.ADD_CARD]: { icon: "card", tone: "bg-brand-soft text-brand" },
};

export async function NotificationsList({
  userId,
  basePath,
}: {
  userId: string;
  basePath: string;
}) {
  const notifs = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <PageHeader
        icon="bell"
        title="Notifications"
        action={
          notifs.some((n) => !n.read) ? <MarkAllReadButton path={basePath} /> : undefined
        }
      />

      {notifs.length === 0 ? (
        <EmptyState icon="bell" title="Nothing new">
          You&apos;re all caught up — notifications will appear here.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {notifs.map((n) => {
            const meta = ICON[n.type] ?? { icon: "bell", tone: "bg-brand-soft text-brand" };
            const body = (
              <div className={`card flex items-start gap-3 ${n.read ? "" : "ring-2 ring-brand/30"}`}>
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${meta.tone}`}>
                  <Icon name={meta.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">
                    {n.title}
                    {!n.read && <span className="ml-2 inline-block h-2 w-2 rounded-full bg-brand align-middle" />}
                  </p>
                  {n.body && <p className="text-sm text-muted">{n.body}</p>}
                  <p className="mt-1 text-xs text-muted">{formatDate(n.createdAt)}</p>
                </div>
              </div>
            );
            return (
              <li key={n.id}>{n.link ? <Link href={n.link}>{body}</Link> : body}</li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
