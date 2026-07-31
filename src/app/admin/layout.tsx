import { AppShell } from "@/components/AppShell";
import { requireAdmin } from "@/lib/guard";
import { unreadCount } from "@/lib/notifications";
import { prisma } from "@/lib/prisma";
import type { NavItem } from "@/components/NavLink";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAdmin();
  const [unread, newBookings] = await Promise.all([
    unreadCount(user.id),
    prisma.booking.count({ where: { reviewedAt: null, status: "ACTIVE" } }),
  ]);

  const items: NavItem[] = [
    { href: "/admin", label: "Home", icon: "home" },
    { href: "/admin/new-bookings", label: "New Bookings", icon: "inbox", badge: newBookings },
    { href: "/admin/calendar", label: "Calendar", icon: "calendar" },
    { href: "/admin/approvals", label: "Approvals", icon: "check" },
    { href: "/admin/bookings", label: "Bookings", icon: "clipboard" },
    { href: "/admin/clients", label: "Clients", icon: "users" },
    { href: "/admin/workers", label: "Team", icon: "footprints" },
    { href: "/admin/services", label: "Services", icon: "paw" },
    { href: "/admin/pricing", label: "Pricing", icon: "tag" },
    { href: "/admin/invoices", label: "Invoices", icon: "receipt" },
  ];

  return (
    <AppShell
      user={{ name: user.name, role: user.role }}
      items={items}
      unread={unread}
      notifHref="/admin/notifications"
    >
      {children}
    </AppShell>
  );
}
