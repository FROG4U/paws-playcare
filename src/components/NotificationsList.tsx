import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/dates";
import { MarkAllReadButton } from "./MarkAllReadButton";

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Notifications</h1>
        {notifs.some((n) => !n.read) && (
          <MarkAllReadButton path={basePath} />
        )}
      </div>

      {notifs.length === 0 ? (
        <div className="card text-center text-muted">No notifications yet.</div>
      ) : (
        <ul className="space-y-2">
          {notifs.map((n) => {
            const body = (
              <div
                className={`card flex items-start gap-3 ${
                  n.read ? "" : "ring-2 ring-brand/30"
                }`}
              >
                {!n.read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
                )}
                <div className="flex-1">
                  <p className="font-semibold">{n.title}</p>
                  {n.body && (
                    <p className="text-sm text-muted">{n.body}</p>
                  )}
                  <p className="mt-1 text-xs text-muted">
                    {formatDate(n.createdAt)}
                  </p>
                </div>
              </div>
            );
            return (
              <li key={n.id}>
                {n.link ? <Link href={n.link}>{body}</Link> : body}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
