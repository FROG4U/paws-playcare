import { AppShell } from "@/components/AppShell";
import { requireWorker } from "@/lib/guard";
import { unreadCount } from "@/lib/notifications";
import type { NavItem } from "@/components/NavLink";

const items: NavItem[] = [
  { href: "/worker", label: "Home", icon: "home" },
  { href: "/worker/jobs", label: "Job board", icon: "list" },
  { href: "/worker/walks", label: "My walks", icon: "paw" },
  { href: "/worker/earnings", label: "Earnings", icon: "wallet" },
];

export default async function WorkerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireWorker();
  const unread = await unreadCount(user.id);
  return (
    <AppShell
      user={{ name: user.name, role: user.role }}
      items={items}
      unread={unread}
      notifHref="/worker/notifications"
    >
      {children}
    </AppShell>
  );
}
