import { AppShell } from "@/components/AppShell";
import { requireClient } from "@/lib/guard";
import { unreadCount } from "@/lib/notifications";
import type { NavItem } from "@/components/NavLink";

const items: NavItem[] = [
  { href: "/client", label: "Home", icon: "home" },
  { href: "/client/book", label: "Book", icon: "calendar" },
  { href: "/client/walks", label: "My walks", icon: "paw" },
  { href: "/client/invoices", label: "Invoices", icon: "receipt" },
  { href: "/client/payment", label: "Payment", icon: "card" },
];

export default async function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireClient();
  const unread = await unreadCount(user.id);
  return (
    <AppShell
      user={{ name: user.name, role: user.role }}
      items={items}
      unread={unread}
      notifHref="/client/notifications"
    >
      {children}
    </AppShell>
  );
}
