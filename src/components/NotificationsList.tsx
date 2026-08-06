import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatWhen } from "@/lib/dates";
import { NOTIF_TYPE } from "@/lib/constants";
import { PageHeader, EmptyState } from "./ui";
import { Icon } from "./Icon";
import { AutoMarkRead } from "./AutoMarkRead";

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
  [N.CONTACT_MESSAGE]: { icon: "mail", tone: "bg-brand-soft text-brand" },
};

export async function NotificationsList({
  userId,
  basePath,
  title = "Notifications",
}: {
  userId: string;
  basePath: string;
  title?: string;
}) {
  const notifs = await prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const hasUnread = notifs.some((n) => !n.read);

  return (
    <div className="space-y-4">
      <AutoMarkRead path={basePath} hasUnread={hasUnread} />
      <PageHeader icon="mail" title={title} />

      {notifs.length === 0 ? (
        <EmptyState icon="mail" title="No messages yet">
          You&apos;re all caught up — messages from Paws Playcare will appear here.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {notifs.map((n) => {
            const meta = ICON[n.type] ?? { icon: "paw", tone: "bg-brand-soft text-brand" };
            const row = (
              <div className={`flex items-start gap-3 px-3.5 py-3 transition ${n.read ? "" : "bg-brand-soft/40"} ${n.link ? "hover:bg-brand-soft/60" : ""}`}>
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full ${meta.tone}`}>
                  <Icon name={meta.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate ${n.read ? "font-semibold" : "font-bold"}`}>{n.title}</p>
                    <span className="shrink-0 text-xs text-muted">{formatWhen(n.createdAt)}</span>
                  </div>
                  {n.body && (
                    <p className={`mt-0.5 line-clamp-2 text-sm ${n.read ? "text-muted" : "text-foreground/80"}`}>
                      {n.body}
                    </p>
                  )}
                </div>
                {!n.read && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" />}
              </div>
            );
            return <li key={n.id}>{n.link ? <Link href={n.link} className="block">{row}</Link> : row}</li>;
          })}
        </ul>
      )}
    </div>
  );
}
