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
  const [unread, newBookings, newMessages, pendingCancels, pausePending] = await Promise.all([
    unreadCount(user.id),
    prisma.booking.count({ where: { reviewedAt: null, status: "ACTIVE" } }),
    prisma.contactMessage.count({ where: { read: false } }),
    prisma.changeRequest.count({ where: { type: "CANCELLATION", status: "PENDING" } }),
    prisma.user.count({ where: { role: "CLIENT", pauseRequestedAt: { not: null } } }),
  ]);

  const items: NavItem[] = [
    { href: "/admin", label: "Home", icon: "home" },

    { href: "/admin/new-bookings", label: "New Bookings", icon: "inbox", badge: newBookings, section: "Dog Walking" },
    { href: "/admin/calendar", label: "Calendar", icon: "calendar", section: "Dog Walking" },
    { href: "/admin/approvals", label: "Approvals", icon: "check", section: "Dog Walking" },
    { href: "/admin/bookings", label: "Bookings", icon: "clipboard", section: "Dog Walking" },
    { href: "/admin/cancellations", label: "Cancellations", icon: "x", badge: pendingCancels, section: "Dog Walking" },
    { href: "/admin/clients", label: "Clients", icon: "users", badge: pausePending, section: "Dog Walking" },
    { href: "/admin/workers", label: "Team", icon: "footprints", section: "Dog Walking" },
    { href: "/admin/services", label: "Services", icon: "paw", section: "Dog Walking" },
    { href: "/admin/pricing", label: "Pricing", icon: "tag", section: "Dog Walking" },
    { href: "/admin/invoices", label: "Invoices", icon: "receipt", section: "Dog Walking" },

    { href: "/admin/field/bookings", label: "Field Bookings", icon: "calendar", section: "Field Booking" },
    { href: "/admin/field/clients", label: "Field Clients", icon: "users", section: "Field Booking" },
    { href: "/admin/field/coupons", label: "Coupons", icon: "tag", section: "Field Booking" },
    { href: "/admin/field/blocks", label: "Blocked Times", icon: "x", section: "Field Booking" },
    { href: "/admin/field/settings", label: "Field Settings", icon: "paw", section: "Field Booking" },

    { href: "/admin/sales", label: "Sales", icon: "receipt", section: "Reports" },

    { href: "/admin/pages", label: "Pages", icon: "file", section: "Website" },
    { href: "/admin/messages", label: "Messages", icon: "mail", badge: newMessages, section: "Website" },
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
