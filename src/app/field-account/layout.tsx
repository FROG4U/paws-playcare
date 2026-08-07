import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { getCurrentUser } from "@/lib/auth";
import { unreadCount } from "@/lib/notifications";
import { ROLES } from "@/lib/constants";
import type { NavItem } from "@/components/NavLink";

// Field/playground customers get their own lightweight account area, distinct
// from dog-walking clients. They share the header login (see actions/auth.ts).
export default async function FieldAccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/online-booking-form");
  if (user.role !== ROLES.FIELD_CLIENT) {
    // Send other roles to their own home.
    redirect(
      user.role === ROLES.ADMIN ? "/admin" : user.role === ROLES.WORKER ? "/worker" : "/client"
    );
  }

  const unread = await unreadCount(user.id);
  const items: NavItem[] = [
    { href: "/field-account", label: "My bookings", icon: "home" },
    { href: "/field", label: "Book the field", icon: "calendar" },
    { href: "/field-account/history", label: "History", icon: "clipboard" },
    { href: "/field-account/card", label: "Payment", icon: "card" },
  ];

  return (
    <AppShell
      user={{ name: user.name, role: "Field customer" }}
      items={items}
      unread={unread}
      notifHref="/field-account"
    >
      {children}
    </AppShell>
  );
}
