import { prisma } from "@/lib/prisma";
import { PageHeader, EmptyState } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { formatDate } from "@/lib/dates";

export default async function MessagesPage() {
  const messages = await prisma.contactMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  // Mark unread as read once viewed.
  if (messages.some((m) => !m.read)) {
    await prisma.contactMessage.updateMany({ where: { read: false }, data: { read: true } });
  }

  return (
    <div className="space-y-5">
      <PageHeader icon="mail" title="Messages" subtitle="Enquiries from your website contact form." />

      {messages.length === 0 ? (
        <EmptyState icon="mail" title="No messages yet">
          Messages sent through your contact page will appear here.
        </EmptyState>
      ) : (
        <div className="grid gap-3">
          {messages.map((m) => (
            <div key={m.id} className="card space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold">{m.name}</p>
                <p className="text-xs text-muted">{formatDate(m.createdAt)}</p>
              </div>
              <div className="flex flex-wrap gap-3 text-sm text-muted">
                <span className="flex items-center gap-1.5">
                  <Icon name="mail" className="h-4 w-4" />
                  <a href={`mailto:${m.email}`} className="text-brand hover:underline">{m.email}</a>
                </span>
                {m.phone && (
                  <span className="flex items-center gap-1.5">
                    <Icon name="phone" className="h-4 w-4" />
                    {m.phone}
                  </span>
                )}
              </div>
              <p className="whitespace-pre-wrap text-sm">{m.message}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
